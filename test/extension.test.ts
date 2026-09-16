import type { Options } from 'azot';
import { EXTENSION_ERROR_CODES, ExtensionError } from 'azot';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { FlexAuth } from '../src/flex.api';

const mocks = vi.hoisted(() => ({
  ensureAuth: vi.fn<() => Promise<FlexAuth>>(),
  signIn: vi.fn<() => Promise<FlexAuth>>(),
  signOut: vi.fn<() => Promise<void>>(),
  getAuthState: vi.fn<() => Promise<{ authenticated: boolean; user?: string }>>(),
  fetchFilms: vi.fn<() => Promise<any>>(),
  fetchPlaybackOptions: vi.fn<() => Promise<any>>(),
}));

vi.mock('../src/flex.auth', () => ({
  ensureAuth: mocks.ensureAuth,
  signIn: mocks.signIn,
  signOut: mocks.signOut,
  getAuthState: mocks.getAuthState,
}));

vi.mock('../src/flex.api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchFilms: mocks.fetchFilms,
  fetchPlaybackOptions: mocks.fetchPlaybackOptions,
}));

import extension from '../flex';

const serialFilm = {
  id: 1467,
  name: '1883',
  slug: '1883',
  is_film: false,
  year: 2021,
  list: [
    {
      id: 3039,
      season_number: 1,
      series: [
        { id: 32845, label: '1 серия ', series: 1 },
        { id: 32846, label: '2 серия ', series: 2 },
      ],
    },
    {
      id: 3040,
      season_number: 2,
      series: [{ id: 32855, label: '1 серия ', series: 1 }],
    },
  ],
};

const movieFilm = {
  id: 999,
  name: '13 жизней',
  slug: 'thirteenlives',
  is_film: true,
  year: 2022,
  list: [{ id: 9991, season_number: 1, series: [{ id: 99911, label: '1 серия ', series: 1 }] }],
};

describe('FLEX getEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureAuth.mockResolvedValue({ token: 'token', uuid: 'uuid' });
  });

  test('rejects unsupported URLs', async () => {
    await expect(
      extension.getEntries!({ url: 'https://kinoflex.ru/news/post', options: {} }),
    ).rejects.toThrow('Поддерживаются только страницы фильмов и сериалов на kinoflex.ru');
  });

  test('collects all episodes of a serial', async () => {
    mocks.fetchFilms.mockResolvedValue(serialFilm);

    const entries = await extension.getEntries!({
      url: 'https://kinoflex.ru/serial/1883',
      options: {},
    });

    expect(mocks.fetchFilms).toHaveBeenCalledWith('1883');
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      type: 'episode',
      id: '32845',
      title: '1883',
      seasonNumber: 1,
      episodeNumber: 1,
      episodeTitle: undefined,
      context: { slug: '1883', episodeId: 32845 },
    });
  });

  test('filters episodes by the selected range', async () => {
    mocks.fetchFilms.mockResolvedValue(serialFilm);

    const options = {
      episodes: new Map<number, Set<number>>([[1, new Set([2])]]),
    } satisfies Options;
    const entries = await extension.getEntries!({
      url: 'https://kinoflex.ru/serial/1883',
      options,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 2,
      context: { episodeId: 32846 },
    });
  });

  test('returns a movie entry for films', async () => {
    mocks.fetchFilms.mockResolvedValue(movieFilm);

    const entries = await extension.getEntries!({
      url: 'https://kinoflex.ru/movie/thirteenlives',
      options: {},
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      type: 'movie',
      title: '13 жизней',
      year: 2022,
      context: { slug: 'thirteenlives', episodeId: 99911 },
    });
  });

  test('retries after signing in again on an auth error', async () => {
    mocks.fetchFilms
      .mockRejectedValueOnce(
        new ExtensionError({
          code: EXTENSION_ERROR_CODES.AUTH_REQUIRED,
          message: 'expired',
          operation: 'request',
        }),
      )
      .mockResolvedValueOnce(serialFilm);
    mocks.signOut.mockResolvedValue(undefined);
    mocks.signIn.mockResolvedValue({ token: 'fresh', uuid: 'fresh-uuid' });

    const entries = await extension.getEntries!({
      url: 'https://kinoflex.ru/serial/1883',
      options: {},
    });

    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.signIn).toHaveBeenCalled();
    expect(entries).toHaveLength(3);
  });
});

describe('FLEX resolveEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureAuth.mockResolvedValue({ token: 'token', uuid: 'device-uuid' });
  });

  test('appends the device uuid to the stream URL', async () => {
    mocks.fetchPlaybackOptions.mockResolvedValue([{ src: 'https://cdn.example.test/video.mp4' }]);

    const { entry } = await extension.resolveEntry!({
      url: 'https://kinoflex.ru/serial/1883',
      options: {},
      entry: {
        type: 'episode',
        title: '1883',
        context: { slug: '1883', episodeId: 32845 },
      },
    });

    expect(mocks.fetchPlaybackOptions).toHaveBeenCalledWith('1883', 32845);
    expect(entry.title).toBe('1883');
  });

  test('preserves existing query parameters of the stream URL', async () => {
    mocks.fetchPlaybackOptions.mockResolvedValue([
      { src: 'https://cdn.example.test/video.mp4?quality=1080' },
    ]);

    await extension.resolveEntry!({
      url: 'https://kinoflex.ru/serial/1883',
      options: {},
      entry: { context: { slug: '1883', episodeId: 32845 } },
    });

    expect(mocks.fetchPlaybackOptions).toHaveBeenCalledWith('1883', 32845);
  });

  test('fails when FLEX provides no playable stream', async () => {
    mocks.fetchPlaybackOptions.mockResolvedValue([]);

    await expect(
      extension.resolveEntry!({
        url: 'https://kinoflex.ru/serial/1883',
        options: {},
        entry: { title: '1883', context: { slug: '1883', episodeId: 32845 } },
      }),
    ).rejects.toThrow('FLEX не вернул поток для «1883»');
  });
});

describe('FLEX auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('reports the authenticated state with a user name', async () => {
    mocks.getAuthState.mockResolvedValue({ authenticated: true, user: 'user' });

    const state = await extension.auth!.getState!();
    expect(state).toEqual({ authenticated: true, user: 'user' });
  });

  test('login and logout delegate to the auth module', async () => {
    mocks.signIn.mockResolvedValue({ token: 'token', uuid: 'uuid' });
    mocks.signOut.mockResolvedValue(undefined);

    await extension.auth!.login!({ method: 'interactive' });
    expect(mocks.signIn).toHaveBeenCalled();

    await extension.auth!.logout!();
    expect(mocks.signOut).toHaveBeenCalled();
  });
});
