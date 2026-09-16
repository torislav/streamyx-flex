import {
  defineExtension,
  utils,
  ExtensionError,
  EXTENSION_ERROR_CODES,
  Input,
  UrlSource,
  type MediaEntry,
} from 'azot';
import { ensureAuth, getAuthState, signIn, signOut } from './src/flex.auth';
import {
  fetchFilms,
  fetchPlaybackOptions,
  getAuth,
  getAuthHeaders,
  type FlexFilm,
} from './src/flex.api';
import { parseUrlInfo, buildStreamUrl, createStreamFetchFn } from './src/flex.url';

type FlexContext = {
  slug: string;
  episodeId: number;
};

const isAuthError = (error: unknown) =>
  error instanceof ExtensionError && error.code === EXTENSION_ERROR_CODES.AUTH_REQUIRED;

const normalizeEpisodeTitle = (label: string) => {
  const title = label.replace(/\s*\d+\s*серия\s*/i, '').trim();
  return title || undefined;
};

export default defineExtension<FlexContext>({
  async getEntries({ url, options }) {
    const urlInfo = parseUrlInfo(url);
    if (!urlInfo) {
      throw new ExtensionError({
        code: EXTENSION_ERROR_CODES.UNSUPPORTED_URL,
        message: 'Поддерживаются только страницы фильмов и сериалов на kinoflex.ru',
        operation: 'getEntries',
      });
    }

    await ensureAuth();

    console.debug(`Fetching film with slug ${urlInfo.slug}...`);
    let film: FlexFilm;
    try {
      film = await fetchFilms(urlInfo.slug);
    } catch (error) {
      if (!isAuthError(error)) throw error;
      console.warn('Fetching film failed. Trying to login again...');
      await signOut();
      await signIn();
      film = await fetchFilms(urlInfo.slug);
    }

    const eps = utils.extendEpisodes(options.episodes);
    const results: MediaEntry<FlexContext>[] = [];

    if (film.is_film) {
      const episode = film.list.flatMap((season) => season.series)[0];
      if (!episode) {
        throw new ExtensionError({
          code: EXTENSION_ERROR_CODES.MEDIA_UNAVAILABLE,
          message: `У фильма «${film.name}» нет доступных эпизодов`,
          operation: 'getEntries',
        });
      }
      results.push({
        type: 'movie',
        id: String(episode.id),
        title: film.name,
        year: film.year,
        posterUrl: film.poster,
        context: { slug: film.slug, episodeId: episode.id },
      });
      return results;
    }

    for (const season of film.list) {
      if (eps.items.size && !eps.has(undefined, season.season_number)) continue;
      console.debug(`Fetching season ${season.season_number}...`);

      for (const episode of season.series) {
        if (eps.items.size && !eps.has(episode.series, season.season_number)) continue;
        results.push({
          type: 'episode',
          id: String(episode.id),
          title: film.name,
          seasonNumber: season.season_number,
          episodeNumber: episode.series,
          episodeTitle: normalizeEpisodeTitle(episode.label),
          context: { slug: film.slug, episodeId: episode.id },
        });
      }
    }

    if (!results.length) {
      throw new ExtensionError({
        code: EXTENSION_ERROR_CODES.MEDIA_UNAVAILABLE,
        message: `Не найдено эпизодов для «${film.name}» с выбранными фильтрами`,
        operation: 'getEntries',
      });
    }
    return results;
  },

  async resolveEntry({ entry }) {
    const { slug, episodeId } = entry.context ?? {};
    if (!slug || !episodeId) throw new Error('Content ID is missing');

    console.debug(`Fetching playback options for episode ${episodeId}...`);
    const auth = await ensureAuth();
    let streams;
    try {
      streams = await fetchPlaybackOptions(slug, episodeId);
    } catch (error) {
      if (!isAuthError(error) || !getAuthHeaders().Authorization) throw error;
      console.warn('Fetching playback options failed. Trying to login again...');
      await signOut();
      await signIn();
      streams = await fetchPlaybackOptions(slug, episodeId);
    }
    const stream = streams[0];
    if (!stream?.src) {
      throw new ExtensionError({
        code: EXTENSION_ERROR_CODES.MEDIA_UNAVAILABLE,
        message: `FLEX не вернул поток для «${entry.title ?? 'контента'}». Проверьте, что контент доступен в вашем регионе и что аккаунт имеет подписку.`,
        operation: 'resolveEntry',
      });
    }

    const uuid = getAuth()?.uuid ?? auth.uuid;
    const input = new Input({
      source: new UrlSource(buildStreamUrl(stream.src, uuid), {
        fetchFn: createStreamFetchFn(uuid),
      }),
    });
    return { entry, input };
  },

  auth: {
    getState: getAuthState,
    login: async () => {
      await signIn();
    },
    logout: () => signOut(),
  },
});
