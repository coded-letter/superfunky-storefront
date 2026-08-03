import { useEffect, useState } from "react";
import { ZoomIn } from "lucide-react";
import { ProductImageLightbox } from "./ProductImageLightbox";
import { ResponsiveImage } from "../media";

export type ProductGalleryImage = {
  id: string;
  label: string;
  src?: string;
  alt?: string;
  /** Tailwind gradient stop classes so each mock image is visually distinct without real assets. */
  accentClass?: string;
};

export type ProductGalleryProps = {
  images: ProductGalleryImage[];
  /** Selects a gallery image when an external choice, such as a variation, changes. */
  selectedImageId?: string;
};

const DEFAULT_ACCENT = "from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-900";

/**
 * Main image + thumbnail strip, mirroring the legacy prototype's product gallery
 * (`components/shop/lightbox.js`): hovering or clicking a thumbnail swaps the main
 * image, and clicking the main image opens the full `ProductImageLightbox` (zoom, pan,
 * swipe, keyboard nav). No real product photography exists yet, so each "image" is a
 * labelled, colour-coded placeholder — swap in `<img>` once real media is wired up.
 */
export function ProductGallery({ images, selectedImageId }: ProductGalleryProps) {
  const [selectedId, setSelectedId] = useState(images[0]?.id);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const selected = images.find((image) => image.id === selectedId) ?? images[0];
  const selectedIndex = Math.max(
    0,
    images.findIndex((image) => image.id === selected?.id),
  );

  useEffect(() => {
    if (selectedImageId) setSelectedId(selectedImageId);
  }, [selectedImageId]);

  if (!selected) return null;

  return (
    <div className="funky-product-gallery grid gap-4">
      <button
        type="button"
        onClick={() => setIsLightboxOpen(true)}
        aria-label={`View ${selected.label} in full screen`}
        className={`group relative grid aspect-square place-items-center overflow-hidden rounded-3xl bg-gradient-to-br shadow-soft transition hover:shadow-soft-lg ${
          selected.accentClass ?? DEFAULT_ACCENT
        }`}
      >
        {selected.src ? (
          <ResponsiveImage
            src={selected.src}
            alt={selected.alt || selected.label}
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="block h-full w-full object-cover"
          />
        ) : (
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{selected.label}</span>
        )}
        <span className="pointer-events-none absolute bottom-3 right-3 inline-grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
          <ZoomIn className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>

      {images.length > 1 ? (
        <div className="scrollbar-thin flex gap-3 overflow-x-auto p-1">
          {images.map((image) => {
            const isSelected = image.id === selected.id;
            return (
              <button
                key={image.id}
                type="button"
                onMouseEnter={() => setSelectedId(image.id)}
                onClick={() => setSelectedId(image.id)}
                aria-label={`Show ${image.label}`}
                aria-current={isSelected}
                className={`grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br shadow-soft transition ${
                  image.accentClass ?? DEFAULT_ACCENT
                } ${isSelected ? "ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950" : "opacity-70 hover:opacity-100"}`}
              >
                {image.src ? (
                  <ResponsiveImage src={image.src} alt="" sizes="5rem" className="block h-full w-full object-cover" aria-hidden="true" />
                ) : (
                  <span className="px-1 text-center text-[0.6rem] font-medium text-zinc-600 dark:text-zinc-300">{image.label}</span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {isLightboxOpen ? (
        <ProductImageLightbox
          images={images}
          startIndex={selectedIndex}
          onIndexChange={(index) => setSelectedId(images[index]?.id)}
          onClose={() => setIsLightboxOpen(false)}
        />
      ) : null}
    </div>
  );
}
