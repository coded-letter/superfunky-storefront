import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, ImagePlus, Mail, ShieldCheck, Sparkles, X } from "lucide-react";
import { useLayoutPreferences, useSoundUX } from "../state";

/** `"split"` is the original image + form side-by-side treatment. `"modern-card"` and
 * `"modern-center"` are 2 newer, fresher alternatives — a compact bottom-corner toast
 * and a centered image-less gradient card — both triggerable from the layout studio. */
export type NewsletterPopupVariant = "split" | "modern-card" | "modern-center";

type PopupState = {
  status: "idle" | "dismissed" | "subscribed";
  nextVisibleAt: number | null;
};

const STORAGE_KEY = "funkycommerce-mailing-list-popup";
const SUBSCRIBE_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 30;
const DAY_MS = 1000 * 60 * 60 * 24;

function writePopupState(next: PopupState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function NewsletterSignupPopup({
  onSubscribe,
  title = "Be the first to know when the next favorite drops.",
  description = "Join our insider list for early access, private offers, and curated stories from the Superfunky world.",
  privacyConsentLabel = "I agree to receive occasional email updates and understand that I can unsubscribe at any time.",
}: {
  onSubscribe?: (email: string) => Promise<void>;
  title?: string;
  description?: string;
  privacyConsentLabel?: string;
}) {
  const { playAction } = useSoundUX();
  const { showNewsletterPopup, newsletterPopupVariant, newsletterPopupCooldownDays } = useLayoutPreferences();
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const dismissCooldownMs = Math.max(0, newsletterPopupCooldownDays) * DAY_MS;

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // Any link/URL ending in `#newsletter` opens this popup on demand — a plain anchor
  // works from the footer, a nav item, inline copy, etc. — bypassing the initial delay
  // and the dismiss/subscribe cooldown since it's an explicit, deliberate trigger.
  // Checked on mount (direct URL/hash navigation) and via a delegated click listener
  // (so re-clicking the same in-page hash link still reopens it).
  useEffect(() => {
    if (!showNewsletterPopup) return;

    const hashMatchesNewsletter = (hash: string) => hash.replace(/^#/, "") === "newsletter";

    if (hashMatchesNewsletter(window.location.hash)) {
      setIsOpen(true);
    }

    const handleHashChange = () => {
      if (hashMatchesNewsletter(window.location.hash)) {
        setIsOpen(true);
      }
    };

    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      const hashPart = href.includes("#") ? href.slice(href.indexOf("#")) : "";
      if (hashMatchesNewsletter(hashPart)) {
        setIsOpen(true);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    document.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      document.removeEventListener("click", handleClick);
    };
  }, [showNewsletterPopup]);

  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false);
      setIsSubscribed(false);
      return;
    }

    playAction("modal-open");
    setIsVisible(true);
  }, [isOpen, playAction]);

  useEffect(() => {
    if (!isSubscribed || !isOpen) return;

    const timeout = window.setTimeout(() => {
      closePopup("subscribed");
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [isSubscribed, isOpen]);

  const closePopup = (status: PopupState["status"] = "dismissed") => {
    if (!isOpen) return;

    setIsVisible(false);
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      const nextState: PopupState = {
        status,
        nextVisibleAt: Date.now() + (status === "subscribed" ? SUBSCRIBE_COOLDOWN_MS : dismissCooldownMs),
      };
      writePopupState(nextState);
      setIsOpen(false);
      setError(null);
      setIsSubscribed(false);
      closeTimerRef.current = null;
    }, 220);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePopup("dismissed");
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // The close callback intentionally uses the current cooldown preference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dismissCooldownMs]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!isValidEmail) {
      playAction("error");
      setError("Please enter a valid email address.");
      return;
    }

    if (!agreed) {
      playAction("error");
      setError("Please accept the privacy note to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubscribe?.(trimmedEmail);
    } catch (submissionError) {
      playAction("error");
      setError(submissionError instanceof Error ? submissionError.message : "The newsletter signup could not be saved.");
      setIsSubmitting(false);
      return;
    }

    playAction("success");
    // Persists under the same localStorage key `lib/abandonedCart.ts`'s
    // `saveNewsletterEmail`/`getEmailFromMultipleSources` read/write (kept as a raw
    // string literal here rather than an import — this package doesn't depend on
    // app-level `lib/` modules) so an abandoned checkout later on can still be
    // attributed to whatever email a visitor already gave the newsletter popup.
    try {
      window.localStorage.setItem("funkycommerce-newsletter-email", trimmedEmail);
    } catch {
      // Storage unavailable — non-fatal, subscription confirmation still shows.
    }
    setIsSubscribed(true);
    setEmail("");
    setAgreed(false);
    setIsSubmitting(false);
  };

  if (!isOpen || !showNewsletterPopup) return null;

  const trustRow = (
    <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500 sm:mt-6 sm:text-[10px] sm:tracking-[0.24em]">
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Privacy respected</span>
      </span>
      <span className="opacity-70">·</span>
      <span>No spam</span>
      <span className="opacity-70">·</span>
      <span>Easy unsubscribe</span>
    </div>
  );

  const subscribedPanel = (
    <div className="mt-4 rounded-3xl border border-brand-200/80 bg-brand-50/80 p-5 text-center shadow-sm transition-all duration-300 dark:border-brand-500/20 dark:bg-brand-500/10 sm:mt-6 sm:p-6">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm dark:bg-zinc-900 dark:text-brand-300">
        <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
      </div>
      <h4 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">You’re on the list.</h4>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Thanks for subscribing — expect a first look at our next drop and exclusive updates soon.
      </p>
    </div>
  );

  const subscribeForm = (
    <form className="mt-4 space-y-3 sm:mt-6 sm:space-y-4" onSubmit={handleSubmit}>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-200">Email address</span>
        <div className="relative">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 pr-12 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-brand-50 p-2 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
      </label>

      <label className="flex items-start gap-2.5 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-2.5 text-[11px] leading-5 text-zinc-600 transition hover:border-brand-200 hover:bg-brand-50/60 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/10 sm:p-3 sm:text-[13px] sm:leading-6">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="break-words">
          {privacyConsentLabel}
        </span>
      </label>

      {error ? <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 sm:px-5 sm:py-3"
        >
          {isSubmitting ? "Subscribing…" : "Subscribe"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => closePopup("dismissed")}
          className="text-sm font-semibold text-zinc-500 transition hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-300"
        >
          Maybe later
        </button>
      </div>
    </form>
  );

  const closeButton = (
    <button
      type="button"
      onClick={() => closePopup("dismissed")}
      aria-label="Close newsletter signup"
      className="absolute right-4 top-4 z-10 inline-grid h-9 w-9 place-items-center rounded-full border border-zinc-200 bg-white/90 text-zinc-500 transition hover:border-brand-300 hover:text-brand-600 dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-400 dark:hover:border-brand-500 dark:hover:text-brand-300"
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  if (newsletterPopupVariant === "modern-card") {
    // A compact, non-blocking bottom-corner toast card — no dark overlay, slides up
    // from the corner instead of the classic centered dialog.
    return (
      <div className="sf-newsletter-popup funky-newsletter-popup pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:justify-end sm:px-0 sm:pb-0">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Join the mailing list"
          className={`pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-4xl border border-zinc-200/80 bg-white p-5 shadow-soft-lg transition-all duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-950 sm:p-6 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          {closeButton}
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Stay in the loop</span>
          </div>
          <h3 className="mt-3 font-display text-lg font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>
          <p className="m-0 mt-1.5 text-[13px] leading-5 text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
          {isSubscribed ? subscribedPanel : subscribeForm}
        </div>
      </div>
    );
  }

  if (newsletterPopupVariant === "modern-center") {
    // A centered, image-less gradient card — leaner and more "app-like" than the
    // original split layout, with the trust row baked into the same panel.
    return (
      <div
        className={`fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/65 px-3 py-4 backdrop-blur-sm transition-opacity duration-300 sm:px-4 sm:py-6 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Join the mailing list"
          className={`sf-newsletter-popup funky-newsletter-popup relative w-full max-w-md overflow-hidden rounded-4xl border border-zinc-200/80 bg-white shadow-soft-lg transition-all duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-950 ${
            isVisible ? "translate-y-0 scale-[1] opacity-100" : "translate-y-6 scale-[0.98] opacity-0"
          }`}
        >
          {closeButton}
          <div className="h-2 w-full bg-brand-gradient" aria-hidden="true" />
          <div className="p-6 text-center sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-display text-2xl font-bold leading-tight text-zinc-900 dark:text-zinc-100">
              {title}
            </h3>
            <p className="m-0 mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
            {isSubscribed ? subscribedPanel : subscribeForm}
            <div className="flex justify-center">{trustRow}</div>
          </div>
        </div>
      </div>
    );
  }

  // "split" — the original image + form side-by-side treatment (default).
  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/65 px-3 py-4 backdrop-blur-sm transition-opacity duration-300 sm:px-4 sm:py-6 ${
       isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
       role="dialog"
       aria-modal="true"
       aria-label="Join the mailing list"
       className={`sf-newsletter-popup funky-newsletter-popup relative max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-3xl border border-zinc-200/80 bg-white shadow-soft-lg transition-all duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-950 sm:max-h-[calc(100dvh-3rem)] sm:rounded-4xl ${
         isVisible ? "translate-y-0 scale-[1] opacity-100" : "translate-y-6 scale-[0.98] opacity-0"
       }`}
      >
        {closeButton}

        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden bg-zinc-100 dark:bg-zinc-900">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(17,24,39,0.92),rgba(76,29,149,0.7))]" />
            <div className="relative h-full min-h-[220px] sm:min-h-[280px] lg:min-h-[420px]">
              <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_48%)]" />
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.22),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.16),transparent_24%),linear-gradient(140deg,rgba(255,255,255,0.12),transparent_60%)]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02))]">
                    <div className="flex h-full w-full items-center justify-center rounded-none border-0 bg-[linear-gradient(140deg,#f8fafc_0%,#e2e8f0_35%,#cbd5e1_100%)]">
                      <div className="flex h-full w-full items-center justify-center p-0">
                        <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-zinc-700">
                          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/70 text-zinc-700 shadow-sm backdrop-blur sm:h-16 sm:w-16">
                            <ImagePlus className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
                          </div>
                          <div className="space-y-1 px-4 sm:px-6">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 sm:text-sm">Image placeholder</p>
                            <p className="text-[11px] leading-5 text-zinc-500 sm:text-xs">Drop in a full-bleed product or editorial image here.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center p-4 sm:p-6 lg:p-10">
            <div className="space-y-3 sm:space-y-5">
              <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300 sm:text-[11px] sm:tracking-[0.24em]">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="break-words">Stay in the loop</span>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <h3 className="max-w-[18rem] font-display text-[1.35rem] font-semibold leading-[1.05] text-zinc-900 sm:max-w-none sm:text-3xl sm:leading-[0.95] dark:text-zinc-100">
                  {title}
                </h3>
                <p className="m-0 max-w-xl text-[13px] leading-6 text-zinc-600 sm:text-[15px] sm:leading-7 dark:text-zinc-400">
                  {description}
                </p>
              </div>
            </div>

            {isSubscribed ? subscribedPanel : subscribeForm}

            {trustRow}
          </div>
        </div>
      </div>
    </div>
  );
}
