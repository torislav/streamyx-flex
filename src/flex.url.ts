export type FlexUrlInfo = {
  type: 'serial' | 'film' | 'movie';
  slug: string;
};

export const SUPPORTED_TYPES = ['serial', 'film', 'movie'] as const;

export const parseUrlInfo = (url: string): FlexUrlInfo | null => {
  const { pathname } = new URL(url);
  const segments = pathname.split('/').filter(Boolean);
  const [type, slug] = segments;
  if (!type || !slug) return null;
  const normalizedType = type.toLowerCase() as FlexUrlInfo['type'];
  if (!SUPPORTED_TYPES.includes(normalizedType)) return null;
  return { type: normalizedType, slug };
};

export const buildStreamUrl = (src: string, uuid: string) => {
  const url = new URL(src);
  url.searchParams.set('uuid', uuid);
  return url.toString();
};

// The FLEX CDN requires the `uuid` query param on every .m3u8 request, not just the master
// playlist. Child playlist URIs are relative, and URL resolution drops the base query,
// so we re-append the uuid via a custom fetchFn (same approach as the FLEX web player).
export const createStreamFetchFn = (uuid: string): typeof fetch => {
  return (input, init) => {
    const raw =
      typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);

    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return fetch(input, init);
    }

    if (!uuid || !url.pathname.endsWith('.m3u8') || url.searchParams.has('uuid')) {
      return fetch(input, init);
    }

    url.searchParams.set('uuid', uuid);
    return fetch(url.toString(), init);
  };
};
