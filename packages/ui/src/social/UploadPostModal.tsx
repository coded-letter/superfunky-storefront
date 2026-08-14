import { useEffect, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Film, ImagePlus, Languages, Trash2, Upload, X } from "lucide-react";
import { useToast } from "../state";

const SUPPORTED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4"]);
const MAX_MEDIA_COUNT = 5;
const MAX_CLIENT_FILE_BYTES = 100 * 1024 * 1024;

export type UploadPostMediaDraft = {
  key: string;
  attachmentId?: number;
  previewUrl: string;
  dataUrl?: string;
  mimeType: string;
  mediaType: "image" | "video";
};

export type UploadPostDraft = {
  title: string;
  description: string;
  tags: string[];
  media: UploadPostMediaDraft[];
  languageCode: string;
  translationOfId?: number;
};

export type UploadPostInitialValues = {
  title: string;
  description?: string;
  tags?: string[];
  media: {
    attachmentId: number;
    url: string;
    mimeType: string;
    mediaType: "image" | "video";
  }[];
  languageCode?: string;
  translationOfId?: number;
};

export type UploadPostTranslationCandidate = {
  databaseId: number;
  title: string;
};

export type UploadPostModalProps = {
  onClose: () => void;
  onSubmit?: (draft: UploadPostDraft) => void | Promise<void>;
  initialValues?: UploadPostInitialValues;
  languages?: Array<{ code: string; name: string }>;
  defaultLanguageCode?: string;
  searchTranslationCandidates?: (search: string, languageCode: string) => Promise<UploadPostTranslationCandidate[]>;
};

export function UploadPostModal({
  onClose,
  onSubmit,
  initialValues,
  languages = [],
  defaultLanguageCode = "en",
  searchTranslationCandidates,
}: UploadPostModalProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState(initialValues?.title || "");
  const [description, setDescription] = useState(initialValues?.description || "");
  const [tagsInput, setTagsInput] = useState(initialValues?.tags?.join(", ") || "");
  const [languageCode, setLanguageCode] = useState(initialValues?.languageCode || defaultLanguageCode);
  const [translationOfId, setTranslationOfId] = useState<number | undefined>(initialValues?.translationOfId);
  const [translationSearch, setTranslationSearch] = useState("");
  const [translationCandidates, setTranslationCandidates] = useState<UploadPostTranslationCandidate[]>([]);
  const [isSearchingTranslations, setIsSearchingTranslations] = useState(false);
  const [translationSearchError, setTranslationSearchError] = useState<string | null>(null);
  const [media, setMedia] = useState<UploadPostMediaDraft[]>(() =>
    initialValues?.media.map((item) => ({
      key: `attachment-${item.attachmentId}`,
      attachmentId: item.attachmentId,
      previewUrl: item.url,
      mimeType: item.mimeType,
      mediaType: item.mediaType,
    })) || [],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = Boolean(initialValues);

  useEffect(() => {
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  const handleMediaChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setSubmitError(null);
    if (media.length + files.length > MAX_MEDIA_COUNT) {
      setSubmitError(`Choose no more than ${MAX_MEDIA_COUNT} images or videos.`);
      return;
    }
    const unsupported = files.find((file) => !SUPPORTED_MEDIA_TYPES.has(file.type));
    if (unsupported) {
      setSubmitError(`${unsupported.name} is not a supported image or MP4 file.`);
      return;
    }
    const oversized = files.find((file) => file.size > MAX_CLIENT_FILE_BYTES);
    if (oversized) {
      setSubmitError(`${oversized.name} exceeds the maximum supported upload size.`);
      return;
    }

    try {
      const additions = await Promise.all(files.map(readMediaFile));
      setMedia((current) => [...current, ...additions].slice(0, MAX_MEDIA_COUNT));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The selected media could not be read.");
    }
  };

  const moveMedia = (index: number, direction: -1 | 1) => {
    setMedia((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const tags = tagsInput
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
  const canSubmit = media.length > 0 && title.trim().length > 0;

  useEffect(() => {
    const search = translationSearch.trim();
    if (!searchTranslationCandidates || search.length < 2) {
      setTranslationCandidates([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsSearchingTranslations(true);
      setTranslationSearchError(null);
      void searchTranslationCandidates(search, languageCode)
        .then((candidates) => {
          if (!cancelled) setTranslationCandidates(candidates);
        })
        .catch((error) => {
          if (!cancelled) {
            setTranslationCandidates([]);
            setTranslationSearchError(error instanceof Error ? error.message : "Translation search failed.");
          }
        })
        .finally(() => {
          if (!cancelled) setIsSearchingTranslations(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [languageCode, searchTranslationCandidates, translationSearch]);

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit?.({
        title: title.trim(),
        description: description.trim(),
        tags,
        media,
        languageCode,
        translationOfId,
      });
      showToast({
        title: isEditing ? "Post updated" : "Post published",
        description: isEditing ? "Your changes are now live." : "Your community post is now live.",
        tone: "success",
      });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : `The post could not be ${isEditing ? "updated" : "published"}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="sf-upload-post-modal fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-post-modal-title"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="funky-upload-post-modal relative grid max-h-[90vh] w-full max-w-2xl gap-5 overflow-y-auto rounded-3xl bg-white p-6 shadow-soft-lg dark:bg-zinc-900 sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close"
          className="absolute right-4 top-4 inline-grid h-9 w-9 place-items-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="grid gap-1 pr-8">
          <h2 id="community-post-modal-title" className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {isEditing ? "Edit community post" : "Share a new post"}
          </h2>
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            Add a title and up to five ordered images or MP4 videos. The site's upload rules are checked again when you save.
          </p>
        </div>

        <div className="grid gap-3">
          {media.length ? (
            <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
              {media.map((item, index) => (
                <li key={item.key} className="grid gap-2 rounded-2xl border border-zinc-200 p-2 dark:border-zinc-700">
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-950">
                    {item.mediaType === "video" ? (
                      <video src={item.previewUrl} controls playsInline preload="metadata" className="h-full w-full bg-black object-contain" />
                    ) : (
                      <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[0.65rem] font-semibold text-white">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {item.mediaType === "video" ? <Film className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                      {item.mediaType === "video" ? "MP4 video" : "Image"}
                    </span>
                    <span className="flex items-center gap-1">
                      <button type="button" onClick={() => moveMedia(index, -1)} disabled={index === 0} aria-label={`Move media ${index + 1} earlier`} className="rounded-full p-1.5 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800">
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => moveMedia(index, 1)} disabled={index === media.length - 1} aria-label={`Move media ${index + 1} later`} className="rounded-full p-1.5 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800">
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => setMedia((current) => current.filter((candidate) => candidate.key !== item.key))} aria-label={`Remove media ${index + 1}`} className="rounded-full p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}

          {media.length < MAX_MEDIA_COUNT ? (
            <label className="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-6 text-center transition hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-950">
              <span className="grid place-items-center gap-2 text-zinc-400 dark:text-zinc-500">
                <ImagePlus className="h-8 w-8" aria-hidden="true" />
                <span className="text-sm font-semibold">{media.length ? "Add more media" : "Choose images or MP4 videos"}</span>
                <span className="text-xs">JPG, PNG, GIF, WebP, or MP4 · {MAX_MEDIA_COUNT - media.length} remaining</span>
              </span>
              <input type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,video/mp4" onChange={handleMediaChange} className="sr-only" />
            </label>
          ) : null}
        </div>

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <span>Title</span>
          <input
            type="text"
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Give your post a clear title"
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-500 dark:focus:ring-brand-950"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <span>Description <span className="font-normal text-zinc-400">(optional)</span></span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add context, details, or a story"
            rows={4}
            className="resize-y rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-500 dark:focus:ring-brand-950"
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
          <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">Comma-separated tags help others find this post.</span>
        </label>

        {languages.length > 1 || searchTranslationCandidates ? (
          <div className="grid gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
            {languages.length > 1 ? (
              <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <span className="inline-flex items-center gap-2"><Languages className="h-4 w-4" aria-hidden="true" />Language</span>
                <select
                  value={languageCode}
                  onChange={(event) => {
                    setLanguageCode(event.target.value);
                    setTranslationOfId(undefined);
                    setTranslationCandidates([]);
                  }}
                  className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                >
                  {languages.map((language) => (
                    <option key={language.code} value={language.code}>{language.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {searchTranslationCandidates ? (
              <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <span>Translation of <span className="font-normal text-zinc-400">(optional)</span></span>
                <input
                  value={translationSearch}
                  onChange={(event) => {
                    setTranslationSearch(event.target.value);
                    setTranslationOfId(undefined);
                  }}
                  placeholder="Search community posts"
                  className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
                {isSearchingTranslations ? <span className="text-xs text-zinc-400">Searching…</span> : null}
                {translationSearchError ? <span role="alert" className="text-xs text-red-600 dark:text-red-400">{translationSearchError}</span> : null}
                {translationCandidates.length ? (
                  <select
                    value={translationOfId || ""}
                    onChange={(event) => setTranslationOfId(event.target.value ? Number(event.target.value) : undefined)}
                    className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <option value="">Not linked to another post</option>
                    {translationCandidates.map((candidate) => (
                      <option key={candidate.databaseId} value={candidate.databaseId}>{candidate.title}</option>
                    ))}
                  </select>
                ) : null}
              </label>
            ) : null}
          </div>
        ) : null}

        {submitError ? <p role="alert" className="m-0 text-sm font-medium text-red-600 dark:text-red-400">{submitError}</p> : null}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? (isEditing ? "Saving…" : "Publishing…") : (isEditing ? "Save changes" : "Post")}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function readMediaFile(file: File): Promise<UploadPostMediaDraft> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`${file.name} could not be read.`));
        return;
      }
      resolve({
        key: `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
        previewUrl: reader.result,
        dataUrl: reader.result,
        mimeType: file.type,
        mediaType: file.type === "video/mp4" ? "video" : "image",
      });
    };
    reader.readAsDataURL(file);
  });
}
