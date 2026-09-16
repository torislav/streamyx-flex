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
