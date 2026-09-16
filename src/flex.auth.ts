import { EXTENSION_ERROR_CODES, ExtensionError, prompt } from 'azot';
import {
  API_ROUTES,
  type FlexAuth,
  type FlexUser,
  fetchUsers,
  getAuth,
  parseJsonResponse,
  postJson,
  saveAuth,
} from './flex.api';

const clearCookies = async () => {
  const cookies = await cookieStore.getAll();
  await Promise.all(cookies.map((cookie) => cookieStore.delete(cookie.name)));
};

const createSendCodeBody = (login: string) => {
  const isPhone = /^((\+?7)|8)\d{10}$/.test(login);
  return isPhone ? { phone: login } : { email: login };
};

const signIn = async (): Promise<FlexAuth> => {
  console.debug('Signing in FLEX...');

  const { login } = await prompt('Вход в аккаунт FLEX', {
    title: 'FLEX',
    form: {
      login: {
        type: 'text',
        title: 'Введите e-mail или телефон',
        placeholder: 'user@example.com',
        required: true,
        autoFocus: true,
      },
    },
  });
  const sendCodeBody = createSendCodeBody(login);

  await clearCookies();
  const codeResponse = await postJson(API_ROUTES.sendCode, sendCodeBody);
  const codeData = await parseJsonResponse<{ detail?: string; send_type?: string }>(codeResponse);
  if (!codeResponse.ok || codeData?.detail) {
    console.debug(JSON.stringify(codeData));
    throw new ExtensionError({
      code: EXTENSION_ERROR_CODES.RATE_LIMITED,
      message:
        'Неверные данные для входа, или превышено количество попыток входа. Попробуйте позже, или смените IP.',
      operation: 'auth',
    });
  }

  const { code } = await prompt('Подтверждение входа', {
    title: 'FLEX',
    form: {
      code: {
        type: 'text',
        title: 'Введите код, пришедший вам в СМС или на почту',
        required: true,
        autoFocus: true,
      },
    },
  });

  await clearCookies();
  const response = await postJson(API_ROUTES.signIn, { ...sendCodeBody, code });
  const auth = await parseJsonResponse<{ token?: string; user?: { uuid?: string } }>(response);
  if (!response.ok || !auth?.token || !auth.user?.uuid) {
    console.debug(JSON.stringify(auth));
    throw new ExtensionError({
      code: EXTENSION_ERROR_CODES.AUTH_REQUIRED,
      message:
        'Неверные данные для входа, или превышено количество попыток входа. Попробуйте позже, или смените IP.',
      operation: 'auth',
    });
  }

  const savedAuth: FlexAuth = { token: auth.token, uuid: auth.user.uuid ?? '' };
  saveAuth(savedAuth);
  console.debug('Signed in FLEX');
  return savedAuth;
};

const ensureAuth = async (): Promise<FlexAuth> => {
  const auth = getAuth();
  if (auth?.token && auth.uuid) return auth;
  return signIn();
};

const getAuthState = async () => {
  const auth = getAuth();
  if (!auth?.token || !auth.uuid) return { authenticated: false as const };
  let user: string | undefined = auth.username;
  if (!user) {
    try {
      const profile = await fetchUsers();
      user = (profile as FlexUser).username;
      if (user) saveAuth({ ...auth, username: user });
    } catch (error) {
      console.debug(`Failed to fetch FLEX profile: ${error}`);
    }
  }
  return { authenticated: true as const, user };
};

const signOut = async () => {
  saveAuth(null);
  await clearCookies();
};

export { ensureAuth, getAuthState, signIn, signOut };
