import { Link } from "react-router-dom";
import { ResponsiveImage } from "@funky/ui";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { getProductBrandDirectory } from "../lib/commerce";
import { useIncrementalData } from "@funky/sdk/react";
import { useStorefrontPath } from "../lib/storefrontPaths";
import { ArchiveDirectory, ArchiveDirectoryStatus } from "./ArchiveDirectory";

export function ProductBrandDirectoryPage() {
  const shopPath = useStorefrontPath("shop", "/shop");
  const { data: brands, isLoading, error } = useIncrementalData(
    "product-brand-directory:v1",
    getProductBrandDirectory,
  );

  if (isLoading) return <ContentLoadingState label="Loading product brands" />;
  if (error) {
    return <ArchiveDirectoryStatus title="Product brands unavailable" message={error.message} href={shopPath} linkLabel="Back to shop" isError />;
  }

  const entries = brands || [];
  return (
    <ArchiveDirectory
      title="Product brands"
      kicker="Shop by maker"
      description="Browse every brand with products available in the Superfunky catalog."
      canonical="/product-brand"
      parent={{ label: "Shop", href: shopPath }}
      count={entries.length}
    >
      {entries.length ? (
        <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((brand) => (
            <li key={brand.id}>
              <Link to={brand.uri} className="group grid h-full gap-4 rounded-3xl border border-zinc-200 bg-white p-5 text-inherit no-underline shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-700">
                {brand.imageUrl ? (
                  <ResponsiveImage src={brand.imageUrl} alt="" sizes="(min-width: 1024px) 20rem, 50vw" className="aspect-[3/2] w-full rounded-2xl object-cover" />
                ) : (
                  <span className="grid aspect-[3/2] place-items-center rounded-2xl bg-zinc-100 font-display text-3xl font-bold text-zinc-300 dark:bg-zinc-800 dark:text-zinc-600">
                    {brand.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="grid gap-1">
                  <strong className="font-display text-xl text-zinc-900 group-hover:text-brand-600 dark:text-zinc-100 dark:group-hover:text-brand-400">{brand.name}</strong>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">{brand.count} {brand.count === 1 ? "product" : "products"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ArchiveDirectoryStatus title="No product brands yet" message="No non-empty product brands are currently published." href={shopPath} linkLabel="Browse products" />
      )}
    </ArchiveDirectory>
  );
}
