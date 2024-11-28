'use strict';

const { createApi } = require('./lib/api');

/**
 * @type {import("@streamyx/core").Service}
 */
module.exports = () => (core) => {
  const api = createApi(core);

  return {
    name: 'flex',
    tag: 'FLEX',
    api,
    init: async () => {
      const auth = await api.loadAuth();
      if (!auth?.token) await api.signIn();
      const user = await api.fetchUsers();
      core.log.debug(`Profile: ${user.username}`);
    },

    fetchContentMetadata: async (url, args) => {
      const results = [];
      const [type, slug] = url.split('/').slice(-2) || [];
      const eps = core.utils.extendEpisodes(args.episodes);

      if (['serial', 'film'].includes(type)) {
        core.log.debug(`Fetching series with slug ${slug}`);
        const series = await api.fetchFilms(slug);

        for (const season of series.list) {
          if (eps.items.size && !eps.has(undefined, season.season_number)) continue;
          core.log.debug(`Fetching season ${season.season_number} with ID ${season.id}`);

          for (const episode of season.series) {
            if (eps.items.size && !eps.has(episode.series, season.season_number)) continue;
            const source = await api.fetchPlaybackOptions(slug, episode.id);

            results.push({
              id: episode.id,
              title: series.name,
              seasonNumber: season.season_number,
              episodeNumber: episode.series,
              episodeTitle: episode.label.trim(),
              source: { url: source[0].src + `?uuid=${core.store.state.uuid}` },
            });
          }
        }
      } else {
        core.log.warn('Unsupported content type');
      }
      return results;
    },
  };
};
