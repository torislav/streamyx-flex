import { ExtensionError, EXTENSION_ERROR_CODES } from 'azot';

const BASE_URL = 'https://back-films.ru/api';

const API_ROUTES = {
  sendCode: `${BASE_URL}/v5/mobile/auth/send-code/`,
  signIn: `${BASE_URL}/v5/web/auth/login/`,
  user: `${BASE_URL}/v4/user/`,
  films: (slug: string) => `${BASE_URL}/v4/films/${slug}/`,
  streams: (slug: string, episodeId: number) =>
    `${BASE_URL}/v4/films/${slug}/streams/?episode=${episodeId}`,
};

export { API_ROUTES };

export type FlexQuality = { id: number; name: string; title: string };

export type FlexEpisode = {
  id: number;
  label: string;
  series: number;
  duration?: number;
};

export type FlexSeason = {
  id: number;
  season_number: number;
  series: FlexEpisode[];
};

export type FlexFilm = {
  id: number;
  name: string;
  slug: string;
  poster?: string;
  year?: number;
  is_film: boolean;
  list: FlexSeason[];
};

export type FlexUser = {
  username?: string;
  email?: string;
};

export type FlexAuth = {
  token: string;
  uuid: string;
  username?: string;
};

export const getAuth = (): FlexAuth | null => {
  const raw = localStorage.getItem('auth');
  if (!raw) return null;
  try {
    const auth = JSON.parse(raw) as Partial<FlexAuth>;
    if (!auth.token) return null;
    return { token: auth.token, uuid: auth.uuid ?? '', username: auth.username };
  } catch {
    return null;
  }
};

export const saveAuth = (auth: FlexAuth | null) => {
  if (auth) localStorage.setItem('auth', JSON.stringify(auth));
  else localStorage.removeItem('auth');
};

export const getAuthHeaders = (): Record<string, string> => {
  const auth = getAuth();
  return auth?.token ? { Authorization: `JWT ${auth.token}` } : {};
};

export const parseJsonResponse = async <T>(response: Response): Promise<T | null> => {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error(`Expected JSON response from ${response.url}. Status code: ${response.status}`);
    console.debug(text.slice(0, 1000));
    return null;
  }
};

export const postJson = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(
    new Request(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json; charset=UTF-8', ...headers },
    }),
  );

const assertResponseOk = async (response: Response) => {
  if (response.ok) return;
  if (response.status === 401) {
    throw new ExtensionError({
      code: EXTENSION_ERROR_CODES.AUTH_REQUIRED,
      message: 'Требуется вход в аккаунт FLEX. Войдите в аккаунт и повторите попытку.',
      operation: 'request',
    });
  }
  if (response.status === 403) {
    throw new ExtensionError({
      code: EXTENSION_ERROR_CODES.SUBSCRIPTION_REQUIRED,
      message:
        'На этом аккаунте нет прав для просмотра данного контента. Проверьте наличие подписки или купленного фильма.',
      operation: 'request',
    });
  }
  throw new ExtensionError({
    code: EXTENSION_ERROR_CODES.MEDIA_UNAVAILABLE,
    message: `Запрос к FLEX завершился с ошибкой. Статус: ${response.status}`,
    operation: 'request',
  });
};

export const request = async <T>(input: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(
    new Request(input, {
      ...init,
      headers: { ...getAuthHeaders(), ...init.headers },
    }),
  );
  await assertResponseOk(response);
  const data = await parseJsonResponse<T>(response);
  if (data === null) {
    throw new ExtensionError({
      code: EXTENSION_ERROR_CODES.MEDIA_UNAVAILABLE,
      message: `Не удалось обработать ответ FLEX от ${input}`,
      operation: 'request',
    });
  }
  return data;
};

export const fetchUsers = () => request<FlexUser>(API_ROUTES.user);

export const fetchFilms = (slug: string) => request<FlexFilm>(API_ROUTES.films(slug));

export type FlexStream = { src: string };

export const fetchPlaybackOptions = async (slug: string, episodeId: number) => {
  const streams = await request<FlexStream[]>(API_ROUTES.streams(slug, episodeId));
  return streams.filter((stream) => !!stream.src);
};
