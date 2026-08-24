import { normalizeBackendError } from "@funky/ui";
import { BACKEND_ORIGIN } from "@funky/sdk";
import { HttpRequestError } from "./requestRetry";

export type OrderDownload = {
  id: string;
  orderId: number;
  productId: number;
  productName: string;
  fileName: string;
  url: string;
  remaining: number | null;
  expiresAt: string;
};

type OrderDownloadsResponse = {
  order_id: number;
  downloads: OrderDownload[];
  has_downloadable_items: boolean;
  download_permitted: boolean;
};

export type OrderDownloadAccess = {
  downloads: OrderDownload[];
  hasDownloadableItems: boolean;
  downloadPermitted: boolean;
};

function downloadFileName(contentDisposition: string | null, fallback: string): string {
  const encoded = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quoted = contentDisposition?.match(/filename="([^"]+)"/i)?.[1];
  let candidate = fallback;
  try {
    candidate = encoded ? decodeURIComponent(encoded) : quoted || fallback;
  } catch {
    candidate = quoted || fallback;
  }
  return candidate.replaceAll("\\", "-").replaceAll("/", "-").trim() || "download";
}

export async function fetchOrderDownloadFile(
  download: OrderDownload,
  fetchImpl: typeof fetch = fetch,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetchImpl(download.url, {
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) {
    const retryAfter = response.headers.get("Retry-After");
    throw new HttpRequestError(
      response.status === 429
        ? `Too many download attempts. Try again${retryAfter ? ` in ${retryAfter} seconds` : " shortly"}.`
        : `File download failed with status ${response.status}.`,
      response.status,
    );
  }
  return {
    blob: await response.blob(),
    fileName: downloadFileName(response.headers.get("Content-Disposition"), download.fileName),
  };
}

export async function getOrderDownloadAccess(input: {
  orderId: number;
  orderKey?: string;
  billingEmail?: string;
  accessToken?: string;
}): Promise<OrderDownloadAccess> {
  if (!BACKEND_ORIGIN) throw new Error("The download service is not configured.");

  const url = new URL(`${BACKEND_ORIGIN}/index.php`);
  url.searchParams.set("rest_route", `/funkycommerce/v1/orders/${input.orderId}/downloads`);
  if (input.orderKey) url.searchParams.set("key", input.orderKey);
  if (input.billingEmail) url.searchParams.set("email", input.billingEmail);
  if (input.accessToken) url.searchParams.set("access_token", input.accessToken);

  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload = (await response.json().catch(() => null)) as OrderDownloadsResponse | { message?: string } | null;
  if (!response.ok) {
    throw new HttpRequestError(
      payload && "message" in payload && typeof payload.message === "string"
        ? normalizeBackendError(payload.message)
        : `Download request failed with status ${response.status}.`,
      response.status,
    );
  }
  const result = payload as OrderDownloadsResponse;
  return {
    downloads: Array.isArray(result?.downloads) ? result.downloads : [],
    hasDownloadableItems: result?.has_downloadable_items === true,
    downloadPermitted: result?.download_permitted === true,
  };
}

export function isOrderDownloadAvailable(download: OrderDownload, now = Date.now()): boolean {
  if (!download.url || download.remaining === 0) return false;
  if (!download.expiresAt) return true;
  const expiresAt = Date.parse(download.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt >= now;
}
