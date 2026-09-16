import { describe, expect, test } from 'vitest';
import { buildStreamUrl, parseUrlInfo } from '../src/flex.url';

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
