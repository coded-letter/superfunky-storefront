import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Bookmark, Heart, Star } from "lucide-react";
import {
  calculateDiscountPercent,
  ProductCard,
  ProductGallery,
  Seo,
  resolveVariationSwatchColor,
  savedListEntityId,
  useCart,
  useCurrency,
  useLayoutPreferences,
  useT,
  useWishlist,
  type ProductGalleryImage,
  type ProductPageLayout,
  type RelatedProductsColumns,
} from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { GuestStarRating } from "../components/GuestStarRating";
import { ProductInquiryForm } from "../components/ProductInquiryForm";
import { renderCmsContent } from "../components/CmsPageContent";
import { WORDPRESS_SHORTCODE_RENDERERS } from "../components/wordpressShortcodes";
import { APPLICATION_SHORTCODE_RENDERERS } from "../components/applicationShortcodeRenderers";
import { useIncrementalData } from "@funky/sdk/react";
import { getProductByUriOrSlug, normalizeProductDetail, resolveProductPriceMode, type CmsProductDetail } from "../lib/commerce";
import { createReview } from "../lib/comments";
import { useCanonicalContentLanguage } from "../lib/useCanonicalContentLanguage";
import { mountCmsBehaviors, sanitizeCmsHtml } from "../lib/cmsBehaviors";
import { DEFAULT_STOREFRONT_CONFIGURATION } from "../lib/navigation";
import { useStorefrontPath } from "../lib/storefrontPaths";
import { useNavigationData } from "../state/navigationData";
import { CommentsSection, summarizeReviews } from "./CommentThread";
import type { ProductVariationCombo } from "./shared";

export function ProductMockupPage() {
  const t = useT();
  const { pathname } = useLocation();
  const { slug } = useParams();
  const identifier = pathname.startsWith("/shop/") && slug ? slug : pathname;
  const { data: product, isLoading, isRevalidating, error } = useIncrementalData(
    `product:${identifier}`,
    () => getProductByUriOrSlug(identifier),
  );
  const normalizedProduct = product ? normalizeProductDetail(product) : null;

  useCanonicalContentLanguage(
    normalizedProduct?.languageCode,
    normalizedProduct?.translations || [],
    pathname,
    !isLoading && !isRevalidating,
    true,
    normalizedProduct?.uri,
  );

  if (isLoading) return <ContentLoadingState label={t("product.loading")} />;
  if (error) return <ProductStatus title={t("product.unavailable")} message={error.message} />;
  if (!normalizedProduct) return <ProductStatus title={t("product.not_found")} message={t("product.not_found_message", { identifier })} />;

  return <ProductTemplate key={normalizedProduct.id} product={normalizedProduct} />;
}

function ProductTemplate({ product }: { product: CmsProductDetail }) {
  const t = useT();
  const contentRef = useRef<HTMLDivElement>(null);
  const shopPath = useStorefrontPath("shop", "/shop");
  const { formatBaseAmount, currencyCode, convertSelectedToBase } = useCurrency();
  const {
    productPageLayout,
    relatedProductsColumns,
    showStudioRelatedProductsUnderMeta,
    productPageWishlistButtonLayout,
    productPageWishlistIcon,
    productDescriptionsOrder,
    discussionLayout,
  } = useLayoutPreferences();
  const { data: navigationData } = useNavigationData();
  const productPresentation = navigationData?.storefrontConfig.productPresentation
    ?? DEFAULT_STOREFRONT_CONFIGURATION.productPresentation;

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

  const { addItem, items, openDrawer } = useCart();
  const { has, toggle } = useWishlist();
  const wishlistId = savedListEntityId(product.card);
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
  const stockQuantity = selectedVariation?.stockQuantity ?? product.card.stockQuantity;
  const backordersAllowed = selectedVariation?.backordersAllowed ?? product.card.backordersAllowed;
  const quantityInCart = items.find((item) => item.id === (selectedVariation?.id || product.id))?.quantity ?? 0;
  const remainingStock = backordersAllowed || stockQuantity == null
    ? undefined
    : Math.max(0, stockQuantity - quantityInCart);

  useEffect(() => {
    setQuantity((current) => Math.min(current, Math.max(1, remainingStock ?? current)));
  }, [remainingStock]);
  const priceAmount = selectedVariation?.priceAmount ?? product.card.priceAmount;
  const price = formatProductPrice(priceAmount) ?? selectedVariation?.priceLabel ?? product.card.priceLabel;
  // External and grouped products always resolve their own price/link presentation,
  // so the inquiry-vs-free resolution only applies to simple and variable products.
  const priceMode = !isExternal && !isGrouped
    ? resolveProductPriceMode(priceAmount, product.priceBehavior, productPresentation.noPriceBehavior)
    : "purchase";
  const isInquiry = priceMode === "inquiry";
  const compareAtPriceAmount = selectedVariation
    ? selectedVariation.compareAtPriceAmount
    : product.card.compareAtPriceAmount;
  const compareAtPriceLabel = selectedVariation
    ? selectedVariation.compareAtPriceLabel
    : product.card.compareAtPriceLabel;
  const regularPrice = compareAtPriceAmount !== undefined
    ? formatBaseAmount(compareAtPriceAmount)
    : compareAtPriceLabel;
  const discountPercent = calculateDiscountPercent(price, regularPrice);
  const badgeLabel = discountPercent !== null
    ? `−${discountPercent}%`
    : selectedVariation && product.card.badge?.toLowerCase() === "sale"
      ? undefined
      : product.card.badge;
  const gallery = mapGallery(product);
  const selectedGalleryImageId = selectedVariation?.imageUrl
    ? gallery.find((image) => image.src === selectedVariation.imageUrl)?.id
    : undefined;
  const breadcrumbs = [
    { label: t("nav.home"), href: "/" },
    { label: t("nav.shop"), href: shopPath },
    ...product.categories.slice(0, 1).map((category) => ({ label: category.name, href: category.uri })),
    { label: product.name },
  ];
  const reviewSummary = summarizeReviews(product.reviews);
  const primaryDescriptionHtml = productDescriptionsOrder === "long-first"
    ? product.descriptionHtml
    : product.shortDescriptionHtml;
  const secondaryDescriptionHtml = productDescriptionsOrder === "long-first"
    ? product.shortDescriptionHtml
    : product.descriptionHtml;
  const hasPrimaryDescription = hasMeaningfulProductHtml(primaryDescriptionHtml);
  const hasSecondaryDescription = hasMeaningfulProductHtml(secondaryDescriptionHtml);
  const displayAttributes = product.attributes.flatMap((attribute) => {
    const label = (attribute.label || attribute.name).trim();
    const options = attribute.options.map((option) => option.trim()).filter(Boolean);
    return label && options.length ? [{ ...attribute, label, options }] : [];
  });

  useEffect(() => {
    if (!contentRef.current) return;
    return mountCmsBehaviors(contentRef.current);
  }, [product.id]);

  const selectVariationOption = (label: string, value: string) => {
    const nextOptions = { ...selectedOptions, [label]: value };
    const exactMatch = product.variationCombos.find((combo) => matchesSelection(combo, nextOptions));
    const fallbackMatch =
      product.variationCombos.find((combo) => combo.options[label] === value && combo.inStock) ||
      product.variationCombos.find((combo) => combo.options[label] === value);
    setSelectedOptions(exactMatch?.options || fallbackMatch?.options || nextOptions);
  };

  const addToCart = () => {
    if (!canPurchase || isExternal || isGrouped) return;
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
        stockQuantity,
        backordersAllowed,
      },
      quantity,
    );
    openDrawer();
  };

  return (
    <div ref={contentRef} className="grid gap-12">
      <Seo
        title={product.seo.title || product.name}
        description={product.seo.description || product.seo.opengraphDescription || stripHtml(product.shortDescriptionHtml)}
        canonical={product.seo.canonical || product.seo.opengraphUrl || product.uri}
        languageCode={product.languageCode}
        keywords={product.seo.keywords || undefined}
        siteName={product.seo.siteName || undefined}
        appendSiteName={false}
        robots="index, follow"
        opengraphType="product"
        opengraphTitle={product.seo.opengraphTitle || product.name}
        opengraphDescription={product.seo.opengraphDescription || undefined}
        image={product.card.imageUrl
          ? {
              url: product.card.imageUrl,
              alt: product.gallery.find((galleryImage) => galleryImage.sourceUrl === product.card.imageUrl)?.altText || product.name,
            }
          : product.seo.opengraphImage
            ? { url: product.seo.opengraphImage, alt: product.name }
            : undefined}
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

      <ProductPageLayoutShell
        layout={productPageLayout}
        gallery={<ProductGallery images={gallery} selectedImageId={selectedGalleryImageId} />}
        summary={(
          <div className="grid content-start gap-6">
          <div className="flex flex-wrap items-center gap-2">
            {badgeLabel ? (
              <span
                className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                title={discountPercent !== null ? `${discountPercent}% off` : undefined}
              >
                {badgeLabel}
              </span>
            ) : null}
            <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${canPurchase ? "text-emerald-600" : "text-rose-500"}`}>
              {canPurchase ? t("product.in_stock") : t("product.out_of_stock")}
            </span>
          </div>

          <div className="grid gap-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="m-0 font-display text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">{product.name}</h1>
              {productPageWishlistButtonLayout === "icon" ? (
                <ProductWishlistIconButton
                  active={has(wishlistId)}
                  icon={productPageWishlistIcon}
                  label={has(wishlistId) ? t("product.remove_wishlist") : t("product.add_wishlist")}
                  onClick={() => toggle(wishlistId)}
                />
              ) : null}
            </div>
            <GuestStarRating
              targetType="product"
              targetId={product.databaseId}
              initialSummary={product.card.engagementRating}
            />
            <div className="flex flex-wrap items-baseline gap-2">
              {!isInquiry ? (
                <>
                  <p className="m-0 text-2xl font-bold text-zinc-950 dark:text-zinc-50">{price || t("product.price_unavailable")}</p>
                  {discountPercent !== null && regularPrice ? (
                    <del className="text-base font-medium text-zinc-400 dark:text-zinc-500">{regularPrice}</del>
                  ) : null}
                </>
              ) : (
                <p className="m-0 text-sm font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">
                  {productPresentation.inquiryHeading}
                </p>
              )}
            </div>
          </div>

          {hasPrimaryDescription ? (
            <div className="prose prose-zinc max-w-none text-sm dark:prose-invert">
              {renderProductContent(primaryDescriptionHtml)}
            </div>
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

          {isInquiry ? (
            <div className="grid gap-3">
              <ProductInquiryForm
                product={{ databaseId: product.databaseId, name: product.name, uri: product.uri, sku: product.sku || undefined }}
                heading={productPresentation.inquiryHeading}
                buttonLabel={productPresentation.inquiryButtonLabel}
                copy={productPresentation.inquiryCopy}
              />
              {productPageWishlistButtonLayout === "full" ? (
                <ProductWishlistTextButton
                  active={has(wishlistId)}
                  label={has(wishlistId) ? t("product.remove_wishlist") : t("product.add_wishlist")}
                  onClick={() => toggle(wishlistId)}
                  className="justify-self-start"
                />
              ) : null}
            </div>
          ) : (
          <div className="flex flex-wrap gap-3">
            {!isExternal && !isGrouped ? (
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {t("product.quantity")}
                <input
                  type="number"
                  min={1}
                  max={remainingStock}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.min(
                    remainingStock ?? Number.POSITIVE_INFINITY,
                    Math.max(1, Number(event.target.value) || 1),
                  ))}
                  disabled={remainingStock === 0}
                  className="w-24 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
            ) : null}
            {isExternal ? (
              product.card.externalUrl ? (
                <a
                  href={product.card.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-end rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white no-underline hover:bg-brand-700"
                >
                  {product.externalButtonText || t("product.buy_now")}
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="self-end rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white opacity-50"
                >
                  {t("product.link_unavailable")}
                </button>
              )
            ) : (
              <button
                type="button"
                disabled={!canPurchase || isGrouped || remainingStock === 0}
                onClick={addToCart}
                className="self-end rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGrouped ? t("product.grouped") : isVariable && !selectedVariation ? t("product.choose_options") : t("product.add_to_cart")}
              </button>
            )}
            {productPageWishlistButtonLayout === "full" ? (
              <ProductWishlistTextButton
                active={has(wishlistId)}
                label={has(wishlistId) ? t("product.remove_wishlist") : t("product.add_wishlist")}
                onClick={() => toggle(wishlistId)}
                className="self-end"
              />
            ) : null}
          </div>
          )}

          {productPageLayout === "studio" && hasSecondaryDescription ? (
            <section className="grid gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <h2 className="m-0 font-display text-2xl font-bold">{t("product.details_heading")}</h2>
              <div className="prose prose-zinc max-w-none dark:prose-invert">
                {renderProductContent(secondaryDescriptionHtml)}
              </div>
            </section>
          ) : null}

          <dl className="grid gap-2 border-t border-zinc-200 pt-5 text-sm dark:border-zinc-800">
            {product.sku ? <MetaRow label={t("product.meta.sku")} value={product.sku} /> : null}
            {product.categories.length ? (
              <MetaLinks label={t("product.meta.categories")} items={product.categories.map((item) => ({ name: item.name, uri: item.uri }))} />
            ) : null}
            {product.brands.length ? (
              <MetaLinks label={t("product.meta.brands")} items={product.brands.map((item) => ({ name: item.name, uri: item.uri }))} />
            ) : null}
            {product.tags.length ? <MetaLinks label={t("product.meta.tags")} items={product.tags.map((item) => ({ name: item.name, uri: item.uri }))} /> : null}
          </dl>
          {showStudioRelatedProductsUnderMeta ? (
            <ProductConnectionsList product={product} columns={relatedProductsColumns} />
          ) : null}
          </div>
        )}
        details={productPageLayout === "classic" ? (
          hasSecondaryDescription || displayAttributes.length ? (
            <section className={`grid gap-8 border-t border-zinc-200 pt-10 dark:border-zinc-800 ${
              hasSecondaryDescription && displayAttributes.length ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : ""
            }`}>
            {hasSecondaryDescription ? (
              <div>
                <h2 className="font-display text-2xl font-bold">{t("product.details_heading")}</h2>
                <div className="prose prose-zinc max-w-none dark:prose-invert">
                  {renderProductContent(secondaryDescriptionHtml)}
                </div>
              </div>
            ) : null}
            {displayAttributes.length ? <ProductAttributes attributes={displayAttributes} /> : null}
            </section>
          ) : null
        ) : (
          displayAttributes.length ? (
            <section className="grid gap-5 border-t border-zinc-200 pt-10 dark:border-zinc-800">
              <h2 className="m-0 font-display text-2xl font-bold">{t("product.attributes_heading")}</h2>
              <ProductAttributes attributes={displayAttributes} />
            </section>
          ) : null
        )}
        reviews={(
          <CommentsSection
            anchorId="product-reviews"
            contentKey={`product:${product.databaseId}`}
            heading={t("review.section_heading")}
            initialReviews={product.reviews}
            averageRating={reviewSummary.averageRating}
            ratingHistogram={reviewSummary.averageRating ? reviewSummary.histogram : undefined}
            totalCountOverride={product.reviews.length}
            formTitle={t("review.form_title_product")}
            discussionLayout={discussionLayout}
            onSubmitReview={(review) => createReview({
              commentOn: product.databaseId,
              author: review.author,
              authorEmail: review.email,
              content: review.content,
              rating: review.rating,
            })}
            onSubmitReply={(parent, reply) => {
              if (!parent.databaseId) throw new Error("This review cannot be replied to because its content ID is unavailable.");
              return createReview({
                commentOn: product.databaseId,
                author: reply.author,
                authorEmail: reply.email,
                content: reply.content,
                parent: parent.databaseId,
              });
            }}
          />
        )}
        connections={
          productPageLayout === "studio" && showStudioRelatedProductsUnderMeta
            ? null
            : <ProductConnectionsList product={product} columns={relatedProductsColumns} />
        }
      />
    </div>
  );
}

function ProductConnectionsList({
  product,
  columns,
}: {
  product: CmsProductDetail;
  columns: RelatedProductsColumns;
}) {
  const t = useT();
  return (
    <>
      <ProductConnections title={t("product.related")} products={product.related} columns={columns} />
      <ProductConnections title={t("product.upsells")} products={product.upsells} columns={columns} />
      <ProductConnections title={t("product.cross_sells")} products={product.crossSells} columns={columns} />
    </>
  );
}

function ProductPageLayoutShell({
  layout,
  gallery,
  summary,
  details,
  reviews,
  connections,
}: {
  layout: ProductPageLayout;
  gallery: ReactNode;
  summary: ReactNode;
  details: ReactNode;
  reviews: ReactNode;
  connections: ReactNode;
}) {
  const t = useT();
  if (layout === "classic") {
    return (
      <>
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)] lg:items-start">
          {gallery}
          {summary}
        </section>
        {details}
        {reviews}
        {connections}
      </>
    );
  }

  return (
    <>
      <section
        data-product-page-layout="studio"
        className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)] lg:items-start"
      >
        <div className="lg:sticky lg:top-28 lg:self-start">{gallery}</div>
        <div
          role="region"
          aria-label={t("product.information_aria")}
          className="grid gap-12"
        >
          {summary}
        </div>
      </section>
      {details}
      {reviews}
      {connections}
    </>
  );
}

function renderProductContent(html: string) {
  return renderCmsContent(
    sanitizeCmsHtml(html),
    { ...WORDPRESS_SHORTCODE_RENDERERS, ...APPLICATION_SHORTCODE_RENDERERS },
  );
}

function ProductWishlistTextButton({
  active,
  label,
  onClick,
  className,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${className || ""} rounded-full border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200`}
    >
      {label}
    </button>
  );
}

function ProductWishlistIconButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: "heart" | "star" | "bookmark";
  label: string;
  onClick: () => void;
}) {
  const Icon = icon === "star" ? Star : icon === "bookmark" ? Bookmark : Heart;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-soft transition hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
    >
      <Icon className={`h-5 w-5 ${active ? "fill-current text-brand-600" : ""}`} aria-hidden="true" />
    </button>
  );
}

function ProductAttributes({ attributes }: { attributes: CmsProductDetail["attributes"] }) {
  return (
    <dl className="grid content-start gap-3 rounded-2xl bg-zinc-50 p-6 text-sm dark:bg-zinc-900">
      {attributes.map((attribute) => (
        <MetaRow key={attribute.id || attribute.label} label={attribute.label} value={attribute.options.join(", ")} />
      ))}
    </dl>
  );
}

function ProductConnections({
  title,
  products,
  columns,
}: {
  title: string;
  products: CmsProductDetail["related"];
  columns: RelatedProductsColumns;
}) {
  if (!products.length) return null;
  const columnClass = {
    "2": "lg:grid-cols-2",
    "3": "lg:grid-cols-3",
    "4": "lg:grid-cols-4",
  }[columns];
  return (
    <section className="grid gap-6">
      <h2 className="m-0 font-display text-2xl font-bold text-zinc-950 dark:text-zinc-50">{title}</h2>
      <div className={`grid gap-6 sm:grid-cols-2 ${columnClass}`} data-related-products-columns={columns}>
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

function hasMeaningfulProductHtml(value: string): boolean {
  const text = stripHtml(value)
    .replace(/&(nbsp|#160|#x0*a0);/gi, "")
    .replace(/\u00a0|\u200b/g, "")
    .trim();
  return Boolean(text) || /<(?:audio|blockquote|figure|iframe|img|ol|pre|table|ul|video)\b/i.test(value);
}
