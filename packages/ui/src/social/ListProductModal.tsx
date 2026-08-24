import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { Download, ImagePlus, Plus, Store, Trash2, X } from "lucide-react";
import { useToast } from "../state";
import { parseLocalizedPrice, useCurrency, useT } from "../locale";
import { deriveMarketplaceVariationAttributes, marketplaceVariationKey } from "./marketplaceVariations";

export type ListProductDownloadableFile = { name: string; fileDataUrl: string };
export type ListProductType = "simple" | "variable" | "external";

export type ListProductDraft = {
  productId?: number;
  imagePreview: string | null;
  imagePreviews: string[];
  imageDataUrls: string[];
  name: string;
  subtitle: string;
  category: string;
  brand: string;
  upsellIds: number[];
  crossSellIds: number[];
  productType: ListProductType;
  sku: string;
  stockQuantity: number;
  priceLabel: string;
  priceAmount: number;
  compareAtPriceLabel: string;
  compareAtPriceAmount?: number;
  description: string;
  isVirtual: boolean;
  isDownloadable: boolean;
  downloadableFiles: ListProductDownloadableFile[];
  downloadLimit: number;
  downloadExpiryDays: number;
  externalUrl: string;
  buttonText: string;
  attributes: { name: string; options: string[] }[];
  variations: {
    variationId?: number;
    attributes: { name: string; option: string }[];
    sku: string;
    priceLabel: string;
    priceAmount: number;
    compareAtPriceLabel: string;
    compareAtPriceAmount?: number;
    stockQuantity: number;
    imageIndex: number;
    isVirtual: boolean;
    isDownloadable: boolean;
    downloadableFiles: ListProductDownloadableFile[];
    downloadLimit: number;
    downloadExpiryDays: number;
  }[];
};

/** Pre-fills the form for editing an existing product the viewer owns. */
export type ListProductInitialValues = {
  productId: number;
  imagePreviews: string[];
  name: string;
  subtitle: string;
  category: string;
  brand: string;
  upsellIds: number[];
  crossSellIds: number[];
  productType: ListProductType;
  sku: string;
  stockQuantity: number;
  priceLabel: string;
  compareAtPriceLabel: string;
  description: string;
  isVirtual: boolean;
  isDownloadable: boolean;
  downloadLimit: number;
  downloadExpiryDays: number;
  externalUrl: string;
  buttonText: string;
  /** Read-only names of files already uploaded — uploading new files below replaces them. */
  existingDownloadNames: string[];
  attributes: { name: string; options: string[] }[];
  variations: {
    databaseId: number;
    attributes: { name: string; option: string }[];
    sku: string;
    priceLabel: string;
    compareAtPriceLabel: string;
    stockQuantity: number;
    isVirtual: boolean;
    isDownloadable: boolean;
    downloadLimit: number;
    downloadExpiryDays: number;
    existingDownloadNames: string[];
  }[];
};

type VariationFormState = {
  variationId?: number;
  sku: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  imageIndex: string;
  isVirtual: boolean;
  isDownloadable: boolean;
  downloadableFiles: ListProductDownloadableFile[];
  downloadLimit: string;
  downloadExpiryDays: string;
  existingDownloadNames: string[];
};

const EMPTY_VARIATION: VariationFormState = {
  sku: "",
  price: "",
  compareAtPrice: "",
  stock: "1",
  imageIndex: "-1",
  isVirtual: false,
  isDownloadable: false,
  downloadableFiles: [],
  downloadLimit: "0",
  downloadExpiryDays: "0",
  existingDownloadNames: [],
};

export type ListProductModalProps = {
  onClose: () => void;
  /** Publishes the validated draft through the host application's marketplace mutation. */
  onSubmit?: (draft: ListProductDraft) => void | Promise<void>;
  /** When provided, the modal opens pre-filled in "edit" mode for this existing product. */
  initialProduct?: ListProductInitialValues;
};

/**
 * WordPress-style collaborator product editor. Files are previewed locally before the
 * host submits their data URLs to the permission-gated WooCommerce mutation. Supports
 * both creating a new listing and editing an existing one via `initialProduct`.
 */
export function ListProductModal({ onClose, onSubmit, initialProduct }: ListProductModalProps) {
  const t = useT();
  const { showToast } = useToast();
  const { currencyCode } = useCurrency();
  const isEditing = Boolean(initialProduct);
  const [imagePreviews, setImagePreviews] = useState<string[]>(initialProduct?.imagePreviews || []);
  const [name, setName] = useState(initialProduct?.name || "");
  const [subtitle, setSubtitle] = useState(initialProduct?.subtitle || "");
  const [category, setCategory] = useState(initialProduct?.category || "");
  const [brand, setBrand] = useState(initialProduct?.brand || "");
  const [upsellIds, setUpsellIds] = useState(initialProduct?.upsellIds.join(", ") || "");
  const [crossSellIds, setCrossSellIds] = useState(initialProduct?.crossSellIds.join(", ") || "");
  const [productType, setProductType] = useState<ListProductType>(initialProduct?.productType || "simple");
  const [sku, setSku] = useState(initialProduct?.sku || "");
  const [stockQuantity, setStockQuantity] = useState(String(initialProduct?.stockQuantity ?? 1));
  const [priceLabel, setPriceLabel] = useState(initialProduct?.priceLabel || "");
  const [compareAtPriceLabel, setCompareAtPriceLabel] = useState(initialProduct?.compareAtPriceLabel || "");
  const [description, setDescription] = useState(initialProduct?.description || "");
  const [isVirtual, setIsVirtual] = useState(initialProduct?.isVirtual ?? false);
  const [isDownloadable, setIsDownloadable] = useState(initialProduct?.isDownloadable ?? false);
  const [downloadableFiles, setDownloadableFiles] = useState<ListProductDownloadableFile[]>([]);
  const [downloadLimit, setDownloadLimit] = useState(String(initialProduct?.downloadLimit ?? 0));
  const [downloadExpiryDays, setDownloadExpiryDays] = useState(String(initialProduct?.downloadExpiryDays ?? 0));
  const [externalUrl, setExternalUrl] = useState(initialProduct?.externalUrl || "");
  const [buttonText, setButtonText] = useState(initialProduct?.buttonText || "");
  const initialAttributes = initialProduct?.attributes.length
    ? initialProduct.attributes
    : deriveMarketplaceVariationAttributes(initialProduct?.variations || []);
  const [attributes, setAttributes] = useState(
    initialAttributes.length
      ? initialAttributes.map((attribute, index) => ({ id: `attribute-${index}`, name: attribute.name, options: attribute.options.join(", ") }))
      : isEditing
        ? []
        : [{ id: "attribute-1", name: "Size", options: "Small, Medium, Large" }],
  );
  const [variationValues, setVariationValues] = useState<Record<string, VariationFormState>>(
    Object.fromEntries(
      (initialProduct?.variations || []).map((variation) => [
        marketplaceVariationKey(variation.attributes),
        {
          ...EMPTY_VARIATION,
          variationId: variation.databaseId,
          sku: variation.sku,
          price: variation.priceLabel,
          compareAtPrice: variation.compareAtPriceLabel,
          stock: String(variation.stockQuantity),
          isVirtual: variation.isVirtual,
          isDownloadable: variation.isDownloadable,
          downloadLimit: String(variation.downloadLimit),
          downloadExpiryDays: String(variation.downloadExpiryDays),
          existingDownloadNames: variation.existingDownloadNames,
        },
      ]),
    ),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 8 - imagePreviews.length);
    setSubmitError(null);
    try {
      const previews = await Promise.all(files.map(readImage));
      setImagePreviews((current) => [...current, ...previews].slice(0, 8));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "An image could not be read.");
    }
    event.target.value = "";
  };

  const handleDownloadableFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 5 - downloadableFiles.length);
    setSubmitError(null);
    try {
      const readFiles = await Promise.all(files.map(readDownloadableFile));
      setDownloadableFiles((current) => [...current, ...readFiles].slice(0, 5));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "A file could not be read.");
    }
    event.target.value = "";
  };

  const normalizedAttributes = useMemo(
    () => attributes.flatMap((attribute) => {
      const attributeName = attribute.name.trim();
      const options = Array.from(new Set(attribute.options.split(",").map((option) => option.trim()).filter(Boolean)));
      return attributeName && options.length ? [{ name: attributeName, options }] : [];
    }),
    [attributes],
  );
  const combinations = useMemo(() => cartesianVariations(normalizedAttributes), [normalizedAttributes]);
  const hasExistingDownloads = (initialProduct?.existingDownloadNames.length || 0) > 0;
  const primaryPrice = parseLocalizedPrice(priceLabel);
  const primaryCompareAtPrice = parseOptionalPrice(compareAtPriceLabel);
  const variationDrafts = productType === "variable"
    ? combinations.map((combination) => {
        const values = variationValues[marketplaceVariationKey(combination)] || EMPTY_VARIATION;
        return {
          combination,
          values,
          price: parseLocalizedPrice(values.price),
          compareAtPrice: parseOptionalPrice(values.compareAtPrice),
        };
      })
    : [];
  const canSubmit = name.trim().length > 0
    && (productType !== "external" || isValidExternalUrl(externalUrl))
    && (productType !== "simple" || !isDownloadable || downloadableFiles.length > 0 || hasExistingDownloads)
    && (
      productType !== "variable"
        ? isValidPrice(primaryPrice) && isValidCompareAtPrice(primaryCompareAtPrice, primaryPrice)
        : variationDrafts.length > 0 && variationDrafts.length <= 100 && variationDrafts.every(({ values, price, compareAtPrice }) =>
            isValidPrice(price)
              && isValidCompareAtPrice(compareAtPrice, price)
              && (!values.isDownloadable || values.downloadableFiles.length > 0 || values.existingDownloadNames.length > 0)
          )
    );

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const priceAmount = productType !== "variable" ? requireValidatedPrice(primaryPrice, "Price") : 0;
      const compareAtPriceAmount = productType !== "variable" ? primaryCompareAtPrice ?? undefined : undefined;
      await onSubmit?.({
        productId: initialProduct?.productId,
        imagePreview: imagePreviews[0] || null,
        imagePreviews,
        imageDataUrls: imagePreviews.filter((preview) => preview.startsWith("data:image/")),
        name: name.trim(),
        subtitle: subtitle.trim(),
        category: category.trim(),
        brand: brand.trim(),
        upsellIds: parseProductIds(upsellIds),
        crossSellIds: parseProductIds(crossSellIds),
        productType,
        sku: sku.trim(),
        stockQuantity: Math.max(0, Number.parseInt(stockQuantity, 10) || 0),
        priceLabel: priceLabel.trim(),
        priceAmount,
        compareAtPriceLabel: compareAtPriceLabel.trim(),
        compareAtPriceAmount,
        description: description.trim(),
        isVirtual: isVirtual || isDownloadable,
        isDownloadable,
        downloadableFiles: isDownloadable ? downloadableFiles : [],
        downloadLimit: Math.max(0, Number.parseInt(downloadLimit, 10) || 0),
        downloadExpiryDays: Math.max(0, Number.parseInt(downloadExpiryDays, 10) || 0),
        externalUrl: productType === "external" ? externalUrl.trim() : "",
        buttonText: productType === "external" ? buttonText.trim() : "",
        attributes: normalizedAttributes,
        variations: variationDrafts.map(({ combination, values, price: variationPrice, compareAtPrice }) => {
          return {
            variationId: values.variationId,
            attributes: combination,
            sku: values.sku.trim(),
            priceLabel: values.price.trim(),
            priceAmount: requireValidatedPrice(
              variationPrice,
              `Price for ${combination.map(({ name: attributeName, option }) => `${attributeName}: ${option}`).join(", ")}`,
            ),
            compareAtPriceLabel: values.compareAtPrice.trim(),
            compareAtPriceAmount: compareAtPrice ?? undefined,
            stockQuantity: Math.max(0, Number.parseInt(values.stock, 10) || 0),
            imageIndex: Math.max(-1, Number.parseInt(values.imageIndex, 10)),
            isVirtual: Boolean(values.isVirtual || values.isDownloadable),
            isDownloadable: values.isDownloadable,
            downloadableFiles: values.isDownloadable ? values.downloadableFiles : [],
            downloadLimit: Math.max(0, Number.parseInt(values.downloadLimit, 10) || 0),
            downloadExpiryDays: Math.max(0, Number.parseInt(values.downloadExpiryDays, 10) || 0),
          };
        }),
      });
      showToast({
        title: isEditing ? "Product updated" : "Product listed",
        description: isEditing ? "Your changes are now live." : "It now appears in your shop and the community marketplace.",
        tone: "success",
      });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("error.product_listing_failed"));
    } finally {
      setIsSubmitting(false);
    }

  };


  return createPortal(
    <div
      className="sf-list-product-modal fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? "Edit product" : "List a new product"}
      onClick={onClose}
    >
      <div
        className="funky-list-product-modal relative grid max-h-[90vh] w-full max-w-lg gap-5 overflow-y-auto rounded-3xl bg-white p-6 shadow-soft-lg dark:bg-zinc-900 sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 inline-grid h-9 w-9 place-items-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="grid gap-1 pr-8">
          <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">{isEditing ? "Edit product" : "List a new product"}</h2>
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            {isEditing
              ? "Update the details below — changes publish immediately to your marketplace shop."
              : "Collaborator accounts can publish this product directly to their marketplace shop."}
          </p>
        </div>

        <div className="grid gap-2">
          <label className="grid min-h-36 cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 text-center transition hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-950">
            <span className="grid place-items-center gap-2 p-6 text-zinc-400 dark:text-zinc-500">
              <ImagePlus className="h-8 w-8" aria-hidden="true" />
              <span className="text-sm font-semibold">{imagePreviews.length ? "Add more product images" : "Choose product images"}</span>
              <span className="text-xs">Up to 8 JPG, PNG, GIF, or WebP files · first image is featured</span>
            </span>
            <input multiple type="file" accept="image/png, image/jpeg, image/gif, image/webp" onChange={handleImageChange} className="sr-only" />
          </label>
          {imagePreviews.length ? (
            <div className="grid grid-cols-4 gap-2">
              {imagePreviews.map((preview, index) => (
                <div key={`${preview.slice(-24)}-${index}`} className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <img src={preview} alt={`Product upload ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImagePreviews((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label={`Remove image ${index + 1}`}
                    className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-zinc-950/75 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {index === 0 ? <span className="absolute bottom-1 left-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">Featured</span> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <span>Product name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Hand-Stitched Crossbody"
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-500 dark:focus:ring-brand-950"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <span>Brand</span>
          <input
            type="text"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            placeholder="Optional product brand"
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <span>Upsell product IDs</span>
            <input
              type="text"
              inputMode="numeric"
              value={upsellIds}
              onChange={(event) => setUpsellIds(event.target.value)}
              placeholder="12, 24"
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <span>Cross-sell product IDs</span>
            <input
              type="text"
              inputMode="numeric"
              value={crossSellIds}
              onChange={(event) => setCrossSellIds(event.target.value)}
              placeholder="36, 48"
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
        </div>

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <span>Subtitle</span>
          <input
            type="text"
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            placeholder="Full-grain leather, made to order"
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-500 dark:focus:ring-brand-950"
          />
        </label>

        <div className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <span>Product type</span>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            {(["simple", "variable", "external"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setProductType(type)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize ${productType === type ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {productType === "simple" ? <div className="grid gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
          <label className="flex items-center justify-between gap-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <span>
              Virtual product
              <span className="mt-0.5 block text-xs font-normal text-zinc-500 dark:text-zinc-400">No shipping is required — e.g. a service or digital good.</span>
            </span>
            <input
              type="checkbox"
              checked={isVirtual || isDownloadable}
              disabled={isDownloadable}
              onChange={(event) => setIsVirtual(event.target.checked)}
              className="h-5 w-5 shrink-0 rounded border-zinc-300 text-brand-600 focus:ring-brand-400 dark:border-zinc-600"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <span>
              Downloadable product
              <span className="mt-0.5 block text-xs font-normal text-zinc-500 dark:text-zinc-400">Buyers get a secure download link after purchase — also makes it virtual.</span>
            </span>
            <input
              type="checkbox"
              checked={isDownloadable}
              onChange={(event) => setIsDownloadable(event.target.checked)}
              className="h-5 w-5 shrink-0 rounded border-zinc-300 text-brand-600 focus:ring-brand-400 dark:border-zinc-600"
            />
          </label>

          {isDownloadable ? (
            <div className="grid gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              {initialProduct?.existingDownloadNames.length ? (
                <div className="grid gap-1">
                  <p className="m-0 text-xs font-semibold text-zinc-600 dark:text-zinc-300">Current files (uploading new files below replaces these)</p>
                  <ul className="m-0 grid list-none gap-1 p-0">
                    {initialProduct.existingDownloadNames.map((fileName) => (
                      <li key={fileName} className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {fileName}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <label className="grid cursor-pointer gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <span>Downloadable files ({downloadableFiles.length}/5)</span>
                <span className="grid place-items-center gap-1 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-center text-xs text-zinc-400 transition hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-500">
                  <Download className="h-5 w-5" aria-hidden="true" />
                  Click to choose PDF, ZIP, EPUB, MP3, or MP4 files (up to 20 MB each)
                </span>
                <input
                  multiple
                  type="file"
                  accept=".pdf,.zip,.epub,.mp3,.mp4,application/pdf,application/zip,application/epub+zip,audio/mpeg,video/mp4"
                  onChange={handleDownloadableFileChange}
                  className="sr-only"
                />
              </label>
              {downloadableFiles.length ? (
                <ul className="m-0 grid list-none gap-1 p-0">
                  {downloadableFiles.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setDownloadableFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        aria-label={`Remove ${file.name}`}
                        className="shrink-0 text-rose-600 hover:text-rose-700 dark:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  <span>Download limit (0 = unlimited)</span>
                  <input
                    type="number"
                    min="0"
                    value={downloadLimit}
                    onChange={(event) => setDownloadLimit(event.target.value)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  <span>Expires after (days, 0 = never)</span>
                  <input
                    type="number"
                    min="0"
                    value={downloadExpiryDays}
                    onChange={(event) => setDownloadExpiryDays(event.target.value)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div> : productType === "external" ? (
          <div className="grid gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              <span>External product URL</span>
              <input
                type="url"
                required
                value={externalUrl}
                onChange={(event) => setExternalUrl(event.target.value)}
                placeholder="https://partner.example/product"
                className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              <span>Button text</span>
              <input
                type="text"
                value={buttonText}
                onChange={(event) => setButtonText(event.target.value)}
                placeholder="Buy product"
                className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <span>SKU</span>
            <input
              type="text"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              placeholder="Optional"
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          {productType === "simple" ? (
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              <span>Stock quantity</span>
              <input
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(event) => setStockQuantity(event.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          ) : <span />}
        </div>

        {productType !== "variable" ? <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <span>Price ({currencyCode})</span>
            <input
              type="text"
              value={priceLabel}
              onChange={(event) => setPriceLabel(event.target.value)}
              inputMode="decimal"
              placeholder="64.00"
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-500 dark:focus:ring-brand-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <span>Compare-at price ({currencyCode})</span>
            <input
              type="text"
              inputMode="decimal"
              value={compareAtPriceLabel}
              onChange={(event) => setCompareAtPriceLabel(event.target.value)}
              placeholder="Optional"
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-500 dark:focus:ring-brand-950"
            />
          </label>
        </div> : null}

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <span>Category</span>
          <input
            type="text"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Accessories"
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-500 dark:focus:ring-brand-950"
          />
        </label>

        {productType === "variable" ? (
          <div className="grid gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="m-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Variation attributes</h3>
                <p className="m-0 text-xs text-zinc-500 dark:text-zinc-400">Enter comma-separated options. Up to three attributes and 100 combinations are supported.</p>
              </div>
              <button
                type="button"
                disabled={attributes.length >= 3}
                onClick={() => setAttributes((current) => [...current, { id: `attribute-${Date.now()}`, name: "", options: "" }])}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Attribute
              </button>
            </div>
            {attributes.map((attribute, index) => (
              <div key={attribute.id} className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto] gap-2">
                <input
                  type="text"
                  value={attribute.name}
                  onChange={(event) => setAttributes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}
                  placeholder="Size"
                  aria-label={`Attribute ${index + 1} name`}
                  className="min-w-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <input
                  type="text"
                  value={attribute.options}
                  onChange={(event) => setAttributes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, options: event.target.value } : item))}
                  placeholder="Small, Medium, Large"
                  aria-label={`Attribute ${index + 1} options`}
                  className="min-w-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <button
                  type="button"
                  disabled={attributes.length === 1}
                  onClick={() => setAttributes((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  aria-label={`Remove attribute ${index + 1}`}
                  className="grid h-10 w-10 place-items-center rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-30 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}

            {combinations.length > 100 ? (
              <p role="alert" className="m-0 text-sm font-medium text-rose-600 dark:text-rose-400">Reduce the options to 100 variation combinations or fewer.</p>
            ) : (
              <div className="grid gap-3">
                {combinations.map((combination) => {
                  const key = marketplaceVariationKey(combination);
                  const values = variationValues[key] || EMPTY_VARIATION;
                  const update = (patch: Partial<VariationFormState>) =>
                    setVariationValues((current) => ({ ...current, [key]: { ...values, ...patch } }));
                  return (
                    <div key={key} className="grid gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950">
                      <p className="m-0 text-xs font-semibold text-zinc-700 dark:text-zinc-200">{combination.map(({ name: attributeName, option }) => `${attributeName}: ${option}`).join(" · ")}</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <VariationInput label={`Price * (${currencyCode})`} value={values.price} onChange={(value) => update({ price: value })} />
                        <VariationInput label={`Compare at (${currencyCode})`} value={values.compareAtPrice} onChange={(value) => update({ compareAtPrice: value })} />
                        <VariationInput label="SKU" value={values.sku} onChange={(value) => update({ sku: value })} />
                        <VariationInput label="Stock" type="number" value={values.stock} onChange={(value) => update({ stock: value })} />
                        <label className="grid gap-1 text-[11px] font-medium text-zinc-500">
                          <span>Variation image</span>
                          <select
                            value={values.imageIndex}
                            onChange={(event) => update({ imageIndex: event.target.value })}
                            className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          >
                            <option value="-1">Product image</option>
                            {imagePreviews.map((_, imageIndex) => <option key={imageIndex} value={imageIndex}>Image {imageIndex + 1}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 border-t border-zinc-200 pt-2 text-xs dark:border-zinc-800">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={values.isVirtual || values.isDownloadable}
                            disabled={values.isDownloadable}
                            onChange={(event) => update({ isVirtual: event.target.checked })}
                          />
                          Virtual
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={values.isDownloadable}
                            onChange={(event) => update({
                              isDownloadable: event.target.checked,
                              isVirtual: event.target.checked || values.isVirtual,
                            })}
                          />
                          Downloadable
                        </label>
                      </div>
                      {values.isDownloadable ? (
                        <div className="grid gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
                          {values.existingDownloadNames.length ? (
                            <p className="m-0 text-[11px] text-zinc-500">
                              Current files: {values.existingDownloadNames.join(", ")}
                            </p>
                          ) : null}
                          <label className="grid cursor-pointer gap-1 text-[11px] font-medium text-zinc-500">
                            <span>Replacement downloadable files ({values.downloadableFiles.length}/5)</span>
                            <input
                              multiple
                              type="file"
                              accept=".pdf,.zip,.epub,.mp3,.mp4,application/pdf,application/zip,application/epub+zip,audio/mpeg,video/mp4"
                              onChange={async (event) => {
                                const files = Array.from(event.target.files || []).slice(0, 5);
                                event.target.value = "";
                                try {
                                  update({ downloadableFiles: await Promise.all(files.map(readDownloadableFile)) });
                                } catch (error) {
                                  setSubmitError(error instanceof Error ? error.message : "A variation file could not be read.");
                                }
                              }}
                              className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <VariationInput label="Download limit (0 = unlimited)" type="number" value={values.downloadLimit} onChange={(value) => update({ downloadLimit: value })} />
                            <VariationInput label="Expiry days (0 = never)" type="number" value={values.downloadExpiryDays} onChange={(value) => update({ downloadExpiryDays: value })} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What makes this piece worth listing?"
            rows={3}
            className="resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-500 dark:focus:ring-brand-950"
          />
        </label>

        {submitError ? <p role="alert" className="m-0 text-sm font-medium text-red-600 dark:text-red-400">{submitError}</p> : null}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          <Store className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? (isEditing ? "Saving…" : "Publishing…") : isEditing ? "Save changes" : "List product"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function VariationInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-[11px] font-medium text-zinc-500">
      <span>{label}</span>
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs text-zinc-900 outline-none focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
    </label>
  );
}

function parseProductIds(value: string): number[] {
  return Array.from(new Set(
    value
      .split(",")
      .map((item) => Number.parseInt(item.trim(), 10))
      .filter((item) => Number.isInteger(item) && item > 0),
  ));
}

function isValidPrice(value: number | null): value is number {
  return value !== null && value >= 0;
}

function requireValidatedPrice(value: number | null, fieldLabel: string): number {
  if (!isValidPrice(value)) throw new Error(`${fieldLabel} is missing or invalid.`);
  return value;
}

function parseOptionalPrice(value: string): number | null | undefined {
  return value.trim() ? parseLocalizedPrice(value) : undefined;
}

function isValidCompareAtPrice(compareAtPrice: number | null | undefined, price: number | null): boolean {
  return compareAtPrice === undefined || (price !== null && compareAtPrice !== null && compareAtPrice >= price);
}

function isValidExternalUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function cartesianVariations(attributes: { name: string; options: string[] }[]): { name: string; option: string }[][] {
  return attributes.reduce<{ name: string; option: string }[][]>(
    (combinations, attribute) => combinations.flatMap((combination) =>
      attribute.options.map((option) => [...combination, { name: attribute.name, option }]),
    ),
    [[]],
  );
}

function readImage(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error(`${file.name} is larger than 5 MB.`));
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
    return Promise.reject(new Error(`${file.name} is not a supported image.`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error(`${file.name} could not be read.`));
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.readAsDataURL(file);
  });
}

/** Extensions accepted for downloadable product files — mirrors the backend allowlist. */
const DOWNLOADABLE_FILE_EXTENSIONS = [".pdf", ".zip", ".epub", ".mp3", ".mp4"];

export function readDownloadableFile(file: File): Promise<{ name: string; fileDataUrl: string }> {
  if (file.size > 20 * 1024 * 1024) return Promise.reject(new Error(`${file.name} is larger than 20 MB.`));
  const hasAllowedExtension = DOWNLOADABLE_FILE_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension));
  if (!hasAllowedExtension) return Promise.reject(new Error(`${file.name} must be a PDF, ZIP, EPUB, MP3, or MP4 file.`));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve({ name: file.name, fileDataUrl: reader.result }) : reject(new Error(`${file.name} could not be read.`));
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.readAsDataURL(file);
  });
}
