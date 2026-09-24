function waitForResponse(pending, signal) {
  if (!signal) return pending;
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    pending.then((result) => {
      signal.removeEventListener("abort", abort);
      resolve(result);
    }, (error) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
}

export function createStaticBuildFetch(request, graphqlEndpoint) {
  const graphqlUrl = new URL(graphqlEndpoint);
  const restArchives = new Set([
    "/wp-json/wc/store/v1/products",
    "/wp-json/wp/v2/categories",
    "/wp-json/wp/v2/tags",
  ].map((path) => new URL(path, graphqlUrl).href));
  const responses = new Map();
  const schemaErrors = new Map();

  return async (input, init = {}) => {
    if (input instanceof Request) return request(input, init);
    const url = new URL(String(input));
    const method = (init.method || "GET").toUpperCase();
    const headers = new Headers(init.headers);
    if (headers.has("authorization") || headers.has("cookie") || headers.has("x-wpgraphql-login-token") || init.credentials === "include") {
      return request(input, init);
    }
    const isArchive = method === "GET" && restArchives.has(`${url.origin}${url.pathname}`);
    let isQuery = false;
    let schemaKey = "";
    let requestBody = init.body || "";
    if (method === "POST" && url.href === graphqlUrl.href && typeof init.body === "string") {
      const body = JSON.parse(init.body);
      isQuery = typeof body.query === "string"
        && /^\s*(?:query\b|\{)/.test(body.query)
        && !/\b(?:mutation|subscription)\b/.test(body.query);
      if (isQuery) schemaKey = JSON.stringify([body.query, [...headers]]);
      if (isQuery) {
        const usedVariables = new Set(body.query.match(/\$[_A-Za-z][_0-9A-Za-z]*/g) || []);
        requestBody = JSON.stringify({
          ...body,
          variables: Object.fromEntries(Object.entries(body.variables || {})
            .filter(([name]) => usedVariables.has(`$${name}`))
            .sort(([left], [right]) => left.localeCompare(right))),
        });
      }
    }
    if (!isArchive && !isQuery) return request(input, init);
    init.signal?.throwIfAborted();
    if (schemaErrors.has(schemaKey)) return schemaErrors.get(schemaKey).clone();
    const key = JSON.stringify([url.href, method, [...headers], requestBody]);
    let pending = responses.get(key);
    if (!pending) {
      pending = (async () => {
        const response = await request(input, init);
        if (!response.ok && !(isQuery && response.status === 400)) return { response, cacheable: false };
        const payload = await response.clone().json();
        // Schema validation is independent of route variables; resolver errors are not.
        if (isQuery && !payload?.data && payload?.errors?.length
          && payload.errors.every(({ message }) => /^(?:Cannot query field|Unknown argument|Unknown type) "/i.test(message))) {
          schemaErrors.set(schemaKey, response.clone());
          if (schemaErrors.size > 256) schemaErrors.delete(schemaErrors.keys().next().value);
        }
        const cacheable = response.ok && (isArchive
          ? Array.isArray(payload)
          : Boolean(payload?.data) && !payload.errors?.length);
        return { response, cacheable };
      })();
      responses.set(key, pending);
      if (responses.size > 256) responses.delete(responses.keys().next().value);
    }
    try {
      const { response, cacheable } = await waitForResponse(pending, init.signal);
      if (!cacheable && responses.get(key) === pending) responses.delete(key);
      init.signal?.throwIfAborted();
      return response.clone();
    } catch (error) {
      if (responses.get(key) === pending) responses.delete(key);
      throw error;
    }
  };
}
