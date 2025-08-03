'use strict';

const BASE_URL = 'https://back-films.ru/api';
const ENDPOINTS = {
  signIn: `${BASE_URL}/v5/web/auth/login/`,
  sendCode: `${BASE_URL}/v5/mobile/auth/send-code`,
  user: `${BASE_URL}/v4/user`,
  films: `${BASE_URL}/v4/films`,
  episodePlaybackOptions: (slug, id) => `${BASE_URL}/v4/films/${slug}/streams/?episode=${id}`,
};

const defaultHeaders = {};

const loadAuth = async () => {
  const token = localStorage.getItem('token');
  if (token) defaultHeaders.Authorization = `JWT ${token}`;
};

const saveAuth = async (auth) => {
  if (auth?.token) defaultHeaders.Authorization = `JWT ${auth.token}`;
  else delete defaultHeaders.Authorization;
  for (const [key, value] of Object.entries(auth)) localStorage.setItem(key, value);
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

  const codeResponse = await fetch(`${ENDPOINTS.sendCode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    code,
  };

  if (isPhone) {
    authBody['phone'] = login;
  } else {
    authBody['email'] = login;
  }

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

module.exports = { createApi, loadAuth, saveAuth, signIn, fetchUsers, fetchPlaybackOptions, fetchFilms };
