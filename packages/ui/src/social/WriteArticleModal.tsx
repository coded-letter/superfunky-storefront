import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Languages, PencilLine, X } from "lucide-react";
import { useToast } from "../state";
import { slugify } from "./slugify";

export type WriteArticleTranslationCandidate = {
  databaseId: number;
  title: string;
  languageCode: string;
  uri: string;
};

export type WriteArticleDraft = {
  postId?: number;
  imagePreview: string | null;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  body: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  translationOfId?: number;
};

/** Pre-fills the form for editing an existing collaborator post the viewer owns. */
export type WriteArticleInitialValues = {
  postId: number;
  imageUrl?: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  body: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  languageCode: string;
  translationOfId?: number;
  translationOfTitle?: string;
};

export type WriteArticleModalProps = {
  onClose: () => void;
  /** Publishes the validated draft through the host application's collaborator-post mutation. */
  onSubmit?: (draft: WriteArticleDraft) => void | Promise<void>;
  /** When provided, the modal opens pre-filled in "edit" mode for this existing post. */
  initialPost?: WriteArticleInitialValues;
  /**
   * Looks up existing posts (in other languages) for the "this is a translation of…"
   * picker. The host is responsible for the actual GraphQL search — see
   * `searchTranslationCandidatePosts` in the storefront's `lib/community.ts`.
   */
  searchTranslationCandidates?: (query: string) => Promise<WriteArticleTranslationCandidate[]>;
};

/**
 * Collaborator-authored article publishing form for the WordPress blog. Content is
 * treated as HTML: it is rendered through WPGraphQL's `content(format: RENDERED)` on
 * the read side, which runs the standard `the_content` filter — so shortcodes written
 * here expand normally with no extra plumbing, and the backend still sanitizes with
 * `wp_kses_post()` before saving. Supports both creating a new article and editing an
 * existing one via `initialPost`, plus basic SEO fields and Polylang translation
 * association (linking this post to an existing post in another language).
 */
export function WriteArticleModal({ onClose, onSubmit, initialPost, searchTranslationCandidates }: WriteArticleModalProps) {
  const { showToast } = useToast();
  const isEditing = Boolean(initialPost);
  const [imagePreview, setImagePreview] = useState<string | null>(initialPost?.imageUrl || null);
  const [title, setTitle] = useState(initialPost?.title || "");
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt || "");
  const [category, setCategory] = useState(initialPost?.category || "");
  const [tagsInput, setTagsInput] = useState(initialPost?.tags.join(", ") || "");
  const [body, setBody] = useState(initialPost?.body || "");
  const [slug, setSlug] = useState(initialPost?.slug || "");
  const [slugEditedManually, setSlugEditedManually] = useState(Boolean(initialPost?.slug));
  const [metaTitle, setMetaTitle] = useState(initialPost?.metaTitle || "");
  const [metaDescription, setMetaDescription] = useState(initialPost?.metaDescription || "");
  const [focusKeyword, setFocusKeyword] = useState(initialPost?.focusKeyword || "");
  const [translationQuery, setTranslationQuery] = useState("");
  const [translationResults, setTranslationResults] = useState<WriteArticleTranslationCandidate[]>([]);
  const [isSearchingTranslations, setIsSearchingTranslations] = useState(false);
  const [selectedTranslation, setSelectedTranslation] = useState<WriteArticleTranslationCandidate | null>(
    initialPost?.translationOfId
      ? { databaseId: initialPost.translationOfId, title: initialPost.translationOfTitle || `Post #${initialPost.translationOfId}`, languageCode: "", uri: "" }
      : null,
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

  // Keep the slug in sync with the title until the author edits it directly.
  useEffect(() => {
    if (slugEditedManually) return;
    setSlug(slugify(title));
  }, [title, slugEditedManually]);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!searchTranslationCandidates) return;
    const query = translationQuery.trim();
    if (query.length < 2) {
      setTranslationResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearchingTranslations(true);
      try {
        const results = await searchTranslationCandidates(query);
        setTranslationResults(results);
      } catch {
        setTranslationResults([]);
      } finally {
        setIsSearchingTranslations(false);
      }
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [translationQuery, searchTranslationCandidates]);

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

  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit?.({
        postId: initialPost?.postId,
        imagePreview,
        title: title.trim(),
        excerpt: excerpt.trim() || `${stripHtml(body).slice(0, 140)}${stripHtml(body).length > 140 ? "…" : ""}`,
        category: category.trim(),
        tags,
        body: body.trim(),
        slug: slug.trim() || slugify(title),
        metaTitle: metaTitle.trim(),
        metaDescription: metaDescription.trim(),
        focusKeyword: focusKeyword.trim(),
        translationOfId: selectedTranslation?.databaseId,
      });
      showToast({
        title: isEditing ? "Article updated" : "Article published",
        description: isEditing ? "Your changes are now live." : "It now appears in the WordPress blog.",
        tone: "success",
      });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The article could not be published.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-500 dark:focus:ring-brand-950";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? "Edit article" : "Write a new article"}
      onClick={onClose}
    >
      <div
        className="funky-write-article-modal relative grid max-h-[90vh] w-full max-w-3xl gap-5 overflow-y-auto rounded-3xl bg-white p-6 shadow-soft-lg dark:bg-zinc-900 sm:p-8"
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
          <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">{isEditing ? "Edit article" : "Write a new article"}</h2>
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            {isEditing
              ? "Update the details below — changes publish immediately to the WordPress blog."
              : "Collaborator accounts can publish this article directly to the WordPress blog."}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* Main column: the article's own content. */}
          <div className="grid gap-5">
            <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              <span>Title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Building a five-piece capsule for winter"
                className={fieldClass}
              />
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              <span>Slug</span>
              <input
                type="text"
                value={slug}
                onChange={(event) => {
                  setSlugEditedManually(true);
                  setSlug(event.target.value);
                }}
                placeholder="building-a-five-piece-capsule-for-winter"
                className={fieldClass}
              />
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              <span>Excerpt</span>
              <textarea
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                placeholder="A one or two sentence teaser — left blank, we'll use the start of your body text."
                rows={2}
                className={`resize-none ${fieldClass}`}
              />
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              <span>Body</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write your article. Basic HTML tags (e.g. <p>, <strong>, <a>) and shortcodes are supported."
                rows={12}
                className={`resize-y font-mono text-[13px] leading-relaxed ${fieldClass}`}
              />
              <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
                Supports safe HTML and WordPress shortcodes — content is sanitized on save and shortcodes expand when the article is rendered.
              </span>
            </label>
          </div>

          {/* Sidebar: cover photo, taxonomy, SEO, and translation association. */}
          <div className="grid content-start gap-5">
            <label className="grid aspect-[16/9] cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 text-center transition hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-950">
              {imagePreview ? (
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid place-items-center gap-2 p-6 text-zinc-400 dark:text-zinc-500">
                  <ImagePlus className="h-8 w-8" aria-hidden="true" />
                  <span className="text-sm font-semibold">Click to choose a cover photo</span>
                  <span className="text-xs">JPG, PNG, or GIF</span>
                </span>
              )}
              <input type="file" accept="image/png, image/jpeg, image/gif, image/webp" onChange={handleImageChange} className="sr-only" />
            </label>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <span>Category</span>
                <input
                  type="text"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Style Guides"
                  className={fieldClass}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <span>Tags</span>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(event) => setTagsInput(event.target.value)}
                  placeholder="capsule, winter"
                  className={fieldClass}
                />
              </label>
            </div>

            <div className="grid gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
              <h3 className="m-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100">SEO</h3>
              <label className="grid gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                <span>Meta title</span>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={(event) => setMetaTitle(event.target.value)}
                  placeholder="Defaults to the article title"
                  className={fieldClass}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                <span>Meta description</span>
                <textarea
                  value={metaDescription}
                  onChange={(event) => setMetaDescription(event.target.value)}
                  placeholder="Shown in search results — aim for 150–160 characters."
                  rows={2}
                  className={`resize-none ${fieldClass}`}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                <span>Focus keyword</span>
                <input
                  type="text"
                  value={focusKeyword}
                  onChange={(event) => setFocusKeyword(event.target.value)}
                  placeholder="capsule wardrobe"
                  className={fieldClass}
                />
              </label>
            </div>

            {searchTranslationCandidates ? (
              <div className="grid gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
                <h3 className="m-0 flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <Languages className="h-4 w-4" aria-hidden="true" />
                  Translation of
                </h3>
                <p className="m-0 text-xs text-zinc-500 dark:text-zinc-400">
                  Link this article to an existing post in another language so readers can switch between translations.
                </p>
                {selectedTranslation ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                    <span className="truncate">{selectedTranslation.title}</span>
                    <button type="button" onClick={() => setSelectedTranslation(null)} aria-label="Remove translation association" className="shrink-0">
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={translationQuery}
                      onChange={(event) => setTranslationQuery(event.target.value)}
                      placeholder="Search posts by title…"
                      className={fieldClass}
                    />
                    {isSearchingTranslations ? <p className="m-0 text-xs text-zinc-400">Searching…</p> : null}
                    {translationResults.length ? (
                      <ul className="m-0 grid list-none gap-1 p-0">
                        {translationResults.map((candidate) => (
                          <li key={candidate.databaseId}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTranslation(candidate);
                                setTranslationQuery("");
                                setTranslationResults([]);
                              }}
                              className="w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              {candidate.title} <span className="uppercase text-zinc-400">({candidate.languageCode})</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {submitError ? <p role="alert" className="m-0 text-sm font-medium text-red-600 dark:text-red-400">{submitError}</p> : null}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          <PencilLine className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? (isEditing ? "Saving…" : "Publishing…") : isEditing ? "Save changes" : "Publish"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** URL-safe slug derived from a title — mirrors WordPress's own sanitize_title() behaviour closely enough for a client-side preview. */
function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
