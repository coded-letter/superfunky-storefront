/** Frontend auth session plumbing — a TypeScript rewrite of the legacy prototype's
 * `tokenStore.js` + `refreshToken.js` + `heartBeat.js` trio, wired to this backend's
 * real WPGraphQL mutations instead of a REST endpoint. This WordPress install runs the
 * AxeWP "Headless Login for WPGraphQL" plugin (confirmed via schema introspection),
 * which exposes `login`/`refreshToken` mutations — a different, newer shape than the
 * legacy Gatsby prototype's `refreshJwtAuthToken` (the older `wp-graphql-jwt-
 * authentication` plugin). Every export safely no-ops when `VITE_GRAPHQL_ENDPOINT`
 * isn't configured, so pages can call these unconditionally without special-casing the
 * mockup environment. */

import { useEffect, useRef, useState } from "react";
import { graphqlRequest, isBackendConfigured } from "@funky/sdk";
import { omitUnsupportedLoginPayloadFields } from "./authGraphqlCompatibility.ts";

const STORAGE_KEY = "funkycommerce-auth";

export const isAuthBackendConfigured = isBackendConfigured;

export type StoredAuth = {
  authToken: string;
  refreshToken: string;
  /** Unix seconds. */
  authTokenExpiration?: number;
  refreshTokenExpiration?: number;
  sessionToken?: string;
  cartToken?: string;
  user?: { databaseId?: number; email?: string; displayName?: string };
};

export type LoginProvider =
  | "FACEBOOK"
  | "GITHUB"
  | "GOOGLE"
  | "INSTAGRAM"
  | "LINKEDIN"
  | "OAUTH2_GENERIC"
  | "PASSWORD"
  | "SITETOKEN";

export type LoginClient = {
  name: string;
  provider: LoginProvider;
  isEnabled: boolean;
  authorizationUrl: string | null;
  order: number;
};

let inMemoryToken: string | null = null;
const authListeners = new Set<() => void>();

/** Mirrors the legacy `authStore` — an in-memory cache of just the access token (fast,
 * synchronous reads for things like a fetch/GraphQL auth-header link) backed by a
 * localStorage-persisted full auth record (survives reloads). */
export const authStore = {
  subscribe(listener: () => void): () => void {
    authListeners.add(listener);
    return () => authListeners.delete(listener);
  },

  load(): StoredAuth | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) || window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as StoredAuth;
      if (data?.authToken) inMemoryToken = data.authToken;
      return data;
    } catch {
      return null;
    }
  },

  getToken(): string | null {
    return inMemoryToken;
  },

  save(data: StoredAuth, persistent = true): void {
    inMemoryToken = data.authToken;
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    (persistent ? window.localStorage : window.sessionStorage).setItem(STORAGE_KEY, JSON.stringify(data));
    authListeners.forEach((listener) => listener());
  },

  clear(): void {
    inMemoryToken = null;
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    authListeners.forEach((listener) => listener());
  },
};

const isDev = import.meta.env?.DEV === true;
const devLog = (...args: unknown[]) => {
  if (isDev) console.log("[auth]", ...args);
};

const CORE_LOGIN_FIELDS = /* GraphQL */ `
  authToken
  refreshToken
  authTokenExpiration
  refreshTokenExpiration
  user {
    databaseId
    email
    name
  }
`;

const LOGIN_FIELDS = /* GraphQL */ `
  ${CORE_LOGIN_FIELDS}
  sessionToken
  cartToken
  customer {
    databaseId
    email
    displayName
  }
`;

const PASSWORD_LOGIN_MUTATION = /* GraphQL */ `
  mutation StorefrontPasswordLogin($username: String!, $password: String!) {
    login(input: { provider: PASSWORD, credentials: { username: $username, password: $password } }) {
      ${LOGIN_FIELDS}
    }
  }
`;

const PROVIDER_LOGIN_MUTATION = /* GraphQL */ `
  mutation StorefrontProviderLogin($provider: LoginProviderEnum!, $code: String!, $state: String) {
    login(input: { provider: $provider, oauthResponse: { code: $code, state: $state } }) {
      ${LOGIN_FIELDS}
    }
  }
`;

const LOGIN_CLIENTS_QUERY = /* GraphQL */ `
  query StorefrontLoginClients {
    loginClients {
      name
      provider
      isEnabled
      authorizationUrl
      order
    }
  }
`;

type LoginPayload = {
  authToken: string | null;
  refreshToken: string | null;
  authTokenExpiration: string | number | null;
  refreshTokenExpiration: string | number | null;
  sessionToken?: string | null;
  cartToken?: string | null;
  user: { databaseId: number; email: string | null; name: string | null } | null;
  customer?: { databaseId: number; email: string | null; displayName: string | null } | null;
};

type LoginResult = {
  login: LoginPayload | null;
};

async function requestCompatibleLogin(
  mutation: string,
  variables: Record<string, unknown>,
): Promise<LoginPayload> {
  let response = await graphqlRequest<LoginResult>(mutation, variables);
  const compatibleMutation = omitUnsupportedLoginPayloadFields(mutation, response.errors);
  if (compatibleMutation) {
    response = await graphqlRequest<LoginResult>(compatibleMutation, variables);
  }
  if (response.errors?.length || !response.data?.login) {
    throw new Error(response.errors?.map(({ message }) => message).join("; ") || "Login failed");
  }
  return response.data.login;
}

function saveLoginPayload(payload: LoginPayload, persistent = true): StoredAuth {
  if (!payload.authToken || !payload.refreshToken) throw new Error("The login response did not include authentication tokens");
  const identity = payload.customer || payload.user;
  const stored: StoredAuth = {
    authToken: payload.authToken,
    refreshToken: payload.refreshToken,
    authTokenExpiration: Number(payload.authTokenExpiration) || undefined,
    refreshTokenExpiration: Number(payload.refreshTokenExpiration) || undefined,
    sessionToken: payload.sessionToken || undefined,
    cartToken: payload.cartToken || undefined,
    user: identity
      ? {
          databaseId: identity.databaseId,
          email: identity.email || undefined,
          displayName: "displayName" in identity ? identity.displayName || undefined : identity.name || undefined,
        }
      : undefined,
  };
  authStore.save(stored, persistent);
  return stored;
}

export async function getLoginClients(): Promise<LoginClient[]> {
  const { data, errors } = await graphqlRequest<{ loginClients: LoginClient[] | null }>(LOGIN_CLIENTS_QUERY);
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  return (data?.loginClients || [])
    .filter((client) => client.isEnabled)
    .sort((left, right) => left.order - right.order);
}

let loginClientsPromise: Promise<LoginClient[]> | null = null;
let loginClientsCache: LoginClient[] | null = null;

export function useLoginClients(): { clients: LoginClient[]; isLoading: boolean; error: Error | null } {
  const [state, setState] = useState<{ clients: LoginClient[]; isLoading: boolean; error: Error | null }>({
    clients: loginClientsCache || [],
    isLoading: !loginClientsCache,
    error: null,
  });
  useEffect(() => {
    if (loginClientsCache) return undefined;
    let cancelled = false;
    loginClientsPromise ||= getLoginClients().finally(() => {
      loginClientsPromise = null;
    });
    loginClientsPromise
      .then((clients) => {
        loginClientsCache = clients;
        if (!cancelled) setState({ clients, isLoading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ clients: [], isLoading: false, error: error instanceof Error ? error : new Error("Login providers could not be loaded") });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

/** Logs in with the Password provider configured by Headless Login for WPGraphQL. */
export async function login(username: string, password: string, rememberMe = false): Promise<StoredAuth> {
  if (!isBackendConfigured) throw new Error("The authentication backend is not configured");
  const payload = await requestCompatibleLogin(
    PASSWORD_LOGIN_MUTATION,
    { username, password },
  );
  return saveLoginPayload(payload, rememberMe);
}

export async function loginWithProvider(provider: LoginProvider, code: string, state?: string): Promise<StoredAuth> {
  if (provider === "PASSWORD") throw new Error("Password login requires credentials");
  if (provider === "SITETOKEN") throw new Error("Site Token login must be exchanged by a trusted server-side identity provider");
  if (!code) throw new Error("The provider did not return an authorization code");
  const payload = await requestCompatibleLogin(
    PROVIDER_LOGIN_MUTATION,
    { provider, code, state: state || null },
  );
  return saveLoginPayload(payload);
}

export async function registerCustomer(input: {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword?: string;
}): Promise<StoredAuth | null> {
  const { firstName, lastName, username, email, password } = input;
  const { data, errors } = await graphqlRequest<{
    registerCustomer: {
      authToken: string | null;
      refreshToken: string | null;
      customer: { databaseId: number; email: string; displayName: string } | null;
    } | null;
  }>(
    `mutation StorefrontRegisterCustomer($input: RegisterCustomerInput!) {
      registerCustomer(input: $input) {
        authToken
        refreshToken
        customer { databaseId email displayName }
      }
    }`,
    {
      input: {
        firstName,
        lastName,
        email,
        password,
        username,
        displayName: `${firstName} ${lastName}`.trim(),
        authenticate: true,
      },
    },
  );
  if (errors?.length || !data?.registerCustomer) throw new Error(errors?.map(({ message }) => message).join("; ") || "Registration failed");
  const result = data.registerCustomer;
  if (!result.authToken || !result.refreshToken) return null;
  const stored: StoredAuth = {
    authToken: result.authToken,
    refreshToken: result.refreshToken,
    user: result.customer
      ? { databaseId: result.customer.databaseId, email: result.customer.email, displayName: result.customer.displayName }
      : undefined,
  };
  authStore.save(stored);
  return stored;
}

export async function sendPasswordResetEmail(username: string): Promise<void> {
  const { data, errors } = await graphqlRequest<{ sendPasswordResetEmail: { success: boolean } | null }>(
    `mutation StorefrontSendPasswordReset($username: String!) {
      sendPasswordResetEmail(input: { username: $username }) { success }
    }`,
    { username },
  );
  if (errors?.length || !data?.sendPasswordResetEmail?.success) {
    throw new Error(errors?.map(({ message }) => message).join("; ") || "The reset email could not be sent");
  }
}

export async function resetUserPassword(key: string, loginName: string, password: string): Promise<void> {
  const { data, errors } = await graphqlRequest<{ resetUserPassword: { user: { id: string } | null } | null }>(
    `mutation StorefrontResetPassword($key: String!, $login: String!, $password: String!) {
      resetUserPassword(input: { key: $key, login: $login, password: $password }) { user { id } }
    }`,
    { key, login: loginName, password },
  );
  if (errors?.length || !data?.resetUserPassword?.user) {
    throw new Error(errors?.map(({ message }) => message).join("; ") || "The password could not be reset");
  }
}

const REFRESH_TOKEN_MUTATION = /* GraphQL */ `
  mutation StorefrontRefreshToken($refreshToken: String!) {
    refreshToken(input: { refreshToken: $refreshToken }) {
      authToken
      authTokenExpiration
      success
    }
  }
`;

type RefreshTokenResult = {
  refreshToken: { authToken: string; authTokenExpiration: string | number; success: boolean } | null;
};

let refreshPromise: Promise<string | null> | null = null;

/** Refreshes the stored access token against the real `refreshToken` GraphQL mutation.
 * Concurrent calls share a single in-flight request (mirrors the legacy module-level
 * `refreshPromise` guard) so e.g. a heartbeat tick and a 401-triggered retry never race
 * each other into double-refreshing. Any failure clears the stored session (forced
 * logout), matching the legacy behaviour. Resolves to `null` immediately, with no
 * network call, when no backend is configured yet. */
export async function performRefresh(): Promise<string | null> {
  const auth = authStore.load();
  if (!auth?.refreshToken) {
    devLog("no refresh token stored");
    return null;
  }

  if (!isBackendConfigured) {
    devLog("no backend configured — skipping network refresh");
    return null;
  }

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const { data, errors } = await graphqlRequest<RefreshTokenResult>(REFRESH_TOKEN_MUTATION, { refreshToken: auth.refreshToken });
      if (errors?.length || !data?.refreshToken?.success || !data.refreshToken.authToken) {
        throw new Error(errors?.[0]?.message ?? "Refresh token mutation did not succeed");
      }

      const updated: StoredAuth = {
        ...auth,
        authToken: data.refreshToken.authToken,
        authTokenExpiration: Number(data.refreshToken.authTokenExpiration) || auth.authTokenExpiration,
      };
      authStore.save(updated);
      devLog("token refreshed");
      return data.refreshToken.authToken;
    } catch (error) {
      devLog("refresh failed, clearing session", error);
      authStore.clear();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function isUserLoggedIn(): boolean {
  return Boolean(authStore.load()?.authToken);
}

export function useIsUserLoggedIn(): boolean {
  return useBackgroundAuthSnapshot((auth) => Boolean(auth?.authToken), false);
}

function accountIdFromAuth(auth: StoredAuth | null): string | null {
  const userId = Number(auth?.user?.databaseId);
  if (Number.isInteger(userId) && userId > 0) return String(userId);

  // Sessions created by older storefront versions may predate the stored user id.
  // The signed JWT's stable subject still gives saved lists an account scope without
  // using the access token itself (which changes on refresh).
  const payload = auth?.authToken?.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized)) as { sub?: unknown; data?: { user?: { id?: unknown } } };
    const tokenUserId = Number(decoded.data?.user?.id ?? decoded.sub);
    return Number.isInteger(tokenUserId) && tokenUserId > 0 ? String(tokenUserId) : null;
  } catch {
    return null;
  }
}

/** A stable account key for state that must never cross logout/account switches. */
export function useAuthenticatedAccountId(): string | null {
  return useBackgroundAuthSnapshot(accountIdFromAuth, null);
}

function useBackgroundAuthSnapshot<T>(select: (auth: StoredAuth | null) => T, initialValue: T): T {
  const [value, setValue] = useState<T>(initialValue);
  const selectRef = useRef(select);
  selectRef.current = select;

  useEffect(() => {
    let active = true;
    const loadSnapshot = () => {
      if (active) setValue(selectRef.current(authStore.load()));
    };
    const cancelInitialLoad = "requestIdleCallback" in window
      ? (() => {
          const handle = window.requestIdleCallback(loadSnapshot, { timeout: 1_000 });
          return () => window.cancelIdleCallback(handle);
        })()
      : (() => {
          const handle = window.setTimeout(loadSnapshot, 0);
          return () => window.clearTimeout(handle);
        })();
    const unsubscribe = authStore.subscribe(loadSnapshot);

    return () => {
      active = false;
      cancelInitialLoad();
      unsubscribe();
    };
  }, []);

  return value;
}

export function logOut(): void {
  authStore.clear();
}

const HEARTBEAT_INTERVAL_MS = 60_000; // Check every minute.
const REFRESH_BUFFER_SECONDS = 90; // Refresh 90s before expiry, not exactly at expiry.

/** Returns a usable access token for non-GraphQL backend requests. Refreshing here
 * prevents a checkout started near token expiry from silently becoming a guest order. */
export async function getAuthTokenForRequest(): Promise<string | null> {
  const auth = authStore.load();
  if (!auth?.authToken) return null;

  const now = Math.floor(Date.now() / 1000);
  if (auth.authTokenExpiration && now >= auth.authTokenExpiration - REFRESH_BUFFER_SECONDS) {
    return performRefresh();
  }

  return auth.authToken;
}

/** Session-keepalive heartbeat — ports the legacy `useAuthHeartbeat` hook. Polls the
 * stored token's expiry every minute and calls `performRefresh()` shortly before it
 * lapses, so a signed-in visitor's session survives long idle tabs without needing a
 * page reload. A no-op (never sets an interval) when nobody is signed in, and resolves
 * to nothing but a harmless no-network `performRefresh()` call while no backend is
 * configured — safe to mount unconditionally near the app root. */
export function useAuthHeartbeat(): void {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    devLog("heartbeat mounted");

    const refreshIfNeeded = () => {
      const auth = authStore.load();
      if (!auth?.authTokenExpiration || !auth?.authToken || !auth?.refreshToken) return;

      const now = Math.floor(Date.now() / 1000);
      const shouldRefresh = now >= auth.authTokenExpiration - REFRESH_BUFFER_SECONDS;
      if (shouldRefresh) void performRefresh();
    };
    // Session restoration is an enhancement, never a content prerequisite. Start the
    // network check after the current paint and never await it from the application shell.
    const initialCheck = window.setTimeout(refreshIfNeeded, 0);
    const interval = window.setInterval(refreshIfNeeded, HEARTBEAT_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") window.setTimeout(refreshIfNeeded, 0);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
}
