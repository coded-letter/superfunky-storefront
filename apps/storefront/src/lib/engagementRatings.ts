import { restUrl } from "@funky/sdk";

export type RatingTargetType = "post" | "community_post" | "product";

export type EngagementRatingSummary = {
  average: number | null;
  count: number;
  guestCount: number;
  authoredCount: number;
  histogram: [number, number, number, number, number];
  viewerRating: number | null;
};

export type PublicEngagementRatingSummary = Omit<EngagementRatingSummary, "viewerRating">;

export const RATING_TOKEN_STORAGE_KEY = "funkycommerce.rating.browser-token.v1";
export const RATING_TOKEN_HEADER = "X-FunkyCommerce-Rating-Token";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type CryptoLike = Pick<Crypto, "getRandomValues"> & Partial<Pick<Crypto, "randomUUID">>;

export function createRatingBrowserToken(cryptography: CryptoLike = globalThis.crypto): string {
  if (typeof cryptography?.randomUUID === "function") {
    return cryptography.randomUUID().replaceAll("-", "");
  }
  if (typeof cryptography?.getRandomValues !== "function") {
    throw new Error("Secure browser token generation is unavailable");
  }
  const bytes = cryptography.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateRatingBrowserToken(
  storage: StorageLike = globalThis.localStorage,
  cryptography: CryptoLike = globalThis.crypto,
): string {
  const existing = storage.getItem(RATING_TOKEN_STORAGE_KEY);
  if (existing && /^[A-Za-z0-9_-]{32,128}$/.test(existing)) return existing;
  const token = createRatingBrowserToken(cryptography);
  storage.setItem(RATING_TOKEN_STORAGE_KEY, token);
  return token;
}

export function mapPublicEngagementRating(value: unknown): PublicEngagementRatingSummary {
  const summary = parseEngagementRating(value, false);
  const { viewerRating: _viewerRating, ...publicSummary } = summary;
  return publicSummary;
}

export function parseEngagementRating(value: unknown, includeViewer = true): EngagementRatingSummary {
  if (!value || typeof value !== "object") throw new Error("The rating service returned an invalid summary");
  const record = value as Record<string, unknown>;
  const histogram = record.histogram;
  if (
    !Array.isArray(histogram)
    || histogram.length !== 5
    || histogram.some((count) => !Number.isInteger(count) || Number(count) < 0)
  ) {
    throw new Error("The rating service returned an invalid histogram");
  }
  const count = requireNonNegativeInteger(record.count, "count");
  const guestCount = requireNonNegativeInteger(record.guestCount, "guest count");
  const authoredCount = requireNonNegativeInteger(record.authoredCount, "authored count");
  if (histogram.reduce((total, item) => total + Number(item), 0) !== count || guestCount + authoredCount !== count) {
    throw new Error("The rating service returned inconsistent totals");
  }
  const average = record.average === null ? null : Number(record.average);
  if ((count === 0 && average !== null) || (count > 0 && (!Number.isFinite(average) || average! < 1 || average! > 5))) {
    throw new Error("The rating service returned an invalid average");
  }
  const viewerRating = includeViewer ? normalizeViewerRating(record.viewerRating) : null;
  return {
    average,
    count,
    guestCount,
    authoredCount,
    histogram: histogram.map(Number) as EngagementRatingSummary["histogram"],
    viewerRating,
  };
}

export function parseEngagementRatingResponseText(value: string): EngagementRatingSummary {
  return parseEngagementRating(parseRatingJson(value));
}

export function applyViewerRating(
  summary: EngagementRatingSummary,
  nextRating: number,
): EngagementRatingSummary {
  if (!Number.isInteger(nextRating) || nextRating < 1 || nextRating > 5) {
    throw new Error("Rating must be a whole number from one to five");
  }
  const histogram = [...summary.histogram] as EngagementRatingSummary["histogram"];
  const previous = summary.viewerRating;
  if (previous !== null) histogram[previous - 1] = Math.max(0, histogram[previous - 1] - 1);
  histogram[nextRating - 1] += 1;
  const count = summary.count + (previous === null ? 1 : 0);
  const sum = histogram.reduce((total, item, index) => total + item * (index + 1), 0);
  return {
    ...summary,
    average: count ? sum / count : null,
    count,
    guestCount: summary.guestCount + (previous === null ? 1 : 0),
    histogram,
    viewerRating: nextRating,
  };
}

export async function fetchEngagementRating(
  targetType: RatingTargetType,
  targetId: number,
  browserToken: string,
): Promise<EngagementRatingSummary> {
  const endpoint = ratingEndpoint(targetType, targetId);
  const response = await fetch(endpoint, {
    cache: "no-store",
    credentials: "omit",
    headers: { [RATING_TOKEN_HEADER]: browserToken },
  });
  return parseRatingResponse(response);
}

export async function submitEngagementRating(
  targetType: RatingTargetType,
  targetId: number,
  rating: number,
  browserToken: string,
): Promise<EngagementRatingSummary> {
  const endpoint = ratingEndpoint(targetType, targetId);
  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating, browserToken }),
  });
  return parseRatingResponse(response);
}

function ratingEndpoint(targetType: RatingTargetType, targetId: number): string {
  if (!Number.isInteger(targetId) || targetId <= 0) throw new Error("A valid rating target is required");
  const endpoint = restUrl(`funkycommerce/v1/ratings/${targetType}/${targetId}`);
  if (!endpoint) throw new Error("Ratings are unavailable because this storefront has no backend configured");
  return endpoint;
}

async function parseRatingResponse(response: Response): Promise<EngagementRatingSummary> {
  const responseText = await response.text();
  let payload: Record<string, unknown> | null;
  try {
    const parsed = parseRatingJson(responseText);
    payload = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    if (response.ok) throw new Error("The rating service returned malformed JSON");
    throw new Error(`Rating request failed with status ${response.status}`);
  }
  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : `Rating request failed with status ${response.status}`;
    throw new Error(message);
  }
  return parseEngagementRating(payload);
}

function parseRatingJson(value: string): unknown {
  const responseText = value.trim();
  try {
    return JSON.parse(responseText);
  } catch {
    // Some legacy hosts display PHP diagnostics before an otherwise valid REST
    // response. Recover only a final JSON object; validation still rejects any
    // missing, malformed, or inconsistent rating fields.
    const finalObjectStart = responseText.lastIndexOf("\n{");
    if (finalObjectStart < 0) throw new Error("The rating service returned malformed JSON");
    return JSON.parse(responseText.slice(finalObjectStart + 1));
  }
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error(`The rating service returned an invalid ${label}`);
  return Number(value);
}

function normalizeViewerRating(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("The rating service returned an invalid viewer rating");
  }
  return rating;
}
