import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookMarked,
  CreditCard,
  Eye,
  Heart,
  Image as ImageIcon,
  KeyRound,
  LayoutGrid,
  Mail,
  Maximize,
  Menu as MenuIcon,
  MessageCircle,
  Palette,
  PanelBottom,
  Search,
  Share2,
  ShoppingCart as ShoppingCartIcon,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import {
  BRAND_COLOR_STEPS,
  BRAND_GRADIENT_STYLE_OPTIONS,
  BRAND_PALETTES,
  BRAND_PALETTE_OPTIONS,
  PAYMENT_METHODS,
  SOCIAL_LINKS,
  ViewSwitch,
  useLayoutPreferences,
  type CartTriggerVariant,
  type FooterAssistantLayout,
  type FooterBottomBarLayout,
  type FooterColumnsLayout,
  type FooterExtraWrapperLayout,
  type FooterLogoVariant,
  type FooterNewsletterLayout,
  type HeaderLogoVariant,
  type HeaderSearchVariant,
  type NewsletterPopupVariant,
} from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { useLayoutPreferencesSync } from "../lib/layoutPreferencesSync";

const HEADER_SEARCH_OPTIONS: { value: HeaderSearchVariant; label: string }[] = [
  { value: "full-width", label: "Full-width bar" },
  { value: "expandable", label: "Icon → expands" },
];

const HEADER_LOGO_OPTIONS: { value: HeaderLogoVariant; label: string }[] = [
  { value: "text", label: "Text only" },
  { value: "image", label: "Icon mark only" },
  { value: "text-image", label: "Icon + text" },
];

const NEWSLETTER_POPUP_VARIANT_OPTIONS: { value: NewsletterPopupVariant; label: string }[] = [
  { value: "split", label: "Split (image + form)" },
  { value: "modern-card", label: "Modern corner card" },
  { value: "modern-center", label: "Modern centered" },
];

/** The theme's `brand` color scale + gradient/shadow tokens — this section is a *live*
 * control, not just documentation: picking a preset below calls `setBrandPalette`,
 * which repaints the `--brand-*` CSS variables every one of these Tailwind classes
 * resolves through (see `state/brandPalettes.ts`), so the whole site's brand color
 * changes immediately. The swatch/hex values shown always reflect the active preset. */
const BRAND_GRADIENT_TOKENS: { name: string; twClass: string; description: string }[] = [
  { name: "brand-gradient", twClass: "bg-brand-gradient", description: "The active preset's 2 gradient stops — CTAs, hero accents, active tab fills." },
  {
    name: "brand-gradient-soft",
    twClass: "bg-brand-gradient-soft",
    description: "Same gradient at 12% opacity — subtle section backgrounds and hover washes.",
  },
];

const BRAND_SHADOW_TOKENS: { name: string; twClass: string; description: string }[] = [
  { name: "shadow-soft", twClass: "shadow-soft", description: "Default card elevation used across the whole theme." },
  { name: "shadow-soft-lg", twClass: "shadow-soft-lg", description: "Hover/active elevation step-up for the same cards." },
  { name: "shadow-glow", twClass: "shadow-glow", description: "Brand-tinted glow reserved for primary CTAs — tints with the active preset's 500 step." },
];

const BOOL_OPTIONS: { value: "on" | "off"; label: string }[] = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

function BoolSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <ViewSwitch
      label={label}
      value={value ? "on" : "off"}
      onChange={(next) => onChange(next === "on")}
      options={BOOL_OPTIONS}
    />
  );
}

/** Native range-slider control, used for numeric preferences (currently just the theme
 * max-width) — no other studio preference is a continuous number yet, so this sits
 * alongside `BoolSwitch`/`ViewSwitch` as the third small control primitive here. */
function RangeControl({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="flex items-center justify-between font-semibold text-zinc-700 dark:text-zinc-200">
        {label}
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="funky-range-control h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-brand-600 dark:bg-zinc-800"
      />
    </label>
  );
}


const FOOTER_COLUMNS_OPTIONS: { value: FooterColumnsLayout; label: string }[] = [
  { value: "grid-4", label: "4-column grid" },
  { value: "grid-2-wide", label: "2 wide columns" },
  { value: "accordion-single", label: "Accordion (mobile-style)" },
];

const FOOTER_NEWSLETTER_OPTIONS: { value: FooterNewsletterLayout; label: string }[] = [
  { value: "banner", label: "Banner" },
  { value: "centered", label: "Centered box" },
  { value: "image-bg", label: "Image background" },
];

const FOOTER_ASSISTANT_OPTIONS: { value: FooterAssistantLayout; label: string }[] = [
  { value: "side-by-side", label: "Side by side" },
  { value: "tabbed", label: "Tabbed" },
  { value: "stacked", label: "Stacked (full width)" },
];

const FOOTER_LOGO_OPTIONS: { value: FooterLogoVariant; label: string }[] = [
  { value: "text", label: "Text only" },
  { value: "image", label: "Icon mark only" },
  { value: "text-image", label: "Icon + text" },
];

const FOOTER_BOTTOM_BAR_OPTIONS: { value: FooterBottomBarLayout; label: string }[] = [
  { value: "split", label: "Split (left/right)" },
  { value: "centered", label: "Centered stack" },
];

const FOOTER_EXTRA_WRAPPER_OPTIONS: { value: FooterExtraWrapperLayout; label: string }[] = [
  { value: "inline", label: "Inline (boxed)" },
  { value: "full-bleed", label: "Full-bleed (150px band)" },
];

const CART_TRIGGER_OPTIONS: { value: CartTriggerVariant; label: string }[] = [
  { value: "drawer", label: "Slide-in drawer" },
  { value: "dropdown", label: "Anchored dropdown" },
];

type LivePageCard = {
  icon: typeof Heart;
  title: string;
  description: string;
  href: string;
  switchLabel: string;
};

const LIVE_PAGE_SWITCHES: LivePageCard[] = [
  {
    icon: KeyRound,
    title: "Auth forms",
    description: "Split-screen (current), centered card, and full-bleed image-background alternatives for login/register/forgot-password.",
    href: "/auth",
    switchLabel: "Layout",
  },
  {
    icon: BookMarked,
    title: "Reading list",
    description: "Saved-post cards (current) vs. a dense 2-column editorial list, newspaper-style.",
    href: "/reading-list",
    switchLabel: "Layout",
  },
  {
    icon: Heart,
    title: "Wishlist",
    description: "Cycle saved products through every card style — default, minimal, editorial, gallery, variation, simple, and the legacy-inspired Expandable variant.",
    href: "/wishlist",
    switchLabel: "Card style",
  },
  {
    icon: Users,
    title: "Community profile",
    description: "Gradient card (current), full-width cover banner, and a compact single-row header for member profiles.",
    href: "/community/jordandoe",
    switchLabel: "Header layout",
  },
];

/**
 * Design-review control panel for phase-.x layout switches — the header/footer
 * switches here drive the *real*, live site chrome (via `useLayoutPreferences`), so
 * flipping an option here and then scrolling up/down or navigating the site shows the
 * actual effect immediately, rather than an isolated preview. Auth/Reading-List/
 * Wishlist/Community-Profile already carry their own switches directly on their live
 * pages, so this page links out to them instead of duplicating those controls.
 */
export function LayoutStudioMockupPage() {
  const {
    showAnnouncementBar,
    setShowAnnouncementBar,
    announcementBarScrollEffect,
    setAnnouncementBarScrollEffect,
    headerSticky,
    setHeaderSticky,
    headerSearchVariant,
    setHeaderSearchVariant,
    headerLogoVariant,
    setHeaderLogoVariant,
    showHeaderLogo,
    setShowHeaderLogo,
    showHeaderSearchIcon,
    setShowHeaderSearchIcon,
    showHeaderLanguageSwitcher,
    setShowHeaderLanguageSwitcher,
    showHeaderCurrencySwitcher,
    setShowHeaderCurrencySwitcher,
    showHeaderDarkModeToggle,
    setShowHeaderDarkModeToggle,
    showHeaderAccountLink,
    setShowHeaderAccountLink,
    showHeaderReadingListLink,
    setShowHeaderReadingListLink,
    showHeaderWishlistLink,
    setShowHeaderWishlistLink,
    showHeaderCartIcon,
    setShowHeaderCartIcon,
    cartTriggerVariant,
    setCartTriggerVariant,
    showCartDrawerPromotedProduct,
    setShowCartDrawerPromotedProduct,
    showFooter,
    setShowFooter,
    footerColumnsLayout,
    setFooterColumnsLayout,
    footerNewsletterLayout,
    setFooterNewsletterLayout,
    showFooterNewsletter,
    setShowFooterNewsletter,
    footerAssistantLayout,
    setFooterAssistantLayout,
    footerLogoVariant,
    setFooterLogoVariant,
    footerBottomBarLayout,
    setFooterBottomBarLayout,
    footerExtraWrapperLayout,
    setFooterExtraWrapperLayout,
    showFooterLogo,
    setShowFooterLogo,
    showFooterExtraWrapper,
    setShowFooterExtraWrapper,
    showFooterSpotifyPlayer,
    setShowFooterSpotifyPlayer,
    showFooterAssistantFrame,
    setShowFooterAssistantFrame,
    showFooterPaymentMethods,
    setShowFooterPaymentMethods,
    showFooterSocialLinks,
    setShowFooterSocialLinks,
    showFooterCopyright,
    setShowFooterCopyright,
    hiddenFooterPaymentMethodKeys,
    toggleFooterPaymentMethodKey,
    hiddenFooterSocialLinkKeys,
    toggleFooterSocialLinkKey,
    themeMaxWidthPx,
    setThemeMaxWidthPx,
    themeRadiusPx,
    setThemeRadiusPx,
    showBreadcrumbs,
    setShowBreadcrumbs,
    showNewsletterPopup,
    setShowNewsletterPopup,
    newsletterPopupVariant,
    setNewsletterPopupVariant,
    newsletterPopupCooldownDays,
    setNewsletterPopupCooldownDays,
    brandPalette,
    setBrandPalette,
    brandGradientStyle,
    setBrandGradientStyle,
    checkoutStoreMode,
    setCheckoutStoreMode,
    checkoutCouponPosition,
    setCheckoutCouponPosition,
    checkoutPaymentPosition,
    setCheckoutPaymentPosition,
    checkoutSummaryPosition,
    setCheckoutSummaryPosition,
    checkoutHideOptionalBillingFields,
    setCheckoutHideOptionalBillingFields,
    checkoutHideOptionalShippingFields,
    setCheckoutHideOptionalShippingFields,
    checkoutShowOrderNotes,
    setCheckoutShowOrderNotes,
    checkoutShowTerms,
    setCheckoutShowTerms,
    checkoutShowPrivacy,
    setCheckoutShowPrivacy,
  } = useLayoutPreferences();
  useLayoutPreferencesSync();

  return (
    <div className="grid gap-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Layout studio" }]} />

      <section className="grid gap-3 rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
        <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Phase .x — layout studio
        </span>
        <h1 className="m-0 font-display text-3xl font-bold text-zinc-900 dark:text-zinc-100">Layout &amp; view-switch studio</h1>
        <p className="m-0 max-w-2xl text-zinc-500 dark:text-zinc-400">
          A single place to try every layout alternative introduced this round before backend mapping starts. The header and footer
          switches below control the actual site chrome — change one, then scroll or browse to see it live. The remaining switches
          already live on their own pages, so we link out to them instead of building a second copy here.
        </p>
      </section>

      <LayoutStudioSection
        icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Checkout"
        title="Checkout layout and digital-only mode"
        description="These controls now drive the live checkout route. Shortcodes can still override the same attributes when embedded in WordPress content."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ViewSwitch
            label="Store mode"
            value={checkoutStoreMode}
            onChange={setCheckoutStoreMode}
            options={[{ value: "physical", label: "Physical" }, { value: "digital", label: "Digital only" }]}
          />
          <ViewSwitch
            label="Coupon field"
            value={checkoutCouponPosition}
            onChange={setCheckoutCouponPosition}
            options={[{ value: "inline", label: "Inline" }, { value: "top", label: "At top" }]}
          />
          <ViewSwitch
            label="Payment methods"
            value={checkoutPaymentPosition}
            onChange={setCheckoutPaymentPosition}
            options={[{ value: "left", label: "Left column" }, { value: "right", label: "Right column" }]}
          />
          <ViewSwitch
            label="Order summary"
            value={checkoutSummaryPosition}
            onChange={setCheckoutSummaryPosition}
            options={[{ value: "sticky", label: "Sticky" }, { value: "static", label: "Static" }]}
          />
          <BoolSwitch
            label="Hide optional billing fields"
            value={checkoutHideOptionalBillingFields}
            onChange={setCheckoutHideOptionalBillingFields}
          />
          <BoolSwitch
            label="Hide optional shipping fields"
            value={checkoutHideOptionalShippingFields}
            onChange={setCheckoutHideOptionalShippingFields}
          />
          <BoolSwitch label="Order notes" value={checkoutShowOrderNotes} onChange={setCheckoutShowOrderNotes} />
          <BoolSwitch label="Terms checkbox" value={checkoutShowTerms} onChange={setCheckoutShowTerms} />
          <BoolSwitch label="Privacy checkbox" value={checkoutShowPrivacy} onChange={setCheckoutShowPrivacy} />
        </div>
        <Link
          to="/checkout"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-brand-600 no-underline hover:underline dark:text-brand-400"
        >
          Open the live checkout page
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<Search className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Header"
        title="Nav search"
        description="Full-width search bar (current default) vs. an icon button that smoothly expands into the same search box in place — saves header width on busy nav bars."
      >
        <ViewSwitch label="Search style" value={headerSearchVariant} onChange={setHeaderSearchVariant} options={HEADER_SEARCH_OPTIONS} />
        <LiveChromeNotice text="Scroll up — the header at the top of this page reflects your choice." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Theme"
        title="Border radius"
        description="One proportional radius scale for cards, images, panels, inputs, sliders, and overlays. The 16px default preserves the current theme; lowering it sharpens every standard rounded token while raising it softens the whole storefront."
      >
        <RangeControl
          label="Base radius"
          value={themeRadiusPx}
          onChange={setThemeRadiusPx}
          min={0}
          max={24}
          step={1}
          unit="px"
        />
        <div className="grid grid-cols-3 gap-3">
          {["rounded-xl", "rounded-2xl", "rounded-3xl"].map((radiusClass) => (
            <div key={radiusClass} className={`${radiusClass} border border-brand-200 bg-brand-50 p-4 text-center text-xs font-semibold text-brand-700 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-300`}>
              {radiusClass}
            </div>
          ))}
        </div>
        <LiveChromeNotice text="This control updates the shared radius token immediately across the storefront." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<ImageIcon className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Header"
        title="Brand logo"
        description="The header brand mark, top-left — wordmark only, icon mark only, or both together (current default). Same three options as the footer logo. Can also be switched off entirely."
      >
        <ViewSwitch label="Logo variant" value={headerLogoVariant} onChange={setHeaderLogoVariant} options={HEADER_LOGO_OPTIONS} />
        <BoolSwitch label="Logo image" value={showHeaderLogo} onChange={setShowHeaderLogo} />
        <LiveChromeNotice text="Scroll up to see the header logo change." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<MenuIcon className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Header"
        title="Top promo bar"
        description="The announcement strip above the main header row — show it (current default), or hide it entirely to save vertical space. Its scroll-out collapse effect can also be switched off so it stays put."
      >
        <BoolSwitch label="Promo bar" value={showAnnouncementBar} onChange={setShowAnnouncementBar} />
        <BoolSwitch label="Scroll-out effect" value={announcementBarScrollEffect} onChange={setAnnouncementBarScrollEffect} />
        <LiveChromeNotice text="Scroll to the very top of the page." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<PanelBottom className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Header"
        title="Sticky header"
        description="On (current default) pins the header to the top of the viewport at all times. Off lets it scroll away with the page like ordinary content."
      >
        <BoolSwitch label="Sticky" value={headerSticky} onChange={setHeaderSticky} />
        <LiveChromeNotice text="Scroll down a page to see the header stay pinned (on) or scroll away (off)." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<Maximize className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Theme"
        title="Content max-width"
        description="The theme's global content column width — drives the header/main/footer column and any full-width section's inner content (e.g. the home page's full-width hero). Default 1280px matches the theme's original fixed width."
      >
        <RangeControl
          label="Max width"
          value={themeMaxWidthPx}
          onChange={setThemeMaxWidthPx}
          min={960}
          max={1600}
          step={10}
          unit="px"
        />
        <LiveChromeNotice text="Drag the slider, then check the header/footer column width or the home page's full-width hero." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<MenuIcon className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Theme"
        title="Breadcrumbs"
        description="Show the shared page-location trail across the storefront, or hide it globally for a cleaner layout. SEO breadcrumb structured data remains available when the visible trail is off."
      >
        <BoolSwitch label="Breadcrumbs" value={showBreadcrumbs} onChange={setShowBreadcrumbs} />
        <LiveChromeNotice text="The breadcrumb above this studio updates immediately and the setting applies to every shared page trail." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<Palette className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Theme"
        title="Color palette"
        description="Pick from 20 curated brand-color presets — or switch the gradient/flat style — and the whole theme repaints live. Every bg-brand-*/text-brand-* class, the brand-gradient/brand-gradient-soft backgrounds, and the shadow-glow CTA glow all read from the same CSS variables this control writes. Not just documentation anymore: this is the real, site-wide color source."
      >
        <ViewSwitch label="Gradient style" value={brandGradientStyle} onChange={setBrandGradientStyle} options={BRAND_GRADIENT_STYLE_OPTIONS} />

        <div className="flex flex-wrap gap-2.5">
          {BRAND_PALETTE_OPTIONS.map((option) => {
            const palette = BRAND_PALETTES[option.value];
            const isActive = option.value === brandPalette;
            const swatchBackground =
              brandGradientStyle === "flat"
                ? palette.scale["600"]
                : `linear-gradient(135deg, ${palette.gradientFrom} 0%, ${palette.gradientTo} 100%)`;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setBrandPalette(option.value)}
                aria-pressed={isActive}
                title={palette.description}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-transparent bg-zinc-900 text-white shadow-soft dark:bg-white dark:text-zinc-900"
                    : "border-zinc-200 text-zinc-600 hover:border-brand-300 hover:text-brand-600 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-brand-500/50"
                }`}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                  style={{ background: swatchBackground }}
                  aria-hidden="true"
                />
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
          {BRAND_COLOR_STEPS.map((step) => {
            const hex = BRAND_PALETTES[brandPalette].scale[step];
            return (
              <div key={step} className="grid gap-1.5 text-center">
                <span
                  className="block aspect-square rounded-xl ring-1 ring-inset ring-black/5 dark:ring-white/10"
                  style={{ backgroundColor: hex }}
                  aria-hidden="true"
                />
                <span className="text-[0.65rem] font-semibold text-zinc-600 dark:text-zinc-400">{step}</span>
                <span className="text-[0.6rem] text-zinc-400 dark:text-zinc-500">{hex}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {BRAND_GRADIENT_TOKENS.map((gradient) => (
            <div key={gradient.name} className="grid gap-2 rounded-2xl border border-zinc-200/80 p-3 dark:border-zinc-800">
              <span className={`block h-12 rounded-xl ring-1 ring-inset ring-black/5 dark:ring-white/10 ${gradient.twClass}`} aria-hidden="true" />
              <div className="grid gap-0.5">
                <code className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{gradient.name}</code>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{gradient.description}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {BRAND_SHADOW_TOKENS.map((shadow) => (
            <div key={shadow.name} className="grid gap-2 rounded-2xl border border-zinc-200/80 p-3 dark:border-zinc-800">
              <span className={`block h-12 rounded-xl bg-white dark:bg-zinc-900 ${shadow.twClass}`} aria-hidden="true" />
              <div className="grid gap-0.5">
                <code className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{shadow.name}</code>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{shadow.description}</span>
              </div>
            </div>
          ))}
        </div>
        <LiveChromeNotice text="Applies instantly, site-wide — browse anywhere while a preset is active to see it." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Theme"
        title="Newsletter popup"
        description="The mailing-list popup that opens a few seconds after landing on the storefront. Switch it off entirely, try 2 newer, fresher visual treatments alongside the original split layout, and control how many days pass before a visitor who dismissed it sees it again."
      >
        <BoolSwitch label="Popup" value={showNewsletterPopup} onChange={setShowNewsletterPopup} />
        <ViewSwitch
          label="Visual style"
          value={newsletterPopupVariant}
          onChange={setNewsletterPopupVariant}
          options={NEWSLETTER_POPUP_VARIANT_OPTIONS}
        />
        <RangeControl
          label="Show again after"
          value={newsletterPopupCooldownDays}
          onChange={setNewsletterPopupCooldownDays}
          min={1}
          max={30}
          step={1}
          unit=" days"
        />
        <LiveChromeNotice text="Reload the page and wait ~6s to see it — clearing this browser's localStorage resets the cooldown for testing." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<ShoppingCartIcon className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Header"
        title="Cart trigger"
        description="Slide-in drawer (current default) opens a full side panel. Anchored dropdown opens a compact popover right under the cart icon instead."
      >
        <ViewSwitch label="Cart opens as" value={cartTriggerVariant} onChange={setCartTriggerVariant} options={CART_TRIGGER_OPTIONS} />
        <BoolSwitch label="Promoted product when empty" value={showCartDrawerPromotedProduct} onChange={setShowCartDrawerPromotedProduct} />
        <LiveChromeNotice text="Add something to the cart, then click the cart icon in the header to try it." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<Eye className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Header"
        title="Icon visibility"
        description="Independently show or hide each of the header's right-side icons — useful for a slimmer nav on a smaller catalog or a members-only relaunch."
      >
        <BoolSwitch label="Search" value={showHeaderSearchIcon} onChange={setShowHeaderSearchIcon} />
        <BoolSwitch label="Language switcher" value={showHeaderLanguageSwitcher} onChange={setShowHeaderLanguageSwitcher} />
        <BoolSwitch label="Currency switcher" value={showHeaderCurrencySwitcher} onChange={setShowHeaderCurrencySwitcher} />
        <BoolSwitch label="Dark mode toggle" value={showHeaderDarkModeToggle} onChange={setShowHeaderDarkModeToggle} />
        <BoolSwitch label="Account link" value={showHeaderAccountLink} onChange={setShowHeaderAccountLink} />
        <BoolSwitch label="Reading list" value={showHeaderReadingListLink} onChange={setShowHeaderReadingListLink} />
        <BoolSwitch label="Wishlist" value={showHeaderWishlistLink} onChange={setShowHeaderWishlistLink} />
        <BoolSwitch label="Cart" value={showHeaderCartIcon} onChange={setShowHeaderCartIcon} />
        <LiveChromeNotice text="Scroll up — the header's right-side icon row reflects your choices. The search toggle shows/hides the whole search feature regardless of style below." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<Eye className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Footer"
        title="Footer visibility"
        description="The whole footer on/off — for a page that shouldn't show any footer at all (e.g. a checkout-only or landing-page experiment)."
      >
        <BoolSwitch label="Footer" value={showFooter} onChange={setShowFooter} />
        <LiveChromeNotice text="Scroll to the bottom of any page — the whole footer disappears when off." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Footer"
        title="Column layout"
        description="The footer's link columns (Shop, Company, Support, Legal) — as an even 4-column grid, two wider columns, or a mobile-style single-column accordion."
      >
        <ViewSwitch label="Columns" value={footerColumnsLayout} onChange={setFooterColumnsLayout} options={FOOTER_COLUMNS_OPTIONS} />
        <LiveChromeNotice text="Scroll to the bottom of any page to see the footer's columns change." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<Mail className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Footer"
        title="Newsletter (before footer)"
        description="A full-width banner (current), a centered standalone box, or a version with a photographic background — all sharing the same copy and form fields. Can also be switched off entirely."
      >
        <ViewSwitch
          label="Newsletter layout"
          value={footerNewsletterLayout}
          onChange={setFooterNewsletterLayout}
          options={FOOTER_NEWSLETTER_OPTIONS}
        />
        <BoolSwitch label="Newsletter section" value={showFooterNewsletter} onChange={setShowFooterNewsletter} />
        <LiveChromeNotice text="It renders just above the footer columns — scroll down to check it out." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Footer"
        title="AI shopping assistant / Spotify player"
        description="Side by side (current) — assistant chat and the Spotify embed sharing a row — or tabbed, where only one is shown at a time behind a small switch."
      >
        <ViewSwitch
          label="Assistant / Spotify"
          value={footerAssistantLayout}
          onChange={setFooterAssistantLayout}
          options={FOOTER_ASSISTANT_OPTIONS}
        />
        <LiveChromeNotice text="Also in the footer, just above the columns." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<ImageIcon className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Footer"
        title="Brand logo"
        description="The footer brand mark, above the newsletter banner — wordmark only, icon mark only, or both together (current default). Centered by default. Can also be switched off entirely."
      >
        <ViewSwitch label="Logo variant" value={footerLogoVariant} onChange={setFooterLogoVariant} options={FOOTER_LOGO_OPTIONS} />
        <BoolSwitch label="Logo image" value={showFooterLogo} onChange={setShowFooterLogo} />
        <LiveChromeNotice text="Scroll to the very top of the footer to see the logo change." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Footer"
        title="Payment / social / copyright bar"
        description="Split layout (current) keeps payment methods left and social icons right, with copyright below. Centered stacks payment, social and copyright into one centered column. The whole payment/social row can be switched off, and every payment icon (including Bitcoin and Ethereum) can be switched off one by one below."
      >
        <ViewSwitch
          label="Bottom bar layout"
          value={footerBottomBarLayout}
          onChange={setFooterBottomBarLayout}
          options={FOOTER_BOTTOM_BAR_OPTIONS}
        />
        <BoolSwitch label="Payment icons" value={showFooterPaymentMethods} onChange={setShowFooterPaymentMethods} />
        <BoolSwitch label="Social icons" value={showFooterSocialLinks} onChange={setShowFooterSocialLinks} />
        <LiveChromeNotice text="At the very bottom of the footer, below the link columns." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Footer"
        title="Payment icons, one by one"
        description="Turn each individual payment provider on/off — useful once the real WooCommerce gateway list is known and only a subset should show (for example, hide the FunkyCommerce Crypto Wallet gateway or BLIK outside Poland)."
      >
        {PAYMENT_METHODS.map((method) => (
          <BoolSwitch
            key={method.key}
            label={method.label}
            value={!hiddenFooterPaymentMethodKeys.includes(method.key)}
            onChange={() => toggleFooterPaymentMethodKey(method.key)}
          />
        ))}
        <LiveChromeNotice text="Only applies while the whole payment-icons row above is switched on." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<Share2 className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Footer"
        title="Social icons, one by one"
        description="Turn each individual social network on/off — e.g. drop a network the store doesn't actually run yet."
      >
        {SOCIAL_LINKS.map((link) => (
          <BoolSwitch
            key={link.key}
            label={link.label}
            value={!hiddenFooterSocialLinkKeys.includes(link.key)}
            onChange={() => toggleFooterSocialLinkKey(link.key)}
          />
        ))}
        <LiveChromeNotice text="Only applies while the whole social-icons row above is switched on." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<Eye className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Footer"
        title="Copyright line"
        description="The small copyright notice at the very bottom of the footer — on by default, can be switched off entirely (e.g. if it's already shown elsewhere)."
      >
        <BoolSwitch label="Copyright line" value={showFooterCopyright} onChange={setShowFooterCopyright} />
        <LiveChromeNotice text="The very last line in the footer, below the payment/social icons." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<PanelBottom className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Footer"
        title="Extra footer wrapper"
        description="Inline (current) keeps the placeholder note boxed within the footer's max width. Full-bleed breaks it out to a full-viewport-width, fixed 150px band — good for a promo strip or third-party embed. Can also be switched off entirely."
      >
        <ViewSwitch
          label="Wrapper layout"
          value={footerExtraWrapperLayout}
          onChange={setFooterExtraWrapperLayout}
          options={FOOTER_EXTRA_WRAPPER_OPTIONS}
        />
        <BoolSwitch label="Extra wrapper" value={showFooterExtraWrapper} onChange={setShowFooterExtraWrapper} />
        <LiveChromeNotice text="The very last element in the footer, below the copyright line." />
      </LayoutStudioSection>

      <LayoutStudioSection
        icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
        eyebrow="Footer"
        title="AI shopping assistant / Spotify player — visibility"
        description="Switch the assistant frame and the Spotify embed on/off independently, regardless of whether they're shown side by side, tabbed, or stacked."
      >
        <BoolSwitch label="AI shopping assistant" value={showFooterAssistantFrame} onChange={setShowFooterAssistantFrame} />
        <BoolSwitch label="Spotify player" value={showFooterSpotifyPlayer} onChange={setShowFooterSpotifyPlayer} />
        <LiveChromeNotice text="Also in the footer, just above the columns." />
      </LayoutStudioSection>

      <section className="grid gap-6 rounded-4xl border border-zinc-200/80 bg-white/80 p-6 shadow-soft backdrop-blur sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/80">
        <header className="grid gap-2 border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-brand-600 dark:text-brand-400">
            <MenuIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Already switchable on their own pages
          </div>
          <h2 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">More layout switches</h2>
          <p className="m-0 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            These pages already carry a live view-switch control, so trying them here would just be a second copy — open the page and
            look for the switch near the top instead.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {LIVE_PAGE_SWITCHES.map((page) => (
            <Link
              key={page.href}
              to={page.href}
              className="group grid gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-5 no-underline transition hover:border-brand-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-brand-600"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-display text-base font-bold text-zinc-900 dark:text-zinc-100">
                  <page.icon className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  {page.title}
                </span>
                <ArrowRight
                  className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600 dark:group-hover:text-brand-400"
                  aria-hidden="true"
                />
              </div>
              <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{page.description}</p>
              <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {page.switchLabel} switch on the page
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3 rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
        <p className="m-0">
          <strong className="text-zinc-700 dark:text-zinc-200">Home hero layout</strong> (classic glow / full-width cinematic / 3-slide
          cinematic slider) and the <strong className="text-zinc-700 dark:text-zinc-200">community feed layout</strong> (masonry / grid-3
          / grid-4 / list / compact) already have their own switches directly on the{" "}
          <Link to="/" className="font-semibold text-brand-600 no-underline hover:underline dark:text-brand-400">
            home page
          </Link>{" "}
          and the{" "}
          <Link to="/community" className="font-semibold text-brand-600 no-underline hover:underline dark:text-brand-400">
            community feed
          </Link>
          , and shop page card variants have theirs on the{" "}
          <Link to="/shop" className="font-semibold text-brand-600 no-underline hover:underline dark:text-brand-400">
            shop page
          </Link>
          . See the{" "}
          <Link to="/shortcodes" className="font-semibold text-brand-600 no-underline hover:underline dark:text-brand-400">
            shortcode library
          </Link>{" "}
          for slider/carousel/grid documentation.
        </p>
      </section>
    </div>
  );
}

function LayoutStudioSection({
  icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-5 rounded-4xl border border-zinc-200/80 bg-white/80 p-6 shadow-soft backdrop-blur sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/80">
      <header className="grid gap-2 border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-brand-600 dark:text-brand-400">
          {icon}
          {eyebrow}
        </div>
        <h2 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
        <p className="m-0 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
      </header>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function LiveChromeNotice({ text }: { text: string }) {
  return <p className="m-0 text-xs font-medium text-zinc-400 dark:text-zinc-500">{text}</p>;
}
