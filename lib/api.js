'use strict';

const BASE_URL = 'https://back-films.ru/api';
const ENDPOINTS = {
  signIn: `${BASE_URL}/v5/web/auth/login/`,
  sendCode: `${BASE_URL}/v5/mobile/auth/send-code`,
  user: `${BASE_URL}/v4/user`,
  films: `${BASE_URL}/v4/films`,
  episodePlaybackOptions: (slug, id) => `${BASE_URL}/v4/films/${slug}/streams/?episode=${id}`,
};

const createApi = (core) => {
  const loadAuth = async () => {
    await core.store.getState();
    if (core.store.state?.token) core.http.setHeaders({ Authorization: `JWT ${core.store.state.token}` });
    return core.store.state;
  };

  const saveAuth = async (auth) => {
    const headers = {};
    if (auth?.token) headers.Authorization = `JWT ${auth.token}`;
    else core.http.removeHeader('Authorization');
    core.http.setHeaders(headers);
    await core.store.setState(auth || {});
  };

  const signIn = async () => {
    core.log.debug('Signing in FLEX...');

    const { login } = await core.prompt.ask({
      login: { label: 'Введите e-mail или телефон' },
    });
    const isPhone = /^((\+?7)|8)\d{10}$/.test(login);
    
    const sendCodeBody = {};
    
    if (isPhone) {
      sendCodeBody['phone'] = login;
    } else {
      sendCodeBody['email'] = login;
    }
    
    const codeResponse = await core.http.fetchAsChrome(`${ENDPOINTS.sendCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sendCodeBody),
    });
    
    if (codeResponse.status !== 200) {
      throw new Error('Неверные данные для входа, или превышено количество попыток входа. Попробуйте позже, или смените ip.');
    }
    
    const { code } = await core.prompt.ask({
      code: { label: `Введите код, пришедший вам ${isPhone ? 'в СМС-сообщения' : 'на почту'}` }
    })
    
    const authBody = {
      code
    };
    
    if (isPhone) {
      authBody['phone'] = login;
    } else {
      authBody['email'] = login;
    }

    const response = await core.http.fetchAsChrome(`${ENDPOINTS.signIn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authBody),
    });
    
    if (response.status !== 200) {
      throw new Error('Неверные данные для входа, или превышено количество попыток входа. Попробуйте позже, или смените ip.');
    }

    const auth = await response.json();
    const state = { ...core.store.state, token: auth.token, uuid: auth.user.uuid };
    await saveAuth(state);

    return auth;
  };

  const fetchUsers = async () => {
    const response = await core.http.fetchAsChrome(`${ENDPOINTS.user}`);
    return response.json();
  };

  const fetchPlaybackOptions = async (slug, episodeId) => {
    const url = ENDPOINTS.episodePlaybackOptions(slug, episodeId);
    const response = await core.http.fetchAsChrome(url);
    return response.json();
  };
  
  const fetchFilms = async (slug) => {
    const url = `${ENDPOINTS.films}/${slug}`;
    const response = await core.http.fetchAsChrome(url);
    return response.json();
  };

  return {
    loadAuth,
    saveAuth,
    signIn,
    fetchUsers,
    fetchPlaybackOptions,
    fetchFilms,
  };
};

module.exports = { createApi };
