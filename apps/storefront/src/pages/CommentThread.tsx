import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { ViewSwitch, useT } from "@funky/ui";
import { primaryActionButtonClass, type ProductReview } from "./shared";
import {
  buildReviewTree,
  isPendingReview,
  isTopLevelReview,
  mergeServerAndLocalReviews,
  type ReviewNode,
} from "../lib/commentThreads";
import { authStore } from "../lib/auth";

function commentIdentity() {
  const user = authStore.load()?.user;
  return {
    author: user?.displayName || "",
    email: user?.email || "",
    authenticated: Boolean(user),
  };
}

/**
 * Generic, reusable WordPress-style threaded comments system — shared by the product
 * template's reviews section and the blog post template's discussion section, since
 * WordPress backs both with the same underlying `comment` entity (WooCommerce reviews
 * are just comments with an extra `rating` meta field). Ported/expanded from the legacy
 * prototype's `product-summary.js`, `product-review-list.js`, and `review-form.js` —
 * with real threaded replies added, which the legacy `reviews-list.js` never had.
 */

/** Real WordPress installs cap how deep a comment thread visually indents (Settings →
 * Discussion → "Thread comments N levels deep", default 5) even though the underlying
 * data can nest indefinitely — deeper replies just keep attaching to their true parent
 * but stop indenting further. We mirror that so very long threads stay readable. */
export const MAX_REPLY_VISUAL_DEPTH = 4;

export function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-brand-500 dark:text-brand-400">
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < Math.round(rating);
        return (
          <svg key={index} viewBox="0 0 20 20" className="h-4 w-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path d="M10 1.6l2.5 5.2 5.7.8-4.1 4 1 5.7L10 14.7l-5.1 2.6 1-5.7-4.1-4 5.7-.8L10 1.6Z" />
          </svg>
        );
      })}
    </span>
  );
}

export function summarizeReviews(reviews: ProductReview[]) {
  const histogram: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const ratedReviews = reviews.filter(
    (review): review is ProductReview & { rating: number } =>
      isTopLevelReview(review) && typeof review.rating === "number" && review.rating >= 1 && review.rating <= 5,
  );
  ratedReviews.forEach((review) => {
    histogram[Math.round(review.rating) as 1 | 2 | 3 | 4 | 5] += 1;
  });

  return {
    histogram,
    averageRating: ratedReviews.length
      ? ratedReviews.reduce((total, review) => total + review.rating, 0) / ratedReviews.length
      : undefined,
  };
}

/** Maps a string to a stable HSL colour, matching the legacy `product-review-list.js`'s
 * `stringToHSL` helper — used so avatar-less commenter/author initials still get a
 * distinct, consistent background colour per name. */
export function stringToHSL(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

export function ReviewSummary({
  averageRating,
  totalReviewCount,
  histogram,
}: {
  averageRating: number;
  totalReviewCount: number;
  histogram: Record<1 | 2 | 3 | 4 | 5, number>;
}) {
  return (
    <div className="grid gap-5 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:p-8 md:grid-cols-[auto_1fr] md:items-center md:gap-10">
      <div className="grid justify-items-center gap-1.5 text-center md:justify-items-start md:text-left">
        <strong className="font-display text-4xl font-bold text-zinc-900 dark:text-zinc-100">{averageRating.toFixed(1)}</strong>
        <StarRating rating={averageRating} />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{totalReviewCount} reviews</span>
      </div>

      <div className="grid gap-2">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = histogram[star] ?? 0;
          const percentage = totalReviewCount ? Math.round((count / totalReviewCount) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="w-8 shrink-0 font-medium text-zinc-700 dark:text-zinc-300">{star}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${percentage}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Truncates long comment/review bodies to 5 lines by default (CSS `line-clamp-5`)
 * with an accessible "Read more"/"Hide" toggle — shared by every comment/review
 * surface in the app via `ReviewCard` below, so the behavior stays consistent
 * everywhere WordPress comments or WooCommerce reviews are rendered. Short content
 * that never actually overflows 5 lines renders as-is, with no toggle button. */
function ClampedText({ text, className = "" }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  // A hidden, always-clamped probe mirrors the visible text so overflow can be
  // measured independently of whether the real paragraph is currently expanded —
  // avoids the visible element's own clamp toggling ever affecting the measurement.
  const probeRef = useRef<HTMLParagraphElement>(null);
  const contentId = useId();

  useLayoutEffect(() => {
    const measure = () => {
      const el = probeRef.current;
      if (!el) return;
      setIsOverflowing(el.scrollHeight - el.clientHeight > 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text]);

  return (
    <div className="relative grid gap-1.5">
      <p
        aria-hidden="true"
        ref={probeRef}
        className={`pointer-events-none invisible absolute inset-x-0 top-0 m-0 line-clamp-5 whitespace-pre-line text-sm leading-relaxed ${className}`.trim()}
      >
        {text}
      </p>
      <p
        id={contentId}
        className={`m-0 whitespace-pre-line text-sm leading-relaxed ${expanded ? "" : "line-clamp-5"} ${className}`.trim()}
      >
        {text}
      </p>
      {isOverflowing ? (
        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="justify-self-start text-xs font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
        >
          {expanded ? "Hide" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}

function ReviewCard({
  review,
  isPending,
  showRating,
}: {
  review: ProductReview;
  isPending: boolean;
  showRating: boolean;
}) {
  const initials = review.author
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="grid gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: stringToHSL(review.author) }}
            aria-hidden="true"
          >
            {initials}
          </span>
          <div className="grid">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{review.author}</span>
            {showRating && typeof review.rating === "number" ? <StarRating rating={review.rating} /> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPending ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Awaiting moderation
            </span>
          ) : null}
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {new Date(review.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
          </span>
        </div>
      </div>
      <ClampedText text={review.content} className="text-zinc-600 dark:text-zinc-300" />
    </div>
  );
}

/** Compact inline reply form — a stripped-down `ReviewForm` (no star rating, since a
 * reply is a plain WordPress comment) rendered directly under the review/reply it's
 * attached to, so a thread can grow deeper and deeper without leaving the list. */
function ReplyForm({ onSubmit }: { onSubmit: (reply: { author: string; email: string; content: string }) => Promise<void> }) {
  const t = useT();
  const [identity] = useState(commentIdentity);
  const [author, setAuthor] = useState(identity.author);
  const [email, setEmail] = useState(identity.email);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!author.trim() || !email.trim() || !content.trim()) {
      setFormError(t("validation.required"));
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setFormError(t("validation.email"));
      return;
    }

    setFormError("");
    setIsSubmitting(true);

    try {
      await onSubmit({ author: author.trim(), email: email.trim(), content: content.trim() });
      if (!identity.authenticated) {
        setAuthor("");
        setEmail("");
      }
      setContent("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("error.reply_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
    >
      {formError ? <p className="m-0 text-xs font-medium text-red-600 dark:text-red-400">{formError}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          disabled={isSubmitting}
          placeholder="Name"
          required
          className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:ring-brand-950"
        />
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSubmitting}
          placeholder="Email"
          required
          className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:ring-brand-950"
        />
      </div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={isSubmitting}
        placeholder="Write a reply…"
        rows={3}
        required
        className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:ring-brand-950"
      />
      <div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          Post reply
        </button>
      </div>
    </form>
  );
}

/** Recursively renders a review/comment and its replies — supports replying to a reply
 * to a reply, and so on, the way WordPress's native threaded comments allow. */
function ReviewThread({
  review,
  depth,
  onReply,
  showRatings,
}: {
  review: ReviewNode;
  depth: number;
  onReply: (parent: ProductReview, reply: { author: string; email: string; content: string }) => Promise<void>;
  showRatings: boolean;
}) {
  const [isReplying, setIsReplying] = useState(false);
  const visualDepth = Math.min(depth, MAX_REPLY_VISUAL_DEPTH);
  const canReply = !isPendingReview(review);

  return (
    <div
      className={visualDepth > 0 ? "border-l-2 border-zinc-100 pl-4 dark:border-zinc-800 sm:pl-5" : undefined}
      style={visualDepth > 0 ? { marginLeft: visualDepth * 16 } : undefined}
    >
      <ReviewCard review={review} isPending={isPendingReview(review)} showRating={showRatings} />

      {canReply ? (
        <button
          type="button"
          onClick={() => setIsReplying((previous) => !previous)}
          className="mt-2 text-xs font-semibold text-brand-600 transition hover:text-brand-700 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
        >
          {isReplying ? "Cancel" : "Reply"}
        </button>
      ) : null}

      {canReply && isReplying ? (
        <div className="mt-3">
          <ReplyForm
            onSubmit={async (reply) => {
              await onReply(review, reply);
              setIsReplying(false);
            }}
          />
        </div>
      ) : null}

      {review.replies.length ? (
        <div className="mt-4 grid gap-4">
          {review.replies.map((reply) => (
            <ReviewThread
              key={reply.id}
              review={reply}
              depth={depth + 1}
              onReply={onReply}
              showRatings={showRatings}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ReviewForm({
  onSubmit,
  formTitle = "Leave a review",
  formNote = "Submissions are held for moderation and only appear once approved.",
  showRatingField = true,
}: {
  onSubmit: (review: { author: string; email: string; content: string; rating?: number }) => Promise<void>;
  formTitle?: string;
  formNote?: string;
  showRatingField?: boolean;
}) {
  const t = useT();
  const [identity] = useState(commentIdentity);
  const [author, setAuthor] = useState(identity.author);
  const [email, setEmail] = useState(identity.email);
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!author.trim() || !email.trim() || !content.trim()) {
      setFormError("All fields are required.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    setFormError("");
    setIsSubmitting(true);

    try {
      await onSubmit({ author: author.trim(), email: email.trim(), content: content.trim(), ...(showRatingField ? { rating } : {}) });
      setShowSuccess(true);
      if (!identity.authenticated) {
        setAuthor("");
        setEmail("");
      }
      setContent("");
      setRating(5);
      window.setTimeout(() => setShowSuccess(false), 4000);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("error.review_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-4 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
      <div className="grid gap-1">
        <h3 className="m-0 font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">{formTitle}</h3>
        <p className="m-0 text-xs text-zinc-500 dark:text-zinc-400">{formNote}</p>
      </div>

      {showSuccess ? (
        <div className="rounded-xl bg-emerald-100 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          ✅ Your submission has been recorded and awaits approval.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Name</span>
            <input
              type="text"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              disabled={isSubmitting}
              required
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:bg-zinc-900 dark:focus:ring-brand-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              required
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:bg-zinc-900 dark:focus:ring-brand-950"
            />
          </label>
        </div>

        {showRatingField ? <div className="grid gap-1.5 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Rating</span>
          <div
            className="flex w-fit gap-1"
            onMouseLeave={() => setHoveredRating(null)}
            role="radiogroup"
            aria-label="Rating out of 5"
          >
            {[1, 2, 3, 4, 5].map((value) => {
              const filled = value <= (hoveredRating ?? rating);
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} star${value > 1 ? "s" : ""}`}
                  onMouseEnter={() => setHoveredRating(value)}
                  onClick={() => setRating(value)}
                  disabled={isSubmitting}
                  className="p-0.5 text-amber-400 transition hover:scale-110"
                >
                  <Star className="h-6 w-6" fill={filled ? "currentColor" : "none"} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div> : null}

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Comment</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            disabled={isSubmitting}
            required
            rows={4}
            className="resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:bg-zinc-900 dark:focus:ring-brand-950"
          />
        </label>

        {formError ? <p className="m-0 text-sm text-rose-600 dark:text-rose-400">{formError}</p> : null}

        <button type="submit" disabled={isSubmitting} className={`${primaryActionButtonClass} justify-self-start disabled:cursor-not-allowed disabled:opacity-60`}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {isSubmitting ? "Submitting…" : "Submit"}
        </button>
      </form>
    </div>
  );
}

/** Discussion layout for the `"full"` variant: `"stacked"` (default, current) is the
 * feed above the submission form, both full width. `"split-left"`/`"split-right"` put
 * the feed and form side by side in two columns — the feed becomes an independently
 * scrollable column (its own `max-h`/`overflow-y-auto`) while the form stays put,
 * `"split-left"` keeps the feed on the left (form right), `"split-right"` swaps them. */
export type CommentsDiscussionLayout = "stacked" | "split-left" | "split-right";

const DISCUSSION_LAYOUT_OPTIONS: { value: CommentsDiscussionLayout; label: string }[] = [
  { value: "stacked", label: "Stacked (current)" },
  { value: "split-left", label: "Split — feed left" },
  { value: "split-right", label: "Split — feed right" },
];

/** Full comments/reviews section — summary + threaded list + submission form. Reused
 * as-is by both the product template ("Reviews") and the blog post template
 * ("Comments"), since both are ultimately just WordPress comment threads on a post. */
export function CommentsSection({
  anchorId,
  contentKey,
  heading,
  initialReviews,
  ratingHistogram,
  averageRating,
  totalCountOverride,
  formTitle,
  formNote,
  /** `"full"` (default) is the current threaded discussion — nested replies, a reply
   * button per comment, and the submission form. `"compact"` is a read-only teaser:
   * only the first `maxVisibleCompact` top-level comments, no nesting/reply UI, no
   * form — for embedding a shortcode summary inside a sidebar, dashboard widget, or a
   * shortcode-library/style-guide preview without pulling in the full thread. */
  variant = "full",
  maxVisibleCompact = 3,
  /** Only shown/used when `variant === "full"`. Lets a merchant try the feed+form as
   * a two-column layout with an independently scrollable feed instead of one long
   * stacked page. */
  showLayoutSwitch = true,
  /** When provided, overrides the internal `discussionLayout` state and suppresses
   * the local switch (regardless of `showLayoutSwitch`) — used by real storefront
   * pages to render the backend's `discussionLayout` Control Center setting instead
   * of a visitor-facing toggle. Omit to preserve the existing dev/docs behavior
   * (e.g. the shortcode library's kitchen-sink preview). */
  discussionLayout: discussionLayoutOverride,
  showRatingField = true,
  onSubmitReview,
  onSubmitReply,
}: {
  anchorId: string;
  contentKey: string;
  heading: string;
  initialReviews: ProductReview[];
  ratingHistogram?: Record<1 | 2 | 3 | 4 | 5, number>;
  averageRating?: number;
  totalCountOverride?: number;
  formTitle?: string;
  formNote?: string;
  variant?: "full" | "compact";
  maxVisibleCompact?: number;
  showLayoutSwitch?: boolean;
  discussionLayout?: CommentsDiscussionLayout;
  showRatingField?: boolean;
  onSubmitReview?: (review: { author: string; email: string; content: string; rating?: number }) => Promise<ProductReview>;
  onSubmitReply?: (
    parent: ProductReview,
    reply: { author: string; email: string; content: string },
  ) => Promise<ProductReview>;
}) {
  const [localState, setLocalState] = useState<{ contentKey: string; reviews: ProductReview[] }>({
    contentKey,
    reviews: [],
  });
  const [internalDiscussionLayout, setInternalDiscussionLayout] = useState<CommentsDiscussionLayout>("stacked");
  const discussionLayout = discussionLayoutOverride ?? internalDiscussionLayout;
  const localReviews = localState.contentKey === contentKey ? localState.reviews : [];
  const reviews = useMemo(
    () => mergeServerAndLocalReviews(initialReviews, localReviews),
    [initialReviews, localReviews],
  );
  const totalReviewCount = totalCountOverride ?? reviews.length;
  const reviewTree = useMemo(() => buildReviewTree(reviews), [reviews]);

  const handleSubmit = async (review: { author: string; email: string; content: string; rating?: number }) => {
    const submitted = onSubmitReview
      ? await onSubmitReview(review)
      : { ...review, id: `pending-${Date.now()}`, date: new Date().toISOString() };
    const normalized = { ...submitted, parentId: null, parentDatabaseId: 0 };
    setLocalState((previous) => ({
      contentKey,
      reviews: [normalized, ...(previous.contentKey === contentKey ? previous.reviews : [])],
    }));
  };

  const handleReply = async (parent: ProductReview, reply: { author: string; email: string; content: string }) => {
    const submitted = onSubmitReply
      ? await onSubmitReply(parent, reply)
      : {
          ...reply,
          id: `pending-${Date.now()}`,
          date: new Date().toISOString(),
          parentId: parent.id,
        };
    const normalized = {
      ...submitted,
      parentId: submitted.parentId || parent.id,
      parentDatabaseId: submitted.parentDatabaseId ?? parent.databaseId ?? null,
      rating: undefined,
    };
    setLocalState((previous) => ({
      contentKey,
      reviews: [...(previous.contentKey === contentKey ? previous.reviews : []), normalized],
    }));
  };

  const feed = (
    <div className="grid gap-5">
      {reviewTree.map((review) => (
        <ReviewThread
          key={review.id}
          review={review}
          depth={0}
          onReply={handleReply}
          showRatings={showRatingField}
        />
      ))}
    </div>
  );
  const form = <ReviewForm onSubmit={handleSubmit} formTitle={formTitle} formNote={formNote} showRatingField={showRatingField} />;

  return (
    <section id={anchorId} className="grid gap-8 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">
        {heading} <span className="font-medium text-zinc-400 dark:text-zinc-500">({totalReviewCount})</span>
      </h2>

      {ratingHistogram && typeof averageRating === "number" ? (
        <ReviewSummary averageRating={averageRating} totalReviewCount={totalReviewCount} histogram={ratingHistogram} />
      ) : null}

      {variant === "compact" ? (
        <div className="grid gap-4">
          {reviewTree.slice(0, maxVisibleCompact).map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isPending={isPendingReview(review)}
              showRating={showRatingField}
            />
          ))}
        </div>
      ) : (
        <>
          {showLayoutSwitch && discussionLayoutOverride === undefined ? (
            <ViewSwitch
              label="Discussion layout"
              value={discussionLayout}
              onChange={setInternalDiscussionLayout}
              options={DISCUSSION_LAYOUT_OPTIONS}
            />
          ) : null}

          {discussionLayout === "stacked" ? (
            <>
              {feed}
              {form}
            </>
          ) : (
            <div className="grid gap-8 lg:grid-cols-2">
              {discussionLayout === "split-left" ? (
                <>
                  <div className="lg:max-h-[70vh] lg:overflow-y-auto lg:pr-2">{feed}</div>
                  <div className="lg:sticky lg:top-28 lg:self-start">{form}</div>
                </>
              ) : (
                <>
                  <div className="lg:sticky lg:top-28 lg:order-1 lg:self-start">{form}</div>
                  <div className="lg:order-2 lg:max-h-[70vh] lg:overflow-y-auto lg:pl-2">{feed}</div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
