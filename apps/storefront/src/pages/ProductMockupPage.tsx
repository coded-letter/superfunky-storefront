import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ProductCard,
  ProductGallery,
  Seo,
  resolveVariationSwatchColor,
  useCart,
  useCurrency,
  useLanguage,
  useWishlist,
  type ProductGalleryImage,
} from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { useIncrementalData } from "../lib/incrementalData";
import { getProductByUriOrSlug, normalizeProductDetail, type CmsProductDetail } from "../lib/commerce";
import { createReview } from "../lib/comments";
import { useStorefrontPath } from "../lib/storefrontPaths";
import { CommentsSection, summarizeReviews } from "./CommentThread";
import type { ProductVariationCombo } from "./shared";

export function ProductMockupPage() {
  const { pathname } = useLocation();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { languageCode, hasLanguagePreference, syncLanguageCode } = useLanguage();
  const identifier = pathname.startsWith("/shop/") && slug ? slug : pathname;
  const { data: product, isLoading, error } = useIncrementalData(
    `product:${identifier}`,
    () => getProductByUriOrSlug(identifier),
  );
  const normalizedProduct = product ? normalizeProductDetail(product) : null;

  useEffect(() => {
    if (!normalizedProduct) return;
    if (!hasLanguagePreference) {
      syncLanguageCode(normalizedProduct.languageCode);
      return;
    }
    if (normalizedProduct.languageCode.toLowerCase() === languageCode.toLowerCase()) return;
    const translation = normalizedProduct.translations.find((item) => item.languageCode.toLowerCase() === languageCode.toLowerCase());
    if (translation?.uri && translation.uri !== pathname) navigate(translation.uri);
  }, [hasLanguagePreference, languageCode, navigate, normalizedProduct, pathname, syncLanguageCode]);

  if (isLoading) return <ContentLoadingState label="Loading product" />;
  if (error) return <ProductStatus title="Product unavailable" message={error.message} />;
  if (!normalizedProduct) return <ProductStatus title="Product not found" message={`WooCommerce has no published product matching “${identifier}”.`} />;

  return <ProductTemplate key={normalizedProduct.id} product={normalizedProduct} />;
}

function ProductTemplate({ product }: { product: CmsProductDetail }) {
  const shopPath = useStorefrontPath("shop", "/shop");
  const { formatBaseAmount, currencyCode, convertSelectedToBase } = useCurrency();

  /** Returns the display price for the given base amount.
   *  When a manual per-currency override exists in currencyPrices, it takes
   *  precedence over rate conversion so the displayed price is exact. */
  const formatProductPrice = (baseAmount: number | undefined): string | undefined => {
    if (baseAmount === undefined) return undefined;
    const manualPrice = product.currencyPrices[currencyCode];
    // manualPrice is already in the selected currency — convert it back to base
    // so formatBaseAmount can apply its standard rate conversion, yielding the exact value.
    return formatBaseAmount(manualPrice !== undefined ? convertSelectedToBase(manualPrice) : baseAmount);
  };

  const { addItem, openDrawer } = useCart();
  const { has, toggle } = useWishlist();
  const [quantity, setQuantity] = useState(1);
  const defaultVariation = product.variationCombos.find((combo) => combo.inStock) || product.variationCombos[0];
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() =>
    defaultVariation?.options ||
    Object.fromEntries(product.variationOptions.map((option) => [option.label, option.values[0] || ""])),
  );

  const selectedVariation = useMemo(
    () => product.variationCombos.find((combo) => matchesSelection(combo, selectedOptions)) || null,
    [product.variationCombos, selectedOptions],
  );
  const isVariable = product.card.commerceProductType === "variable";
  const isExternal = product.card.commerceProductType === "external";
  const isGrouped = product.card.commerceProductType === "grouped";
  const canPurchase = isVariable ? Boolean(selectedVariation?.inStock) : Boolean(product.card.inStock);
  const priceAmount = selectedVariation?.priceAmount ?? product.card.priceAmount;
  const price = formatProductPrice(priceAmount) ?? selectedVariation?.priceLabel ?? product.card.priceLabel;
  const gallery = mapGallery(product);
  const selectedGalleryImageId = selectedVariation?.imageUrl
    ? gallery.find((image) => image.src === selectedVariation.imageUrl)?.id
    : undefined;
  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Shop", href: shopPath },
    ...product.categories.slice(0, 1).map((category) => ({ label: category.name, href: category.uri })),
    { label: product.name },
  ];
  const reviewSummary = summarizeReviews(product.reviews);

  const selectVariationOption = (label: string, value: string) => {
    const nextOptions = { ...selectedOptions, [label]: value };
    const exactMatch = product.variationCombos.find((combo) => matchesSelection(combo, nextOptions));
    const fallbackMatch =
      product.variationCombos.find((combo) => combo.options[label] === value && combo.inStock) ||
      product.variationCombos.find((combo) => combo.options[label] === value);
    setSelectedOptions(exactMatch?.options || fallbackMatch?.options || nextOptions);
  };

  const addToCart = () => {
    if (!canPurchase) return;
    const variantLabel = Object.values(selectedOptions).filter(Boolean).join(" / ") || undefined;
    addItem(
      {
        id: selectedVariation?.id || product.id,
        backendProductId: product.databaseId,
        backendVariationId: selectedVariation?.databaseId,
        variationAttributes: selectedVariation?.options,
        name: product.name,
        variantLabel,
        imageUrl: selectedVariation?.imageUrl || product.card.imageUrl,
        priceLabel: price,
        priceAmount,
      },
      quantity,
    );
    openDrawer();
  };

  return (
    <div className="grid gap-12">
      <Seo
        title={product.seo.title || product.name}
        description={product.seo.description || product.seo.opengraphDescription || stripHtml(product.shortDescriptionHtml)}
        canonical={product.seo.canonical || product.seo.opengraphUrl || product.uri}
        languageCode={product.languageCode}
        keywords={product.seo.keywords || undefined}
        siteName={product.seo.siteName || undefined}
        appendSiteName={false}
        robots={product.seo.robots}
        opengraphType="product"
        opengraphTitle={product.seo.opengraphTitle || product.name}
        opengraphDescription={product.seo.opengraphDescription || undefined}
        opengraphImage={product.seo.opengraphImage || product.card.imageUrl}
        twitterTitle={product.seo.twitterTitle || undefined}
        twitterDescription={product.seo.twitterDescription || undefined}
        schema={{ pageType: product.seo.pageType || "ItemPage" }}
        breadcrumbs={product.seo.breadcrumbs}
        translations={product.translations.map((translation) => ({
          languageCode: translation.languageCode,
          url: translation.uri,
        }))}
      />
      <Breadcrumbs items={breadcrumbs} includeStructuredData={false} />

      <section className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
        <ProductGallery images={gallery} selectedImageId={selectedGalleryImageId} />

        <div className="grid content-start gap-6">
          <div className="flex flex-wrap items-center gap-2">
            {product.card.badge ? (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                {product.card.badge}
              </span>
            ) : null}
            <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${canPurchase ? "text-emerald-600" : "text-rose-500"}`}>
              {canPurchase ? "In stock" : "Out of stock"}
            </span>
          </div>

          <div className="grid gap-3">
            <h1 className="m-0 font-display text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">{product.name}</h1>
            {(product.card.rating || 0) > 0 ? (
              <a href="#product-reviews" className="w-fit no-underline">
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  ★ {product.card.rating?.toFixed(1)} ({product.card.reviewCount || 0} reviews)
                </span>
              </a>
            ) : null}
            <p className="m-0 text-2xl font-bold text-zinc-950 dark:text-zinc-50">{price || "Price unavailable"}</p>
          </div>

          {product.shortDescriptionHtml ? (
            <div
              className="prose prose-zinc max-w-none text-sm dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: product.shortDescriptionHtml }}
            />
          ) : null}

          {product.variationOptions.map((option) => (
            <fieldset key={option.label} className="grid gap-2 border-0 p-0">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{option.label}</legend>
              <div className="flex flex-wrap gap-2">
                {option.values.map((value) => {
                  const swatchColor = resolveVariationSwatchColor(option.label, value, option.swatches?.[value]);
                  const isSelected = selectedOptions[option.label] === value;
                  return swatchColor ? (
                    <button
                      key={value}
                      type="button"
                      title={value}
                      aria-label={value}
                      aria-pressed={isSelected}
                      onClick={() => selectVariationOption(option.label, value)}
                      style={{ backgroundColor: swatchColor }}
                      className={`h-8 w-8 rounded-full border border-black/10 transition hover:scale-105 dark:border-white/20 ${
                        isSelected ? "ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-zinc-950" : ""
                      }`}
                    />
                  ) : (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => selectVariationOption(option.label, value)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        isSelected
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className="flex flex-wrap gap-3">
            {!isExternal && !isGrouped ? (
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Quantity
                <input
                  type="number"
                  min={1}
                  max={selectedVariation?.stockQuantity || product.card.stockQuantity || undefined}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                  className="w-24 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
            ) : null}
            {isExternal && product.card.externalUrl ? (
              <a
                href={product.card.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="self-end rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white no-underline hover:bg-brand-700"
              >
                {product.externalButtonText || "Buy product"}
              </a>
            ) : (
              <button
                type="button"
                disabled={!canPurchase || isGrouped}
                onClick={addToCart}
                className="self-end rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGrouped ? "Grouped product" : isVariable && !selectedVariation ? "Choose available options" : "Add to cart"}
              </button>
            )}
            <button
              type="button"
              aria-pressed={has(product.card.id)}
              onClick={() => toggle(product.card.id)}
              className="self-end rounded-full border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
            >
              {has(product.card.id) ? "Saved to wishlist" : "Add to wishlist"}
            </button>
          </div>

          <dl className="grid gap-2 border-t border-zinc-200 pt-5 text-sm dark:border-zinc-800">
            {product.sku ? <MetaRow label="SKU" value={product.sku} /> : null}
            {product.categories.length ? (
              <MetaLinks label="Categories" items={product.categories.map((item) => ({ name: item.name, uri: item.uri }))} />
            ) : null}
            {product.brands.length ? (
              <MetaLinks label="Brands" items={product.brands.map((item) => ({ name: item.name, uri: item.uri }))} />
            ) : null}
            {product.tags.length ? <MetaLinks label="Tags" items={product.tags.map((item) => ({ name: item.name, uri: item.uri }))} /> : null}
          </dl>
        </div>
      </section>

      {product.descriptionHtml || product.attributes.length ? (
        <section className="grid gap-8 border-t border-zinc-200 pt-10 dark:border-zinc-800 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <h2 className="font-display text-2xl font-bold">Product details</h2>
            {product.descriptionHtml ? (
              <div className="prose prose-zinc max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
            ) : null}
          </div>
          {product.attributes.length ? (
            <dl className="grid content-start gap-3 rounded-2xl bg-zinc-50 p-6 text-sm dark:bg-zinc-900">
              {product.attributes.map((attribute) => (
                <MetaRow key={attribute.name} label={attribute.name} value={attribute.options.join(", ")} />
              ))}
            </dl>
          ) : null}
        </section>
      ) : null}

      <CommentsSection
        anchorId="product-reviews"
        heading="Customer reviews"
        initialReviews={product.reviews}
        averageRating={product.card.rating || undefined}
        ratingHistogram={reviewSummary.averageRating ? reviewSummary.histogram : undefined}
        totalCountOverride={product.card.reviewCount || 0}
        formTitle="Review this product"
        onSubmitReview={(review) => createReview({
          commentOn: product.databaseId,
          author: review.author,
          authorEmail: review.email,
          content: review.content,
          rating: review.rating,
        })}
        onSubmitReply={(parent, reply) => {
          if (!parent.databaseId) throw new Error("This review cannot be replied to because its WordPress ID is unavailable.");
          return createReview({
            commentOn: product.databaseId,
            author: reply.author,
            authorEmail: reply.email,
            content: reply.content,
            parent: parent.databaseId,
          });
        }}
      />

      <ProductConnections title="Related products" products={product.related} />
      <ProductConnections title="You may also like" products={product.upsells} />
      <ProductConnections title="Frequently bought together" products={product.crossSells} />
    </div>
  );
}

function ProductConnections({ title, products }: { title: string; products: CmsProductDetail["related"] }) {
  if (!products.length) return null;
  return (
    <section className="grid gap-6">
      <h2 className="m-0 font-display text-2xl font-bold text-zinc-950 dark:text-zinc-50">{title}</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3">
      <dt className="font-semibold text-zinc-500">{label}</dt>
      <dd className="m-0 text-zinc-800 dark:text-zinc-200">{value}</dd>
    </div>
  );
}

function MetaLinks({ label, items }: { label: string; items: { name: string; uri: string }[] }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3">
      <dt className="font-semibold text-zinc-500">{label}</dt>
      <dd className="m-0 flex flex-wrap gap-x-2">
        {items.map((item) => <Link key={item.uri} to={item.uri} className="text-brand-600 hover:underline">{item.name}</Link>)}
      </dd>
    </div>
  );
}

function ProductStatus({ title, message }: { title: string; message: string }) {
  const shopPath = useStorefrontPath("shop", "/shop");
  return (
    <section className="mx-auto grid max-w-2xl gap-4 py-20 text-center">
      <h1 className="m-0 font-display text-3xl font-bold text-zinc-950 dark:text-zinc-50">{title}</h1>
      <p className="m-0 text-zinc-600 dark:text-zinc-400">{message}</p>
      <Link to={shopPath} className="mx-auto rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white no-underline">Browse the shop</Link>
    </section>
  );
}

function matchesSelection(combo: ProductVariationCombo, selection: Record<string, string>): boolean {
  return Object.entries(selection).every(([name, value]) => combo.options[name] === value);
}

function mapGallery(product: CmsProductDetail): ProductGalleryImage[] {
  const images = product.gallery.filter(
    (image, index, all) => Boolean(image.sourceUrl) && all.findIndex((candidate) => candidate.sourceUrl === image.sourceUrl) === index,
  );
  if (!images.length) return [{ id: "placeholder", label: product.name, alt: product.name }];
  return images.map((image, index) => ({
    id: image.id || `${product.id}-${index}`,
    label: image.altText || `${product.name} image ${index + 1}`,
    src: image.sourceUrl,
    alt: image.altText || product.name,
  }));
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
