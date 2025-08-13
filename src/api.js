'use strict';

const BASE_URL = 'https://back-films.ru/api';
const ENDPOINTS = {
  signIn: `${BASE_URL}/v5/web/auth/login/`,
  sendCode: `${BASE_URL}/v5/mobile/auth/send-code/`,
  user: `${BASE_URL}/v4/user`,
  films: `${BASE_URL}/v4/films`,
  episodePlaybackOptions: (slug, id) => `${BASE_URL}/v4/films/${slug}/streams/?episode=${id}`,
};

const defaultHeaders = {};

const loadAuth = async () => {
  const auth = localStorage.getItem('auth');
  if (auth) {
    const { token, uuid } = JSON.parse(auth);
    if (token) {
      defaultHeaders.Authorization = `JWT ${token}`;
    }
    return { token, uuid };
  }
};

const saveAuth = async (auth) => {
  if (auth?.token) defaultHeaders.Authorization = `JWT ${auth.token}`;
  else delete defaultHeaders.Authorization;

  localStorage.setItem('auth', JSON.stringify(auth));
};

const signIn = async () => {
  console.debug('Signing in FLEX...');

  const { login } = await Azot.prompt({
    fields: { login: { label: 'Введите e-mail или телефон' } },
  });
  const isPhone = /^((\+?7)|8)\d{10}$/.test(login);

  const sendCodeBody = {};

  if (isPhone) {
    sendCodeBody['phone'] = login;
  } else {
    sendCodeBody['email'] = login;
  }

  await clearCookies();
  const codeResponse = await fetch(`${ENDPOINTS.sendCode}`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(sendCodeBody),
  });

  if (codeResponse.status !== 200) {
    throw new Error(
      'Неверные данные для входа, или превышено количество попыток входа. Попробуйте позже, или смените ip.'
    );
  }

  const { code } = await Azot.prompt({
    fields: { code: { label: `Введите код, пришедший вам ${isPhone ? 'в СМС-сообщения' : 'на почту'}` } },
  });

  const authBody = {
    ...sendCodeBody,
    code,
  };

  await clearCookies();
  const response = await fetch(`${ENDPOINTS.signIn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody),
  });

  if (response.status !== 200) {
    throw new Error(
      'Неверные данные для входа, или превышено количество попыток входа. Попробуйте позже, или смените ip.'
    );
  }

  const auth = await response.json();
  const state = { token: auth.token, uuid: auth.user.uuid };
  await saveAuth(state);

  return auth;
};

const request = async (input, init = {}) => {
  const response = await fetch(input, {
    ...init,
    headers: { ...defaultHeaders, ...(init.headers || {}) },
  });

  if (response.status === 403) {
    throw new Error(
      'На этом аккаунте нет прав для просмотра данного контента. Проверьте наличие подписки или купленного фильма.'
    );
  }

  return response.json();
};

const fetchUsers = async () => {
  return request(`${ENDPOINTS.user}`);
};

const fetchPlaybackOptions = async (slug, episodeId) => {
  const url = ENDPOINTS.episodePlaybackOptions(slug, episodeId);
  return request(url);
};

const fetchFilms = async (slug) => {
  const url = `${ENDPOINTS.films}/${slug}`;
  return request(url);
};

const clearCookies = async () => {
    const cookies = await cookieStore.getAll();
    for (const cookie of cookies) {
        await cookieStore.delete(cookie.name);
    }
}

module.exports = { loadAuth, saveAuth, signIn, fetchUsers, fetchPlaybackOptions, fetchFilms };
