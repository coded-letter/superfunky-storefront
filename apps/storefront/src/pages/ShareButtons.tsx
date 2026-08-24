import { useState } from "react";
import { Check, Link2, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { socialIconSrc, useT } from "@funky/ui";

const shareButtonClass =
  "inline-grid h-8 w-8 place-items-center rounded-full bg-zinc-100 text-zinc-600 transition hover:-translate-y-0.5 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700";

const onImageButtonClass =
  "inline-grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/25";

/** Builds real share-intent URLs for each platform, mirroring the legacy prototype's
 * `share.js` (X/Facebook/LinkedIn/TikTok/Telegram) plus a couple of common additions
 * (WhatsApp, email) requested as "more options". Shared by the product template and
 * blog post template share rows. */
function buildShareLinks(title: string, pageUrl: string) {
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(pageUrl);
  return {
    x: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    tiktok: `https://www.tiktok.com/share?url=${encodedUrl}&title=${encodedTitle}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
  };
}

/** Generic share-buttons row — X/Facebook/LinkedIn/TikTok use the project's real brand
 * SVG assets; Telegram/WhatsApp/Email fall back to generic lucide pictograms since no
 * dedicated brand asset exists yet for those in this project's icon set. Also offers a
 * "copy link" action with inline confirmation. */
export function ShareButtonsRow({
  title,
  label,
  variant = "default",
}: {
  title: string;
  label?: string;
  /** `"on-image"` renders semi-transparent white icon buttons suited to sitting
   * directly on top of a photo, with no background card behind the row. */
  variant?: "default" | "on-image";
}) {
  const t = useT();
  const resolvedLabel = label ?? t("share.label");
  const [isCopied, setIsCopied] = useState(false);
  const pageUrl = window.location.href;
  const links = buildShareLinks(title, pageUrl);
  const buttonClass = variant === "on-image" ? onImageButtonClass : shareButtonClass;
  const labelClass =
    variant === "on-image"
      ? "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/90"
      : "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

  const brandTargets: { key: keyof typeof links; label: string }[] = [
    { key: "x", label: t("share.on.x") },
    { key: "facebook", label: t("share.on.facebook") },
    { key: "linkedin", label: t("share.on.linkedin") },
    { key: "tiktok", label: t("share.on.tiktok") },
  ];

  const lucideTargets: { key: keyof typeof links; label: string; Icon: typeof Send; external: boolean }[] = [
    { key: "telegram", label: t("share.on.telegram"), Icon: Send, external: true },
    { key: "whatsapp", label: t("share.on.whatsapp"), Icon: MessageCircle, external: true },
    { key: "email", label: t("share.via_email"), Icon: Mail, external: false },
  ];

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — link is still shareable manually.
    }
  };

  return (
    <div className="grid gap-2">
      <span className={labelClass}>
        <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> {resolvedLabel}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {brandTargets.map((target) => (
          <a
            key={target.key}
            href={links[target.key]}
            target="_blank"
            rel="noopener noreferrer"
            title={target.label}
            aria-label={target.label}
            className={buttonClass}
          >
            <img
              src={socialIconSrc(target.key)}
              alt=""
              className={variant === "on-image" ? "h-3.5 w-3.5 invert" : "h-3.5 w-3.5 dark:invert"}
              aria-hidden="true"
            />
          </a>
        ))}
        {lucideTargets.map((target) => (
          <a
            key={target.key}
            href={links[target.key]}
            target={target.external ? "_blank" : undefined}
            rel={target.external ? "noopener noreferrer" : undefined}
            title={target.label}
            aria-label={target.label}
            className={buttonClass}
          >
            <target.Icon className="h-4 w-4" aria-hidden="true" />
          </a>
        ))}
        <button
          type="button"
          onClick={handleCopyLink}
          title={t("community.copy_link")}
          aria-label={t("community.copy_link")}
          className={buttonClass}
        >
          {isCopied ? (
            <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
          ) : (
            <Link2 className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        {isCopied ? (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t("share.link_copied")}</span>
        ) : null}
      </div>
    </div>
  );
}
