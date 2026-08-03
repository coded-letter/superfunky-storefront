import { useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  Cookie,
  Gauge,
  List,
  Megaphone,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  useCookieConsent,
  useSoundUX,
  type CookieCategory,
  type CookieConsent,
} from "../state";

type ManagerTab = "prefs" | "cookies";

type ToggleConfig = {
  key: CookieCategory;
  label: string;
  description: string;
  icon: typeof Megaphone;
};

const TOGGLES: ToggleConfig[] = [
  {
    key: "marketing",
    label: "Marketing",
    description: "Ads",
    icon: Megaphone,
  },
  {
    key: "tracking",
    label: "Tracking",
    description: "Analytics",
    icon: BarChart3,
  },
  {
    key: "performance",
    label: "Performance",
    description: "Layout",
    icon: Gauge,
  },
];

type MockCookie = {
  name: string;
  category: CookieCategory | "functional";
  provider: string;
  lifetime: string;
  /** The consent-record cookie itself can't be deleted from its own list. */
  deletable: boolean;
};

// Illustrative only — this is a frontend mockup with no real analytics/ad scripts, so
// there's nothing to actually enumerate. Mirrors the legacy prototype's cookie database
// (name/category/provider/lifetime, grouped by category) closely enough to preview the UX.
const MOCK_COOKIES: MockCookie[] = [
  {
    name: "funkycommerce-mockup-cookie-consent",
    category: "functional",
    provider: "FunkyCommerce",
    lifetime: "1 year",
    deletable: false,
  },
  {
    name: "funkycommerce-mockup-theme",
    category: "functional",
    provider: "FunkyCommerce",
    lifetime: "1 year",
    deletable: true,
  },
  {
    name: "funkycommerce-mockup-wishlist",
    category: "functional",
    provider: "FunkyCommerce",
    lifetime: "1 year",
    deletable: true,
  },
  {
    name: "funkycommerce-mockup-reading-list",
    category: "functional",
    provider: "FunkyCommerce",
    lifetime: "1 year",
    deletable: true,
  },
  {
    name: "woocommerce_cart_hash",
    category: "functional",
    provider: "WooCommerce",
    lifetime: "Session",
    deletable: true,
  },
  {
    name: "_ga",
    category: "tracking",
    provider: "Google Analytics",
    lifetime: "2 years",
    deletable: true,
  },
  {
    name: "_gid",
    category: "tracking",
    provider: "Google Analytics",
    lifetime: "24 hours",
    deletable: true,
  },
  {
    name: "_fbp",
    category: "marketing",
    provider: "Meta",
    lifetime: "3 months",
    deletable: true,
  },
  {
    name: "funkycommerce-mockup-personalization",
    category: "performance",
    provider: "FunkyCommerce",
    lifetime: "1 year",
    deletable: true,
  },
];

const CATEGORY_LABELS: Record<MockCookie["category"], string> = {
  functional: "Functional",
  marketing: "Marketing",
  tracking: "Tracking",
  performance: "Performance",
};

const CATEGORY_ICONS: Record<MockCookie["category"], typeof ShieldCheck> = {
  functional: ShieldCheck,
  marketing: Megaphone,
  tracking: BarChart3,
  performance: Gauge,
};

const DEFAULT_DRAFT: CookieConsent = {
  marketing: false,
  tracking: true,
  performance: true,
};

const NEAR_BOTTOM_THRESHOLD_PX = 220;

/** True once the user has scrolled close enough to the end of the page that a fixed
 * bottom-left element would start overlapping the footer's content (e.g. its "extra
 * wrapper" promo box). Re-evaluated on scroll/resize so it stays in sync as content loads. */
function useIsNearPageBottom(thresholdPx = NEAR_BOTTOM_THRESHOLD_PX) {
  const [isNearBottom, setIsNearBottom] = useState(false);

  useEffect(() => {
    function update() {
      const distanceToBottom = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      setIsNearBottom(distanceToBottom < thresholdPx);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [thresholdPx]);

  return isNearBottom;
}

/** Bottom-left cookie consent banner: a minimal, non-disruptive strip for first-time
 * visitors (Accept all / Settings), a persistent round icon to reopen preferences once a
 * decision is made, and — reached from either — a centered modal manager with the same
 * two-tab structure as the updated legacy prototype (Preferences grid + a grouped Cookies
 * list with provider/lifetime metadata and per-item delete), restyled to match this app's
 * design system instead of the legacy's hardcoded dark theme. */
export function CookieConsentBanner() {
  const {
    consent,
    isManagerOpen,
    openManager,
    closeManager,
    acceptAll,
    rejectNonEssential,
    savePreferences,
  } = useCookieConsent();
  const { playAction } = useSoundUX();
  const [activeTab, setActiveTab] = useState<ManagerTab>("prefs");
  const [draft, setDraft] = useState<CookieConsent>(consent ?? DEFAULT_DRAFT);
  const [storedCookies, setStoredCookies] = useState(MOCK_COOKIES);
  const isNearPageBottom = useIsNearPageBottom();

  useEffect(() => {
    if (isManagerOpen) {
      playAction("modal-open");
      setDraft(consent ?? DEFAULT_DRAFT);
      setActiveTab("prefs");
    }
  }, [isManagerOpen, consent, playAction]);

  const groupedCookies = (
    Object.keys(CATEGORY_LABELS) as MockCookie["category"][]
  ).map((category) => ({
    category,
    items: storedCookies.filter((item) => item.category === category),
  }));

  return (
    <>
      {/* Minimal first-visit banner — fades out near the page bottom so it doesn't sit on
          top of the footer's own content. */}
      {!consent && !isManagerOpen ? (
        <div
          role="region"
          aria-label="Cookie consent"
          aria-hidden={isNearPageBottom}
          className={`funky-cookie-consent-banner fixed inset-x-4 bottom-4 z-40 grid gap-3 rounded-2xl border border-zinc-200/80 bg-white/95 p-5 shadow-soft-lg backdrop-blur transition-all duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-900/95 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-sm ${
            isNearPageBottom ? "pointer-events-none translate-y-4 opacity-0" : "pointer-events-auto translate-y-0 opacity-100"
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gradient text-white shadow-soft">
              <Cookie className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="grid gap-1">
              <span className="font-display text-base font-bold text-zinc-900 dark:text-zinc-100">
                Cookie consent
              </span>
              <p className="m-0 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                FunkyCommerce uses cookies for the proper functioning of our
                website, as well as for analytics and advertising purposes.
                Learn more in our{" "}
                <Link
                  to="/privacy-policy#cookies"
                  className="font-medium text-brand-600 underline dark:text-brand-400"
                >
                  Cookies Policy
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                playAction("modal-open");
                openManager();
              }}
              className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
            >
              Settings
            </button>
            <button
              type="button"
              onClick={() => {
                playAction("success");
                acceptAll();
              }}
              className="rounded-full bg-brand-gradient px-4 py-2 text-xs font-semibold text-white shadow-glow transition hover:-translate-y-0.5"
            >
              Accept all
            </button>
          </div>
        </div>
      ) : null}

      {/* Persistent reopen icon, once a decision has been made — hides near the page
          bottom to avoid overlapping the footer's extra content box. */}
      {consent && !isManagerOpen ? (
        <button
          type="button"
          onClick={() => {
            playAction("modal-open");
            openManager();
          }}
          aria-label="Cookie settings"
          title="Cookie settings"
          tabIndex={isNearPageBottom ? -1 : 0}
          aria-hidden={isNearPageBottom}
          className={`fixed bottom-5 left-5 z-40 inline-grid h-11 w-11 place-items-center rounded-full bg-brand-gradient text-white shadow-glow transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg ${
            isNearPageBottom ? "pointer-events-none translate-y-4 scale-90 opacity-0" : "pointer-events-auto translate-y-0 scale-100 opacity-100"
          }`}
        >
          <Cookie className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}

      {/* Full manager — a centered modal, reached from either the fresh banner or the
          persistent reopen icon. */}
      {isManagerOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm"
          onClick={closeManager}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Manage cookie preferences"
            onClick={(event) => event.stopPropagation()}
            className="funky-cookie-consent-manager grid max-h-[85vh] w-full max-w-xl gap-4 overflow-y-auto rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow">
                  <Cookie className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div className="grid gap-0.5 pt-0.5">
                  <span className="font-display text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Manage cookies
                  </span>
                  <p className="m-0 max-w-sm text-xs leading-snug text-zinc-500 dark:text-zinc-400">
                    Choose which optional cookies we may use.{" "}
                    <Link
                      to="/privacy-policy#cookies"
                      className="font-medium text-brand-600 underline underline-offset-2 dark:text-brand-400"
                    >
                      Cookies Policy
                    </Link>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  playAction("error");
                  closeManager();
                }}
                aria-label="Close"
                className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex gap-1.5 rounded-full border border-zinc-100 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-800/60">
              <button
                type="button"
                onClick={() => setActiveTab("prefs")}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                  activeTab === "prefs"
                    ? "bg-brand-gradient text-white shadow-glow"
                    : "text-zinc-500 hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-300"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                Preferences
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("cookies")}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                  activeTab === "cookies"
                    ? "bg-brand-gradient text-white shadow-glow"
                    : "text-zinc-500 hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-300"
                }`}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
                Cookies list
              </button>
            </div>

            {activeTab === "prefs" ? (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <div
                    className="flex items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 p-3 transition-all sm:p-4 dark:border-brand-500/20 dark:bg-brand-500/5"
                    title="Required for core features — cart, wishlist, and remembering this choice."
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-soft dark:bg-zinc-800 dark:text-brand-300 sm:grid">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-sm font-semibold leading-tight text-zinc-800 dark:text-zinc-100">
                          Functional
                        </p>
                        <p className="m-0 hidden text-xs text-zinc-500 dark:text-zinc-400 sm:block">
                          Always on
                        </p>
                      </div>
                    </div>
                    <span className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-brand-500">
                      <span className="absolute left-0.5 h-4 w-4 translate-x-4 rounded-full bg-white shadow-sm transition-transform" />
                    </span>
                  </div>

                  {TOGGLES.map((toggle) => {
                    const isOn = draft[toggle.key];
                    const Icon = toggle.icon;
                    return (
                      <label
                        key={toggle.key}
                        title={toggle.description}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 transition-all duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-offset-1 dark:has-[:focus-visible]:ring-offset-zinc-900 sm:p-4 ${
                          isOn
                            ? "border-brand-200 bg-brand-50/40 dark:border-brand-500/25 dark:bg-brand-500/[0.06]"
                            : "border-zinc-100 bg-zinc-50/70 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          role="switch"
                          checked={isOn}
                          onChange={() =>
                            setDraft((previous) => ({
                              ...previous,
                              [toggle.key]: !previous[toggle.key],
                            }))
                          }
                          className="peer sr-only"
                        />
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`hidden h-8 w-8 shrink-0 place-items-center rounded-xl shadow-soft transition-colors duration-200 sm:grid ${
                              isOn
                                ? "bg-white text-brand-600 dark:bg-zinc-800 dark:text-brand-300"
                                : "bg-white text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                            }`}
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="m-0 text-sm font-semibold leading-tight text-zinc-800 dark:text-zinc-100">
                              {toggle.label}
                            </p>
                            <p className="m-0 hidden text-xs text-zinc-500 dark:text-zinc-400 sm:block">
                              {toggle.description}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-300 ${
                            isOn
                              ? "bg-brand-500"
                              : "bg-zinc-300 dark:bg-zinc-700"
                          }`}
                        >
                          <span
                            className={`absolute left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                              isOn ? "translate-x-4" : ""
                            }`}
                          />
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      playAction("success");
                      acceptAll();
                    }}
                    className="flex-1 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 sm:flex-none"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playAction("success");
                      savePreferences(draft);
                    }}
                    className="flex-1 rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-bold text-brand-600 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-brand-500/60 dark:text-brand-300 dark:hover:bg-brand-500/10 dark:focus-visible:ring-offset-zinc-900 sm:flex-none"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playAction("error");
                      rejectNonEssential();
                    }}
                    className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-bold text-zinc-600 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900 sm:flex-none"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-5">
                {groupedCookies.map(({ category, items }) => {
                  if (items.length === 0) return null;
                  const Icon = CATEGORY_ICONS[category];
                  return (
                    <div key={category} className="grid gap-2">
                      <div className="flex items-center gap-2">
                        <Icon
                          className="h-3.5 w-3.5 text-brand-500 dark:text-brand-400"
                          aria-hidden="true"
                        />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          {CATEGORY_LABELS[category]}
                        </span>
                        <span className="text-[11px] font-medium text-zinc-300 dark:text-zinc-600">
                          · {items.length}
                        </span>
                      </div>
                      <ul className="grid gap-2">
                        {items.map((item) => (
                          <li
                            key={item.name}
                            className="group flex flex-col gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3 transition-colors duration-200 hover:border-brand-200 hover:bg-brand-50/30 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-800/30 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/[0.05]"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="m-0 truncate font-mono text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
                                {item.name}
                              </p>
                              <p className="m-0 mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                                <Building2
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                                {item.provider}
                                <span aria-hidden="true">·</span>
                                Expires in {item.lifetime}
                              </p>
                            </div>
                            {item.deletable ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setStoredCookies((previous) =>
                                    previous.filter(
                                      (existing) => existing.name !== item.name,
                                    ),
                                  )
                                }
                                className="inline-flex shrink-0 items-center gap-1 rounded-full p-2 text-zinc-400 opacity-100 transition-all duration-200 hover:bg-rose-50 hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                                title="Delete"
                                aria-label={`Delete ${item.name}`}
                              >
                                <Trash2
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </button>
                            ) : (
                              <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                                Required
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                {storedCookies.length === 0 ? (
                  <p className="py-10 text-center text-xs text-zinc-400 dark:text-zinc-500">
                    Nothing left to show.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
