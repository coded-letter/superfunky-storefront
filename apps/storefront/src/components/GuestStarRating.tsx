import { useEffect, useId, useState } from "react";
import { useT } from "@funky/ui";
import {
  applyViewerRating,
  fetchEngagementRating,
  getOrCreateRatingBrowserToken,
  submitEngagementRating,
  type EngagementRatingSummary,
  type PublicEngagementRatingSummary,
  type RatingTargetType,
} from "../lib/engagementRatings";

export function GuestStarRating({
  targetType,
  targetId,
  initialSummary,
}: {
  targetType: RatingTargetType;
  targetId: number;
  initialSummary: PublicEngagementRatingSummary;
}) {
  const t = useT();
  const groupName = useId();
  const safeInitialSummary = normalizeInitialSummary(initialSummary);
  const [summary, setSummary] = useState<EngagementRatingSummary>({ ...safeInitialSummary, viewerRating: null });
  const [browserToken, setBrowserToken] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSummary({ ...normalizeInitialSummary(initialSummary), viewerRating: null });
    setError(null);
    try {
      const token = getOrCreateRatingBrowserToken();
      setBrowserToken(token);
      void fetchEngagementRating(targetType, targetId, token)
        .then((nextSummary) => {
          if (active) setSummary(nextSummary);
        })
        .catch((reason) => {
          if (active) setError(reason instanceof Error ? reason.message : t("rating.load_error"));
        });
    } catch (reason) {
      setBrowserToken(null);
      setError(reason instanceof Error ? reason.message : t("rating.storage_error"));
    }
    return () => {
      active = false;
    };
  }, [initialSummary, t, targetId, targetType]);

  const chooseRating = async (rating: number) => {
    if (!browserToken || isSaving) return;
    const previous = summary;
    setError(null);
    setIsSaving(true);
    setSummary(applyViewerRating(previous, rating));
    try {
      setSummary(await submitEngagementRating(targetType, targetId, rating, browserToken));
    } catch (reason) {
      setSummary(previous);
      setError(reason instanceof Error ? reason.message : t("rating.save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      aria-label={t("rating.aria")}
      className="sf-rating grid w-fit gap-2 rounded-2xl border border-zinc-200/80 bg-white px-4 py-3 shadow-soft dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <strong className="text-sm text-zinc-900 dark:text-zinc-100">
          {summary.average === null ? t("rating.not_rated") : t("rating.average", { average: summary.average.toFixed(1) })}
        </strong>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {t("rating.count", { count: summary.count })}
        </span>
      </div>
      <fieldset className="m-0 border-0 p-0" disabled={isSaving || !browserToken}>
        <legend className="sr-only">{t("rating.legend")}</legend>
        <div className="flex items-center gap-1">
          {([1, 2, 3, 4, 5] as const).map((star) => (
            <span key={star}>
              <input
                id={`${groupName}-${star}`}
                className="peer sr-only"
                type="radio"
                name={groupName}
                value={star}
                checked={summary.viewerRating === star}
                onChange={() => void chooseRating(star)}
              />
              <label
                htmlFor={`${groupName}-${star}`}
                aria-label={t("rating.star_aria", { count: star })}
                className={`cursor-pointer text-2xl leading-none transition hover:scale-110 focus-within:outline-none peer-focus-visible:rounded peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 ${
                  summary.viewerRating !== null && star <= summary.viewerRating
                    ? "text-amber-400"
                    : "text-zinc-300 hover:text-amber-300 dark:text-zinc-700"
                }`}
              >
                ★
              </label>
            </span>
          ))}
          <span className="ml-2 text-xs font-medium text-zinc-500 dark:text-zinc-400" aria-live="polite">
            {isSaving ? t("rating.saving") : summary.viewerRating ? t("rating.saved_hint") : t("rating.choose")}
          </span>
        </div>
      </fieldset>
      {error ? <p role="alert" className="m-0 max-w-md text-xs font-medium text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  );
}

export function normalizeInitialSummary(value: Partial<PublicEngagementRatingSummary> | null | undefined): PublicEngagementRatingSummary {
  const count = Number.isInteger(value?.count) && Number(value?.count) >= 0 ? Number(value?.count) : 0;
  const averageValue = Number(value?.average);
  const average = count > 0 && Number.isFinite(averageValue) && averageValue >= 1 && averageValue <= 5
    ? averageValue
    : null;
  const histogram = Array.isArray(value?.histogram) && value.histogram.length === 5
    ? value.histogram.map((item) => Number.isInteger(item) && Number(item) >= 0 ? Number(item) : 0)
    : [0, 0, 0, 0, 0];
  return {
    average,
    count,
    guestCount: Number.isInteger(value?.guestCount) && Number(value?.guestCount) >= 0 ? Number(value?.guestCount) : 0,
    authoredCount: Number.isInteger(value?.authoredCount) && Number(value?.authoredCount) >= 0 ? Number(value?.authoredCount) : 0,
    histogram: histogram as PublicEngagementRatingSummary["histogram"],
  };
}
