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

export async function getOrderDownloadAccess(input: {
  orderId: number;
  orderKey?: string;
  billingEmail?: string;
}): Promise<OrderDownloadAccess> {
  if (!BACKEND_ORIGIN) throw new Error("The download service is not configured.");

  const url = new URL(`${BACKEND_ORIGIN}/index.php`);
  url.searchParams.set("rest_route", `/funkycommerce/v1/orders/${input.orderId}/downloads`);
  if (input.orderKey) url.searchParams.set("key", input.orderKey);
  if (input.billingEmail) url.searchParams.set("email", input.billingEmail);

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
