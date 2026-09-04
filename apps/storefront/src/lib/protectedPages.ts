import { BACKEND_ORIGIN } from "@funky/sdk";
import { authStore } from "./auth.ts";
import type { CmsPage } from "./pages.ts";

const PROOF_PREFIX = "funkycommerce-page-proof:";

export class ProtectedPageError extends Error {
  readonly kind: "auth-required" | "password-required" | "invalid-password";

  constructor(
    kind: "auth-required" | "password-required" | "invalid-password",
    message: string,
  ) {
    super(message);
    this.name = "ProtectedPageError";
    this.kind = kind;
  }
}

function proofKey(uri: string): string {
  return `${PROOF_PREFIX}${uri}`;
}

function storedProof(uri: string): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(proofKey(uri));
}

async function protectedPageRequest(uri: string, password?: string): Promise<Response | null> {
  if (!BACKEND_ORIGIN) return null;
  const endpoint = new URL("/wp-json/funkycommerce/v1/protected-page", BACKEND_ORIGIN);
  const token = authStore.getToken() || authStore.load()?.authToken;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(token ? { Authorization: "Bearer " + token, "X-WPGraphQL-Login-Token": token } : {}),
  };
  if (password === undefined) {
    endpoint.searchParams.set("uri", uri);
    const proof = storedProof(uri);
    if (proof) headers["X-FunkyCommerce-Page-Proof"] = proof;
    return fetch(endpoint, { cache: "no-store", credentials: "omit", headers });
  }
  headers["Content-Type"] = "application/json";
  return fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    credentials: "omit",
    headers,
    body: JSON.stringify({ uri, password }),
  });
}

export async function getProtectedPageByUri(uri: string): Promise<CmsPage | null> {
  const response = await protectedPageRequest(uri);
  if (!response || response.status === 404) return null;
  if (response.status === 401) throw new ProtectedPageError("auth-required", "Sign in with permission to read this private page.");
  if (response.status === 403) throw new ProtectedPageError("password-required", "This page requires a password.");
  if (!response.ok) throw new Error(`Protected page request failed with status ${response.status}`);
  const page = await response.json() as {
    id: string; databaseId: number; slug: string; uri: string; title: string; content: string; modified: string;
  };
  return {
    ...page,
    cachePrivate: true,
    headlessContent: page.content,
    headlessShortcodes: [],
    templateName: null,
    languageCode: "",
    translations: [],
    author: null,
    featuredImage: null,
    scripts: [],
    themeStyles: {
      customCss: "", fontFaceStyles: "", globalStyles: "", stylesheets: [], colors: [],
      fontFamilies: [], fontSizes: [], gradients: [], spacingSizes: [], contentSize: "", wideSize: "",
    },
    seo: {
      title: null, description: null, keywords: null, canonical: null,
      robots: "noindex, nofollow", robotsSource: "explicit",
      opengraphTitle: null, opengraphDescription: null, opengraphType: null,
      opengraphUrl: null, opengraphImage: null, opengraphPublishedTime: null,
      opengraphPublisher: null, opengraphModifiedTime: null, opengraphAuthor: null,
      siteName: null, twitterTitle: null, twitterDescription: null, breadcrumbs: [],
      pageType: null, articleType: null,
    },
  };
}

export async function unlockProtectedPage(uri: string, password: string): Promise<void> {
  const response = await protectedPageRequest(uri, password);
  if (!response) throw new Error("The protected-page service is not configured.");
  if (response.status === 429) throw new Error("Too many password attempts. Please wait before trying again.");
  if (response.status === 403) throw new ProtectedPageError("invalid-password", "The page password is incorrect.");
  if (!response.ok) throw new Error(`Page unlock failed with status ${response.status}`);
  const payload = await response.json() as { proof?: string };
  if (!payload.proof) throw new Error("The page unlock response did not include proof.");
  if (typeof window !== "undefined") window.sessionStorage.setItem(proofKey(uri), payload.proof);
}
