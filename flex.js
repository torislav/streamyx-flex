'use strict';

const { defineExtension } = require('azot');
const api = require('./src/api');

module.exports = defineExtension({
  init: async () => {
    const auth = await api.loadAuth();
    if (!auth?.token) await api.signIn();
    const user = await api.fetchUsers();
    console.debug(`Profile: ${user.username}`);
  },

  fetchContentMetadata: async (url, args) => {
    const results = [];
    const [type, slug] = url.split('/').slice(-2) || [];
    const eps = Azot.utils.extendEpisodes(args.episodes);

    if (['serial', 'film'].includes(type)) {
      console.debug(`Fetching series with slug ${slug}`);
      const series = await api.fetchFilms(slug);

      for (const season of series.list) {
        if (eps.items.size && !eps.has(undefined, season.season_number)) continue;
        console.debug(`Fetching season ${season.season_number} with ID ${season.id}`);

        for (const episode of season.series) {
          if (eps.items.size && !eps.has(episode.series, season.season_number)) continue;
          const source = await api.fetchPlaybackOptions(slug, episode.id);

          results.push({
            id: episode.id,
            title: series.name,
            seasonNumber: season.season_number,
            episodeNumber: episode.series,
            episodeTitle: episode.label.trim(),
            source: { url: source[0].src + `?uuid=${localStorage.getItem('uuid')}` },
          });
        }
      }
    } else {
      console.warn('Unsupported content type');
    }
    return results;
  },
});
