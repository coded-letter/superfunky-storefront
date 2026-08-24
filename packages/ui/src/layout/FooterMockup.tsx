import { useState, type FormEvent, type ReactNode } from "react";
import { ChevronRight, Music2, Sparkles } from "lucide-react";
import {
  PAYMENT_METHODS,
  SOCIAL_LINKS,
  CurrencyMark,
  useT,
  type PaymentMethod,
  type SocialLink,
} from "../locale";
import { useLayoutPreferences } from "../state";
import { SpotifyPlayerMock, type SpotifyPlayerMockProps } from "./SpotifyPlayerMock";
import { ResponsiveImage } from "../media";
import { isMenuInitiallyExpanded } from "./menuClasses";
import { MenuDescription } from "./MenuDescription";
import { SafeHtmlContent } from "./SafeHtmlContent";
import { sanitizeStorefrontHtml } from "./sanitizeStorefrontHtml";
import { filterVisibleSocialLinks } from "./FooterMockup.socialVisibility";

export type FooterLinkItem = {
  label: string;
  href: string;
  /** Sanitized WordPress menu-item description HTML. */
  description?: string;
  cssClasses?: string[];
  /** Optional nested links — rendered as a collapsible sub-list with an expand arrow. */
  children?: FooterLinkItem[];
};

export type FooterColumn = {
  title: string;
  /** Sanitized WordPress menu-item description HTML for the top-level menu item. */
  description?: string;
  cssClasses?: string[];
  links: FooterLinkItem[];
};

export type FooterColumnsLayout = "grid-4" | "grid-2-wide" | "accordion-single";
export type FooterNewsletterLayout = "banner" | "centered" | "image-bg";
export type FooterAssistantLayout = "side-by-side" | "tabbed" | "stacked";
/** `"text"` shows the wordmark only. `"image"` shows only the gradient icon mark.
 * `"text-image"` (default) shows both, mirroring the header's logo treatment. */
export type FooterLogoVariant = "text" | "image" | "text-image";
/** `"split"` (default, current) keeps payment methods on the left and social icons
 * on the right of the bottom bar. `"centered"` stacks the logo, payment methods,
 * social icons and copyright as one centered column — reads better on narrow,
 * minimal footers. */
export type FooterBottomBarLayout = "split" | "centered";
/** `"inline"` (default, current) keeps the extra wrapper inside the footer's
 * `max-w-7xl` container as a small bordered note. `"full-bleed"` breaks out of
 * that container to a full-viewport-width band with a fixed 150px height —
 * useful for a promo strip, ticker, or third-party embed that should feel
 * edge-to-edge rather than boxed in. */
export type FooterExtraWrapperLayout = "inline" | "full-bleed";

export type FooterMockupProps = {
  newsletterTitle?: string;
  newsletterDescription?: string;
  privacyConsentLabel?: string;
  onNewsletterSubscribe?: (email: string, source: "newsletter-footer") => Promise<void>;
  /** `"banner"` (default) is the current full-width gradient banner with a 2-column
   * form split. `"centered"` collapses it to a narrow centered card. `"image-bg"` swaps
   * the gradient for a photographic background with a dark overlay. */
  newsletterLayout?: FooterNewsletterLayout;
  /** Whole pre-footer newsletter section on/off — independent of `newsletterLayout`.
   * `true` (default). */
  showNewsletter?: boolean;
  newsletterBackgroundImage?: string;
  footerColumns?: FooterColumn[];
  /** `"grid-4"` (default, current) is 4 even columns on desktop. `"grid-2-wide"` uses
   * 2 wider columns (denser link lists read better in 2 tall columns than 4 short
   * ones on some sites). `"accordion-single"` collapses every column into a single
   * stacked list of expandable accordions — a mobile-style compact footer. */
  columnsLayout?: FooterColumnsLayout;
  paymentMethods?: PaymentMethod[];
  socialLinks?: SocialLink[];
  /** Toggle the payment-methods row within the bottom bar on/off independently. */
  showPaymentMethods?: boolean;
  /** Toggle the social-links row within the bottom bar on/off independently. */
  showSocialLinks?: boolean;
  /** `PaymentMethod.key`s to hide from the payment-methods row, one by one — lets a
   * merchant switch off a single provider (e.g. no crypto) without hiding the whole
   * row via `showPaymentMethods`. */
  hiddenPaymentMethodKeys?: string[];
  /** Social-platform keys (backend/default) or explicit `SocialLink.id`s to hide from
   * the social-links row, one by one. */
  hiddenSocialLinkKeys?: string[];
  showAssistantFrame?: boolean;
  assistantFrameTitle?: string;
  showSpotifyPlayer?: boolean;
  spotifyPlayerTitle?: string;
  spotifyPlayerDescription?: string;
  /** Passed straight through to `<SpotifyPlayerMock>` — swap `uri`/`contentType` for
   * any track/album/playlist/artist/show/episode link to customize what plays. */
  spotifyPlayerProps?: SpotifyPlayerMockProps;
  /** `"side-by-side"` (default, current) shows the AI assistant frame and Spotify
   * player as two columns at once. `"tabbed"` shows one full-width panel at a time,
   * switched via a small pill toggle. `"stacked"` renders both as two full-width
   * (100%) rows, one after another — denser when both features compete for the
   * same footer real estate but neither should be hidden behind a tab. */
  assistantSpotifyLayout?: FooterAssistantLayout;
  projectName?: string;
  logoUrl?: string;
  iconUrl?: string;
  /** Which parts of the footer brand mark render — see `FooterLogoVariant`. */
  logoVariant?: FooterLogoVariant;
  /** Whole brand-mark block on/off — independent of `logoVariant`. `true` (default). */
  showLogo?: boolean;
  /** Which layout the payment / social / copyright bottom bar uses — see `FooterBottomBarLayout`. */
  bottomBarLayout?: FooterBottomBarLayout;
  showExtraWrapper?: boolean;
  extraWrapperHtml?: string;
  /** Which layout the extra footer wrapper uses — see `FooterExtraWrapperLayout`. */
  extraWrapperLayout?: FooterExtraWrapperLayout;
  copyrightText?: string;
  /** Toggle the copyright line itself on/off, independent of everything else in the
   * bottom bar. `true` (default). */
  showCopyright?: boolean;
  assistantSlot?: ReactNode;
};

const DEFAULT_COLUMNS: FooterColumn[] = [
  {
    title: "Shop",
    links: [
      { label: "All products", href: "#products" },
      { label: "Best sellers", href: "#best-sellers" },
      { label: "New arrivals", href: "#new-arrivals" },
      {
        label: "Categories",
        href: "#categories",
        children: [
          { label: "Apparel", href: "#category-apparel" },
          { label: "Footwear", href: "#category-footwear" },
          { label: "Accessories", href: "#category-accessories" },
        ],
      },
      { label: "Gift cards", href: "#gift-cards" },
    ],
  },
  {
    title: "Customer care",
    links: [
      { label: "Shipping", href: "#shipping" },
      { label: "Returns", href: "#returns" },
      {
        label: "FAQ",
        href: "#faq",
        children: [
          { label: "Order status", href: "#faq-order-status" },
          { label: "Sizing guide", href: "#faq-sizing" },
          { label: "Payment methods", href: "#faq-payment" },
        ],
      },
      { label: "Contact support", href: "#support" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Our story", href: "#story" },
      {
        label: "Careers",
        href: "#careers",
        children: [
          { label: "Open roles", href: "#careers-open-roles" },
          { label: "Life at Superfunky", href: "#careers-life" },
        ],
      },
      { label: "Wholesale", href: "#wholesale" },
      { label: "Press", href: "#press" },
      { label: "Newsletter", href: "#newsletter" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "#privacy" },
      { label: "Terms", href: "#terms" },
      {
        label: "Cookies",
        href: "#cookies",
        children: [
          { label: "Cookie policy", href: "#cookies-policy" },
          { label: "Manage preferences", href: "#cookies-preferences" },
        ],
      },
      { label: "Accessibility", href: "#accessibility" },
      { label: "Sitemap", href: "/sitemap" },
    ],
  },
];

const DEFAULT_PAYMENT_METHODS = PAYMENT_METHODS;

const DEFAULT_SOCIAL_LINKS = SOCIAL_LINKS;

const EMPTY_KEYS: string[] = [];

function FooterPaymentMark({ method }: { method: PaymentMethod }) {
  const cryptoCode = method.key === "btc" || method.key === "eth" ? method.key.toUpperCase() : null;
  return (
    <span
      title={method.label}
      role={cryptoCode ? "img" : undefined}
      aria-label={cryptoCode ? method.label : undefined}
      className={`inline-grid h-10 w-14 place-items-center ${
        cryptoCode ? "bg-transparent text-white" : "rounded-lg p-1.5 shadow-soft"
      }`}
    >
      {cryptoCode ? (
        <CurrencyMark code={cryptoCode} size={10} />
      ) : (
        <img
          src={method.icon}
          alt={method.label}
          width={56}
          height={40}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      )}
    </span>
  );
}

export function FooterMockup({
  newsletterTitle,
  newsletterDescription,
  privacyConsentLabel,
  onNewsletterSubscribe,
  newsletterLayout = "banner",
  showNewsletter = true,
  newsletterBackgroundImage = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
  footerColumns = DEFAULT_COLUMNS,
  columnsLayout = "grid-4",
  paymentMethods = DEFAULT_PAYMENT_METHODS,
  socialLinks = DEFAULT_SOCIAL_LINKS,
  showPaymentMethods = true,
  showSocialLinks = true,
  hiddenPaymentMethodKeys = EMPTY_KEYS,
  hiddenSocialLinkKeys = EMPTY_KEYS,
  showAssistantFrame = true,
  assistantFrameTitle,
  showSpotifyPlayer = true,
  spotifyPlayerTitle,
  spotifyPlayerDescription,
  spotifyPlayerProps,
  assistantSpotifyLayout = "side-by-side",
  projectName = "Superfunky",
  logoUrl,
  iconUrl,
  logoVariant = "text-image",
  showLogo = true,
  bottomBarLayout = "split",
  showExtraWrapper = true,
  extraWrapperHtml = "",
  extraWrapperLayout = "inline",
  copyrightText = "",
  showCopyright = true,
  assistantSlot,
}: FooterMockupProps) {
  const t = useT();
  const { themeMaxWidthPx } = useLayoutPreferences();
  const resolvedNewsletterTitle = newsletterTitle || t("footer.newsletter.title");
  const resolvedNewsletterDescription = newsletterDescription || t("footer.newsletter.description");
  const resolvedPrivacyConsentLabel = privacyConsentLabel || t("footer.newsletter.privacy");
  const resolvedAssistantFrameTitle = assistantFrameTitle || t("footer.assistant.title");
  const resolvedSpotifyPlayerTitle = spotifyPlayerTitle || t("footer.radio.title");
  const resolvedSpotifyPlayerDescription = spotifyPlayerDescription || t("footer.radio.description");
  const [activeAssistantTab, setActiveAssistantTab] = useState<"assistant" | "spotify">("assistant");
  const visiblePaymentMethods = paymentMethods.filter((method) => !hiddenPaymentMethodKeys.includes(method.key));
  const visibleSocialLinks = filterVisibleSocialLinks(socialLinks, hiddenSocialLinkKeys);
  const safeExtraWrapperHtml = sanitizeStorefrontHtml(extraWrapperHtml);
  const visibleCopyrightText = copyrightText.trim();
  const logoNode = showLogo ? (
    <div className="mb-10 flex items-center justify-center gap-2.5">
      {logoVariant !== "text" ? (
        logoUrl ? (
          <ResponsiveImage src={logoUrl} alt={projectName} sizes="12rem" className="h-10 w-auto max-w-48 object-contain" />
        ) : (
          <span className="inline-grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-gradient text-white shadow-glow">
            {iconUrl ? <ResponsiveImage src={iconUrl} alt="" sizes="2.25rem" className="h-full w-full object-cover" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          </span>
        )
      ) : null}
      {logoVariant !== "image" ? (
        <strong className="funky-brand-heading font-display text-lg font-bold tracking-tight text-white">{projectName}</strong>
      ) : null}
    </div>
  ) : null;
  return (
    <footer id="sf-footer" className="sf-footer funky-footer border-t border-zinc-200 bg-zinc-950 text-zinc-300 dark:border-zinc-800">
      <div className="mx-auto w-full px-4 pb-8 pt-14 sm:px-6 lg:px-8" style={{ maxWidth: `${themeMaxWidthPx}px` }}>
        {logoNode}

        {showNewsletter ? (
          newsletterLayout === "centered" ? (
          <section className="relative mb-14 mx-auto grid max-w-xl gap-4 overflow-hidden rounded-3xl bg-brand-gradient p-8 text-center shadow-glow sm:p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="relative grid justify-items-center gap-2">
              <h2 className="m-0 font-display text-2xl font-bold text-white sm:text-3xl">{resolvedNewsletterTitle}</h2>
              <p className="m-0 max-w-sm text-sm text-white/80">{resolvedNewsletterDescription}</p>
            </div>
            <div className="relative mx-auto grid w-full max-w-sm justify-items-center gap-2.5">
              <NewsletterForm privacyConsentLabel={resolvedPrivacyConsentLabel} onSubscribe={onNewsletterSubscribe} stacked />
            </div>
          </section>
        ) : newsletterLayout === "image-bg" ? (
          <section
            className="relative mb-14 overflow-hidden rounded-3xl bg-cover bg-center p-8 shadow-glow sm:p-14"
            style={{ backgroundImage: `linear-gradient(180deg, rgba(9,9,11,0.55), rgba(9,9,11,0.85)), url(${newsletterBackgroundImage})` }}
          >
            <div className="relative mx-auto grid max-w-lg justify-items-center gap-4 text-center">
              <h2 className="m-0 font-display text-2xl font-bold text-white sm:text-3xl">{resolvedNewsletterTitle}</h2>
              <p className="m-0 max-w-sm text-sm text-white/80">{resolvedNewsletterDescription}</p>
              <div className="grid w-full max-w-sm justify-items-center gap-2.5">
                <NewsletterForm privacyConsentLabel={resolvedPrivacyConsentLabel} onSubscribe={onNewsletterSubscribe} stacked />
              </div>
            </div>
          </section>
        ) : (
          <section className="relative mb-14 overflow-hidden rounded-3xl bg-brand-gradient p-8 shadow-glow sm:p-10">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-black/10 blur-2xl"
              aria-hidden="true"
            />
            <div className="relative grid gap-5 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <div className="grid gap-2">
                <h2 className="m-0 font-display text-2xl font-bold text-white sm:text-3xl">
                  {resolvedNewsletterTitle}
                </h2>
                <p className="m-0 max-w-md text-sm text-white/80">
                  {resolvedNewsletterDescription}
                </p>
              </div>
              <div className="grid gap-2.5">
                <NewsletterForm privacyConsentLabel={resolvedPrivacyConsentLabel} onSubscribe={onNewsletterSubscribe} />
              </div>
            </div>
          </section>
          )
        ) : null}

        {showAssistantFrame || showSpotifyPlayer ? (
          assistantSpotifyLayout === "tabbed" && showAssistantFrame && showSpotifyPlayer ? (
            <section className="mb-12 grid gap-4">
              <div
                role="tablist"
                aria-label={t("footer.assistant_spotify.aria")}
                className="inline-flex w-fit gap-1 rounded-full border border-zinc-700 bg-zinc-900/60 p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeAssistantTab === "assistant"}
                  onClick={() => setActiveAssistantTab("assistant")}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    activeAssistantTab === "assistant" ? "bg-brand-gradient text-white shadow-glow" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t("footer.assistant.tab")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeAssistantTab === "spotify"}
                  onClick={() => setActiveAssistantTab("spotify")}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    activeAssistantTab === "spotify" ? "bg-brand-gradient text-white shadow-glow" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t("footer.spotify.tab")}
                </button>
              </div>
              {activeAssistantTab === "assistant" ? (
                assistantSlot ?? <AssistantFrame title={resolvedAssistantFrameTitle} fullWidth />
              ) : (
                <SpotifyFrame
                  title={resolvedSpotifyPlayerTitle}
                  description={resolvedSpotifyPlayerDescription}
                  playerProps={spotifyPlayerProps}
                  fullWidth
                />
              )}
            </section>
          ) : assistantSpotifyLayout === "stacked" ? (
            <section className="mb-12 grid gap-5">
              {showAssistantFrame ? assistantSlot ?? <AssistantFrame title={resolvedAssistantFrameTitle} fullWidth /> : null}
              {showSpotifyPlayer ? (
                <SpotifyFrame
                  title={resolvedSpotifyPlayerTitle}
                  description={resolvedSpotifyPlayerDescription}
                  playerProps={spotifyPlayerProps}
                  fullWidth
                />
              ) : null}
            </section>
          ) : (
            <section className="mb-12 grid gap-5 lg:grid-cols-2">
              {showAssistantFrame ? (
                assistantSlot ?? <AssistantFrame title={resolvedAssistantFrameTitle} fullWidth={!showSpotifyPlayer} />
              ) : null}
              {showSpotifyPlayer ? (
                <SpotifyFrame
                  title={resolvedSpotifyPlayerTitle}
                  description={resolvedSpotifyPlayerDescription}
                  playerProps={spotifyPlayerProps}
                  fullWidth={!showAssistantFrame}
                />
              ) : null}
            </section>
          )
        ) : null}

        <section
          className={`mb-12 grid gap-8 border-b border-zinc-800/70 pb-12 ${
            columnsLayout === "accordion-single"
              ? ""
              : columnsLayout === "grid-2-wide"
                ? "sm:grid-cols-2"
                : "sm:grid-cols-2 lg:grid-cols-4"
          }`}
        >
          {columnsLayout === "accordion-single" ? (
            <div className="grid gap-1 divide-y divide-zinc-800/70">
              {footerColumns.map((column) => (
                <FooterColumnAccordion key={column.title} column={column} />
              ))}
            </div>
          ) : (
            footerColumns.map((column) => (
              <div key={column.title}>
                <h3 className={`mt-0 text-sm font-semibold uppercase tracking-wide text-zinc-100 ${column.description ? "mb-1" : "mb-4"}`}>
                  {column.title}
                </h3>
                <MenuDescription
                  html={column.description}
                  className="mb-4 mt-0 text-xs text-zinc-500"
                />
                <ul className="m-0 grid list-none gap-2.5 p-0">
                  {column.links.map((link) => (
                    <FooterNavItem key={link.label} item={link} />
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        {bottomBarLayout === "centered" ? (
          <section className="grid justify-items-center gap-4 text-center">
            {showPaymentMethods ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {visiblePaymentMethods.map((method) => (
                  <FooterPaymentMark key={method.key} method={method} />
                ))}
              </div>
            ) : null}

            {showSocialLinks && visibleSocialLinks.length ? (
              <div className="flex flex-wrap items-center justify-center gap-1">
                {visibleSocialLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.label}
                    title={link.label}
                    className="inline-grid h-9 w-9 place-items-center rounded-full text-zinc-400 no-underline transition duration-500 hover:scale-110 hover:bg-zinc-800 hover:text-white"
                  >
                    <img
                      src={link.icon}
                      alt=""
                      aria-hidden="true"
                      className="h-4 w-4 invert"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            ) : null}

            {showCopyright && visibleCopyrightText ? <p className="m-0 text-xs text-zinc-500">{visibleCopyrightText}</p> : null}
          </section>
        ) : (
          <>
            <section className="flex flex-wrap items-center justify-between gap-5">
              {showPaymentMethods ? (
                <div className="flex flex-wrap items-center gap-2">
                  {visiblePaymentMethods.map((method) => (
                    <FooterPaymentMark key={method.key} method={method} />
                  ))}
                </div>
              ) : null}

              {showSocialLinks && visibleSocialLinks.length ? (
                <div className="flex flex-wrap gap-1">
                  {visibleSocialLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.label}
                      title={link.label}
                      className="inline-grid h-9 w-9 place-items-center rounded-full text-zinc-400 no-underline transition duration-500 hover:scale-110 hover:bg-zinc-800 hover:text-white"
                    >
                      <img
                        src={link.icon}
                        alt=""
                        aria-hidden="true"
                        className="h-4 w-4 invert"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              ) : null}
            </section>

            {showCopyright && visibleCopyrightText ? <p className="mb-0 mt-8 text-xs text-zinc-500">{visibleCopyrightText}</p> : null}
          </>
        )}

        {showExtraWrapper && safeExtraWrapperHtml && extraWrapperLayout === "inline" ? (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-xs text-zinc-500">
            <SafeHtmlContent html={safeExtraWrapperHtml} className="[&_a]:text-zinc-300 [&_a]:underline [&_p]:m-0" />
          </div>
        ) : null}
      </div>

      {showExtraWrapper && safeExtraWrapperHtml && extraWrapperLayout === "full-bleed" ? (
        <div className="flex h-[150px] w-screen items-center justify-center border-t border-zinc-800 bg-zinc-900/60 px-4 text-center text-xs text-zinc-500">
          <SafeHtmlContent html={safeExtraWrapperHtml} className="[&_a]:text-zinc-300 [&_a]:underline [&_p]:m-0" />
        </div>
      ) : null}
    </footer>
  );
}

/** Renders a single footer link; if the link has `children`, adds a rotating chevron
 * button that expands a nested, indented sub-list — mirrors the legacy prototype's
 * footer accordion columns so deep menu structures stay compact by default. */
function FooterNavItem({ item, depth = 0 }: { item: FooterLinkItem; depth?: number }) {
  const t = useT();
  const [isExpanded, setIsExpanded] = useState(() => isMenuInitiallyExpanded(item.cssClasses));
  const hasChildren = Boolean(item.children?.length);

  return (
    <li>
      <div className="flex items-center justify-between gap-2">
        <a
          href={item.href}
          className={`${depth ? "text-zinc-500" : "text-zinc-400"} text-sm no-underline transition hover:text-white`}
        >
          {item.label}
        </a>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsExpanded((value) => !value)}
            aria-expanded={isExpanded}
            aria-label={t(isExpanded ? "footer.nav.collapse" : "footer.nav.expand", { label: item.label })}
            className="-mr-1 inline-grid h-6 w-6 shrink-0 place-items-center rounded-full text-zinc-500 transition hover:text-white"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90 text-brand-400" : ""}`}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>

      <MenuDescription
        html={item.description}
        className={`mt-1 text-xs ${depth ? "text-zinc-600" : "text-zinc-500"}`}
      />

      {hasChildren ? (
        <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden" aria-hidden={!isExpanded}>
            <ul className="m-0 mt-2 grid list-none gap-2 border-l border-zinc-800 p-0 pl-3">
              {item.children!.map((child) => (
                <FooterNavItem key={`${child.label}:${child.href}`} item={child} depth={depth + 1} />
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Shared email-capture form used by all three newsletter layouts — `stacked` swaps
 * the row-oriented input+button pair for a full-width stacked pair, used by the
 * `centered`/`image-bg` variants where the surrounding column is already narrow. */
function NewsletterForm({
  privacyConsentLabel,
  onSubscribe,
  stacked = false,
}: {
  privacyConsentLabel: string;
  onSubscribe?: (email: string, source: "newsletter-footer") => Promise<void>;
  stacked?: boolean;
}) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!agreed) {
      setStatus(t("newsletter.consent"));
      return;
    }
    setSubmitting(true);
    setStatus("");
    try {
      await onSubscribe?.(email.trim(), "newsletter-footer");
      setEmail("");
      setAgreed(false);
      setStatus(t("newsletter.subscribed"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("newsletter.signup_error"));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <form className="grid w-full gap-2.5" onSubmit={submit}>
      <div className={`flex w-full flex-wrap gap-2 ${stacked ? "flex-col" : "sm:flex-nowrap"}`}>
        <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("newsletter.email")} className="min-w-[220px] flex-1 rounded-full border border-white/30 bg-white/10 px-4 py-3 text-sm text-white outline-none backdrop-blur-sm transition placeholder:text-white/60 focus:border-white focus:bg-white/20 focus:ring-4 focus:ring-white/20" />
        <button type="submit" disabled={submitting} className="whitespace-nowrap rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white shadow-soft-lg transition hover:-translate-y-0.5 hover:bg-zinc-900 disabled:cursor-wait disabled:opacity-60">
          {t(submitting ? "newsletter.subscribing" : "newsletter.subscribe")}
        </button>
      </div>
      <label className={`inline-flex items-start gap-2 text-xs text-white/70 ${stacked ? "text-center" : ""}`}>
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 h-3.5 w-3.5 rounded border-white/40 bg-white/10 text-brand-500 focus:ring-brand-300" />
        <span>{privacyConsentLabel}</span>
      </label>
      {status ? <p className="m-0 text-xs text-white" role="status" aria-live="polite">{status}</p> : null}
    </form>
  );
}

/** AI shopping assistant placeholder frame — extracted so both the side-by-side and
 * tabbed `assistantSpotifyLayout` variants can render the identical panel content. */
function AssistantFrame({ title, fullWidth }: { title: string; fullWidth?: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-5 ${
        fullWidth ? "lg:col-span-2" : ""
      }`}
    >
      <span className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gradient text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <path d="M12 3l2.2 4.8L19 10l-4.8 2.2L12 17l-2.2-4.8L5 10l4.8-2.2L12 3Z" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <h3 className="m-0 text-sm font-medium text-zinc-200">{title}</h3>
    </div>
  );
}

/** Spotify player placeholder frame — extracted for the same reason as `AssistantFrame`. */
function SpotifyFrame({
  title,
  description,
  playerProps,
  fullWidth,
}: {
  title: string;
  description: string;
  playerProps?: SpotifyPlayerMockProps;
  fullWidth?: boolean;
}) {
  return (
    <div className={`grid gap-3 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-5 ${fullWidth ? "lg:col-span-2" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gradient text-white">
          <Music2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="grid gap-0.5">
          <h3 className="m-0 text-sm font-medium text-zinc-200">{title}</h3>
          <p className="m-0 text-xs text-zinc-500">{description}</p>
        </div>
      </div>
      <SpotifyPlayerMock title={title} {...playerProps} />
    </div>
  );
}

/** A single footer column collapsed into an accordion header — used by the
 * `accordion-single` `columnsLayout` variant to stack every column into one compact
 * list instead of a multi-column grid. */
function FooterColumnAccordion({ column }: { column: FooterColumn }) {
  const [isExpanded, setIsExpanded] = useState(() => isMenuInitiallyExpanded(column.cssClasses));

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold uppercase tracking-wide text-zinc-100"
      >
        {column.title}
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${isExpanded ? "rotate-90 text-brand-400" : ""}`}
          aria-hidden="true"
        />
      </button>
      <MenuDescription
        html={column.description}
        className="mt-1 text-xs text-zinc-500"
      />
      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden" aria-hidden={!isExpanded}>
          <ul className="m-0 mt-3 grid list-none gap-2.5 p-0 pl-1">
            {column.links.map((link) => (
              <FooterNavItem key={`${link.label}:${link.href}`} item={link} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
