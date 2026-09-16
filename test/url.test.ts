import { afterEach, describe, expect, test, vi } from 'vitest';
import { buildStreamUrl, createStreamFetchFn, parseUrlInfo } from '../src/flex.url';

describe('FLEX URL parsing', () => {
  test('parses a serial URL', () => {
    expect(parseUrlInfo('https://kinoflex.ru/serial/1883')).toEqual({
      type: 'serial',
      slug: '1883',
    });
  });

  test('parses a movie URL', () => {
    expect(parseUrlInfo('https://kinoflex.ru/movie/thirteenlives')).toEqual({
      type: 'movie',
      slug: 'thirteenlives',
    });
  });

  test('parses a legacy film URL', () => {
    expect(parseUrlInfo('https://kinoflex.ru/film/thirteenlives')).toEqual({
      type: 'film',
      slug: 'thirteenlives',
    });
  });

  test('ignores trailing slashes and extra segments', () => {
    expect(parseUrlInfo('https://kinoflex.ru/serial/1883/')).toEqual({
      type: 'serial',
      slug: '1883',
    });
  });

  test('returns null for unsupported types', () => {
    expect(parseUrlInfo('https://kinoflex.ru/news/some-post')).toBeNull();
  });

  test('parses URLs regardless of host, matching is handled by the manifest', () => {
    expect(parseUrlInfo('https://example.com/serial/1883')).toEqual({
      type: 'serial',
      slug: '1883',
    });
  });
});

describe('FLEX stream URL building', () => {
  test('appends the device uuid', () => {
    expect(buildStreamUrl('https://cdn.example.test/video.mp4', 'device-uuid')).toBe(
      'https://cdn.example.test/video.mp4?uuid=device-uuid',
    );
  });

  test('preserves existing query parameters', () => {
    expect(buildStreamUrl('https://cdn.example.test/video.mp4?quality=1080', 'device-uuid')).toBe(
      'https://cdn.example.test/video.mp4?quality=1080&uuid=device-uuid',
    );
  });
});

describe('FLEX stream fetch wrapper', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('appends the uuid to playlist requests missing it', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(''));
    vi.stubGlobal('fetch', fetchMock);
    const fetchFn = createStreamFetchFn('device-uuid');

    await fetchFn('https://cdn.example.test/video/720/segments.m3u8');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://cdn.example.test/video/720/segments.m3u8?uuid=device-uuid',
      undefined,
    );
  });

  test('does not duplicate an existing uuid', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(''));
    vi.stubGlobal('fetch', fetchMock);
    const fetchFn = createStreamFetchFn('device-uuid');

    await fetchFn('https://cdn.example.test/video/master.m3u8?uuid=other-uuid');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://cdn.example.test/video/master.m3u8?uuid=other-uuid',
      undefined,
    );
  });

  test('leaves non-playlist requests untouched', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(''));
    vi.stubGlobal('fetch', fetchMock);
    const fetchFn = createStreamFetchFn('device-uuid');

    await fetchFn('https://cdn.example.test/video/720/0001.ts', { headers: { Accept: '*/*' } });

    expect(fetchMock).toHaveBeenCalledWith('https://cdn.example.test/video/720/0001.ts', {
      headers: { Accept: '*/*' },
    });
  });

  test('passes through requests that are not valid URLs', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(''));
    vi.stubGlobal('fetch', fetchMock);
    const fetchFn = createStreamFetchFn('device-uuid');

    await fetchFn('not-a-url');

    expect(fetchMock).toHaveBeenCalledWith('not-a-url', undefined);
  });
});
