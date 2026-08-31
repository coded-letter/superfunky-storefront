import { Link } from "react-router-dom";
import { normalizeLanguagePath, ResponsiveImage, useLanguage, useT } from "@funky/ui";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { getProductBrandDirectory } from "../lib/commerce";
import { useIncrementalData } from "@funky/sdk/react";
import { useStorefrontPath } from "../lib/storefrontPaths";
import { ArchiveDirectory, ArchiveDirectoryStatus } from "./ArchiveDirectory";

export function ProductBrandDirectoryPage() {
  const t = useT();
  const shopPath = useStorefrontPath("shop", "/shop");
  const { configuredLanguageCodes, languageCode, languageBackendCode } = useLanguage();
  const directoryPath = normalizeLanguagePath("/product-brand", languageCode, configuredLanguageCodes);
  const { data: brands, isLoading, error } = useIncrementalData(
    `product-brand-directory:v2:${languageCode}`,
    () => getProductBrandDirectory(languageCode, languageBackendCode),
  );

  if (isLoading) return <ContentLoadingState label={t("loading.product_brands")} />;
  if (error) {
    return <ArchiveDirectoryStatus title={t("error.product_brands_unavailable")} message={error.message} href={shopPath} linkLabel={t("archive.back_to_shop")} isError />;
  }

  const entries = brands || [];
  return (
    <ArchiveDirectory
      title={t("archive.product_brands_title")}
      kicker={t("archive.product_brands_kicker")}
      description={t("archive.product_brands_description")}
      canonical={directoryPath}
      parent={{ label: t("nav.shop"), href: shopPath }}
      count={entries.length}
    >
      {entries.length ? (
        <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((brand) => (
            <li key={brand.id}>
              <Link to={normalizeLanguagePath(brand.uri, languageCode, configuredLanguageCodes)} className="group grid h-full gap-4 rounded-3xl border border-zinc-200 bg-white p-5 text-inherit no-underline shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-700">
                {brand.imageUrl ? (
                  <ResponsiveImage src={brand.imageUrl} alt="" sizes="(min-width: 1024px) 20rem, 50vw" className="aspect-[3/2] w-full rounded-2xl object-cover" />
                ) : (
                  <span className="grid aspect-[3/2] place-items-center rounded-2xl bg-zinc-100 font-display text-3xl font-bold text-zinc-300 dark:bg-zinc-800 dark:text-zinc-600">
                    {brand.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="grid gap-1">
                  <strong className="font-display text-xl text-zinc-900 group-hover:text-brand-600 dark:text-zinc-100 dark:group-hover:text-brand-400">{brand.name}</strong>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">{t("archive.brand_product_count", { count: brand.count })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ArchiveDirectoryStatus title={t("archive.no_brands")} message={t("archive.no_brands_message")} href={shopPath} linkLabel={t("archive.browse_products")} />
      )}
    </ArchiveDirectory>
  );
}
