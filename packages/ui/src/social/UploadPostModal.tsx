import { useEffect, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Upload, X } from "lucide-react";
import { useToast } from "../state";

export type UploadPostModalProps = {
  onClose: () => void;
  /** Called with the mock draft when "Post" is clicked — the real integration point
   * once the backend exists (see the header comment below). */
  onSubmit?: (draft: { imagePreview: string | null; caption: string; tags: string[] }) => void | Promise<void>;
};

/**
 * Mock-only "share a photo" flow for the community feed — no upload target exists yet,
 * so this only previews the picked file locally via `FileReader` (same trick as the
 * account dashboard's avatar upload) and hands the draft back via `onSubmit`. Once the
 * WP backend exists, this becomes a `createSocialPost` GraphQL mutation: the image
 * uploaded to the media library first (or as a base64 payload, backend-dependent),
 * then a custom-post-type entry created carrying `{ mediaId, caption, tags[] }`,
 * authored by the logged-in customer rather than a staff `Author`.
 */
export function UploadPostModal({ onClose, onSubmit }: UploadPostModalProps) {
  const { showToast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [tagsInput, setTagsInput] = useState("");
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

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const tags = tagsInput
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);

  const canSubmit = Boolean(imagePreview) && caption.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit?.({ imagePreview, caption: caption.trim(), tags });
      showToast({ title: "Post published", description: "Your community post is now live.", tone: "success" });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The post could not be published.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Share a new post"
      onClick={onClose}
    >
      <div
        className="funky-upload-post-modal relative grid max-h-[90vh] w-full max-w-lg gap-5 overflow-y-auto rounded-3xl bg-white p-6 shadow-soft-lg dark:bg-zinc-900 sm:p-8"
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
          <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">Share a new post</h2>
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            Creator accounts can publish this image, caption, and tags directly to the community feed.
          </p>
        </div>

        <label className="grid aspect-[4/3] cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 text-center transition hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-950">
          {imagePreview ? (
            <img src={imagePreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid place-items-center gap-2 p-6 text-zinc-400 dark:text-zinc-500">
              <ImagePlus className="h-8 w-8" aria-hidden="true" />
              <span className="text-sm font-semibold">Click to choose a photo</span>
              <span className="text-xs">JPG, PNG, or GIF</span>
            </span>
          )}
          <input type="file" accept="image/png, image/jpeg, image/gif, image/webp" onChange={handleImageChange} className="sr-only" />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <span>Caption</span>
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="What's the story behind this fit?"
            rows={3}
            className="resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-500 dark:focus:ring-brand-950"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <span>Tags</span>
          <input
            type="text"
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            placeholder="ootd, sneakers, streetwear"
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-500 dark:focus:ring-brand-950"
          />
          <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">Comma-separated — helps others find this in the tag filter.</span>
        </label>

        {submitError ? <p role="alert" className="m-0 text-sm font-medium text-red-600 dark:text-red-400">{submitError}</p> : null}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? "Publishing…" : "Post"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
