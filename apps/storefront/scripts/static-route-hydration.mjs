export function createStaticNavigationLoader(load) {
  const seeds = new Map();
  return async (language) => {
    const key = language.toLowerCase();
    if (!seeds.has(key)) seeds.set(key, load(key));
    try {
      return await seeds.get(key);
    } catch (error) {
      seeds.delete(key);
      throw new Error(`[hydration] Required navigation seed failed for ${key}; stopping the build.`, { cause: error });
    }
  };
}

export async function hydrateStaticRoutes(routes, hydrate) {
  const startedAt = performance.now();
  let completed = 0;
  for (const route of routes) {
    try {
      await hydrate(route);
    } catch (error) {
      throw new Error(
        `[hydration] Required route seed failed for ${route.path}; stopping backend requests and keeping the previous deployment.`,
        { cause: error },
      );
    }
    completed += 1;
    if (completed % 25 === 0 || completed === routes.length) {
      console.log(`[hydration] Completed ${completed}/${routes.length} route seeds in ${((performance.now() - startedAt) / 1000).toFixed(1)}s (${route.path}).`);
    }
  }
}
