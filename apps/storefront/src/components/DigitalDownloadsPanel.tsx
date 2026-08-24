import { useState } from "react";
import { Download, FileArchive } from "lucide-react";
import {
  fetchOrderDownloadFile,
  isOrderDownloadAvailable,
  type OrderDownload,
} from "../lib/downloads";

export function DigitalDownloadsPanel({
  downloads,
  isLoading = false,
  error,
  emptyMessage = "This order does not include any downloadable files.",
}: {
  downloads: OrderDownload[];
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
}) {
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function downloadFile(download: OrderDownload) {
    const key = `${download.orderId}-${download.productId}-${download.id}`;
    if (activeDownload) return;
    setActiveDownload(key);
    setDownloadError(null);
    try {
      const file = await fetchOrderDownloadFile(download);
      const url = window.URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      setDownloadError(
        requestError instanceof Error
          ? requestError.message
          : "File download failed. Please try again or contact support.",
      );
    } finally {
      setActiveDownload(null);
    }
  }

  return (
    <section className="sf-downloads grid gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-brand-50 p-5 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-brand-500/5">
      <h2 className="m-0 flex items-center gap-2 font-display text-base font-bold text-zinc-900 dark:text-zinc-100">
        <FileArchive className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        Your downloads
      </h2>
      {isLoading ? <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">Loading secure download links…</p> : null}
      {error ? <p className="m-0 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
      {downloadError ? <p className="m-0 text-sm text-rose-600 dark:text-rose-400">{downloadError}</p> : null}
      {!isLoading && !error && downloads.length === 0 ? (
        <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>
      ) : null}
      <div className="grid gap-3">
        {downloads.map((download) => {
          const available = isOrderDownloadAvailable(download);
          return (
            <article key={`${download.orderId}-${download.productId}-${download.id}`} className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-1">
                  <strong className="text-sm text-zinc-900 dark:text-zinc-100">{download.productName}</strong>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{download.fileName}</span>
                </div>
                {available ? (
                  <button
                    type="button"
                    disabled={activeDownload !== null}
                    onClick={() => void downloadFile(download)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2 text-xs font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    {activeDownload === `${download.orderId}-${download.productId}-${download.id}`
                      ? "Downloading…"
                      : "Download"}
                  </button>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    Unavailable
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-100 pt-2 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                <span>Order #{download.orderId}</span>
                <span>Downloads remaining: {download.remaining === null ? "Unlimited" : download.remaining}</span>
                <span>Expires: {formatDownloadExpiry(download.expiresAt)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatDownloadExpiry(value: string): string {
  if (!value) return "Never";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(timestamp)
    : value;
}
