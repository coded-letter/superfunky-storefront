export function buildStoreApiHeaders(options: {
  authToken: string | null;
  cartToken: string | null;
  nonce: string | null;
  isStateChanging: boolean;
}): Record<string, string> {
  const { authToken, cartToken, nonce, isStateChanging } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    const token = authToken.replace(/^Bearer\s+/i, "");
    headers.Authorization = `Bearer ${token}`;
    headers["X-WPGraphQL-Login-Token"] = token;
  }

  if (cartToken) {
    headers["Cart-Token"] = cartToken;
  } else if (isStateChanging && nonce) {
    headers.Nonce = nonce;
  }

  return headers;
}

export function isStoreApiNonceError(message: string): boolean {
  return /(?:missing|invalid|expired).{0,30}nonce|nonce.{0,30}(?:missing|invalid|expired)/i.test(message);
}
