import { BACKEND_ORIGIN } from "@funky/sdk";

type RestEndpoint = {
  methods?: string[];
};

type RestRoute = RestEndpoint & {
  endpoints?: RestEndpoint[];
};

type RestIndex = {
  routes?: Record<string, RestRoute>;
};

function normalizeRoute(route: string): string {
  return `/${route.replace(/^\/+|\/+$/g, "")}`;
}

export function restIndexHasRoute(index: unknown, route: string, method = "GET"): boolean {
  if (!index || typeof index !== "object") return false;
  const routes = (index as RestIndex).routes;
  const entry = routes?.[normalizeRoute(route)];
  if (!entry) return false;
  const normalizedMethod = method.toUpperCase();
  return [entry, ...(entry.endpoints || [])].some((endpoint) =>
    endpoint.methods?.some((registeredMethod) => registeredMethod.toUpperCase() === normalizedMethod),
  );
}

export function createRestRouteAvailability(
  backendOrigin: string | undefined,
  request: typeof fetch = fetch,
) {
  const unavailableRoutes = new Set<string>();
  let restIndexRequest: Promise<RestIndex | null> | undefined;

  function getRestIndex(): Promise<RestIndex | null> {
    if (!backendOrigin) return Promise.resolve(null);
    if (!restIndexRequest) {
      restIndexRequest = request(new URL("/wp-json/", backendOrigin), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) return null;
          const payload: unknown = await response.json().catch(() => null);
          return payload && typeof payload === "object" ? payload as RestIndex : null;
        })
        .catch(() => null);
    }
    return restIndexRequest;
  }

  async function isAvailable(route: string, method = "GET"): Promise<boolean | null> {
    if (!backendOrigin) return false;
    const normalizedMethod = method.toUpperCase();
    const key = `${normalizedMethod}:${normalizeRoute(route)}`;
    if (unavailableRoutes.has(key)) return false;
    const index = await getRestIndex();
    if (!index) return null;
    const available = restIndexHasRoute(index, route, normalizedMethod);
    if (!available) unavailableRoutes.add(key);
    return available;
  }

  async function cacheUnavailableFromResponse(route: string, method: string, response: Response): Promise<void> {
    if (response.status !== 404) return;
    const payload: unknown = await response.clone().json().catch(() => null);
    if (payload && typeof payload === "object" && "code" in payload && payload.code === "rest_no_route") {
      unavailableRoutes.add(`${method.toUpperCase()}:${normalizeRoute(route)}`);
    }
  }

  return { isAvailable, cacheUnavailableFromResponse };
}

const backendRestRoutes = createRestRouteAvailability(BACKEND_ORIGIN);

export const isRestRouteAvailable = backendRestRoutes.isAvailable;
export const cacheRestRouteUnavailableFromResponse = backendRestRoutes.cacheUnavailableFromResponse;
