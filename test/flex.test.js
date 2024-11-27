import { expect, test } from 'vitest';
import { registerService } from '@streamyx/core';
import flex from './flex';

test('register service', () => {
  const instance = registerService(flex);
  expect(instance).toBeDefined();
  expect(instance).toHaveProperty('name', 'flex');
  expect(instance).toHaveProperty('fetchContentMetadata');
});

test('fetch series metadata', async () => {
  const instance = registerService(flex);
  const episodesBySeasons = new Map([[1, new Set([1, 3])]]);
  const url = 'https://rg6ph.kino-flex.ru/serial/barry';
  const response = await instance.fetchContentMetadata(url, { episodes: episodesBySeasons });
  expect(response).toBeDefined();
  expect(response).toHaveLength(2);
  expect(response[0].id).toBe(188);
  expect(response[0].title).toBe('Барри');
  expect(response[0].seasonNumber).toBe(1);
  expect(response[0].episodeNumber).toBe(1);
  expect(response[0].episodeTitle).toBe('');
});

test('fetch film metadata', async () => {
  const instance = registerService(flex);
  const episodesBySeasons = new Map([[1, new Set([1])]]);
  const url = 'https://rg6ph.kino-flex.ru/serial/emperorofoceanpark';
  const response = await instance.fetchContentMetadata(url, { episodes: episodesBySeasons });
  expect(response).toBeDefined();
  expect(response).toHaveLength(1);
  expect(response[0].id).toBe(50694);
  expect(response[0].seasonNumber).toBe(1);
  expect(response[0].episodeNumber).toBe(1);
  expect(response[0].episodeTitle).toBe('');
});
