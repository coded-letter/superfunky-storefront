import { Link } from "react-router-dom";
import { Seo } from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { useIncrementalData } from "@funky/sdk/react";

type SitemapRoute = {
  path: string;
  lang: string;
  title: string;
  description: string;
  source: "cms" | "stable";
  type: string;
  indexable: boolean;
  listed: boolean;
};

type StaticRouteManifest = {
  version: number;
  generatedAt: string;
  sitemapEnabled: boolean;
  routes: SitemapRoute[];
};

const GROUP_LABELS: Record<string, string> = {
  StorefrontRoute: "Storefront",
  Page: "Pages",
  ExternalProduct: "Products",
  GroupProduct: "Products",
  SimpleProduct: "Products",
  VariableProduct: "Products",
  ProductCategory: "Product categories",
  ProductTag: "Product tags",
  ProductBrand: "Product brands",
  ProductBrandDirectory: "Product brands",
  Post: "Stories",
  Category: "Story categories",
  Tag: "Story tags",
  User: "Authors",
  AuthorDirectory: "Authors",
  CommunityPost: "Community posts",
  CommunityAuthor: "Community authors",
  CommunityAuthorDirectory: "Community authors",
  CommunityTag: "Community tags",
  CommunityTagDirectory: "Community tags",
};

async function getStaticRouteManifest(): Promise<StaticRouteManifest> {
  const response = await fetch("/static-routes.json", { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`The generated sitemap manifest returned status ${response.status}`);
  }
  return response.json() as Promise<StaticRouteManifest>;
}

export function SitemapPage() {
  const { data, isLoading, error } = useIncrementalData("static-route-manifest:v5", getStaticRouteManifest);

  if (isLoading) return <ContentLoadingState label="Loading sitemap" />;
  if (data && !data.sitemapEnabled) {
    return (
      <section className="mx-auto mt-16 grid max-w-lg gap-4 rounded-3xl border border-zinc-200/80 bg-white p-10 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">Sitemap unavailable</h1>
        <p className="m-0 text-zinc-500 dark:text-zinc-400">The public sitemap is disabled in the site Control Center.</p>
        <Link to="/" className="mx-auto text-sm font-semibold text-brand-600 no-underline hover:text-brand-500 dark:text-brand-400">Back to home</Link>
      </section>
    );
  }

  const publicRoutes = (data?.routes || []).filter(({ listed }) => listed);
  const groupedRoutes = new Map<string, SitemapRoute[]>();
  for (const route of publicRoutes) {
    const group = GROUP_LABELS[route.type] || "Other";
    groupedRoutes.set(group, [...(groupedRoutes.get(group) || []), route]);
  }

  return (
    <div className="grid gap-8">
      <Seo
        title="Sitemap"
        description="Browse every public URL available in the latest generated site build."
        canonical="/sitemap"
        schema={{ pageType: "CollectionPage" }}
      />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Sitemap" }]} includeStructuredData={false} />
      <header className="grid gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-600 dark:text-brand-400">Directory</span>
        <h1 className="m-0 font-display text-4xl font-bold text-zinc-900 dark:text-zinc-100">Sitemap</h1>
        <p className="m-0 max-w-2xl text-zinc-500 dark:text-zinc-400">
          Every public URL included in the latest generated site build.
        </p>
      </header>

      {error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error.message}
        </section>
      ) : null}

      {[...groupedRoutes.entries()].map(([group, routes]) => (
        <section key={group} className="grid gap-4 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">{group}</h2>
            <span className="text-xs text-zinc-400">{routes.length}</span>
          </div>
          <ul className="m-0 grid list-none gap-x-8 gap-y-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((route) => (
              <li key={route.path}>
                <Link to={route.path} className="text-sm font-medium text-zinc-700 no-underline hover:text-brand-600 dark:text-zinc-300 dark:hover:text-brand-400">
                  {route.title.replace(/\s+\|\s+(?:FunkyCommerce|Superfunky)$/, "")}
                </Link>
                {route.lang !== "en" ? <span className="ml-2 text-[0.65rem] uppercase text-zinc-400">{route.lang}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
