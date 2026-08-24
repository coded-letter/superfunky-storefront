import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlignJustify,
  Bell,
  BellRing,
  BookMarked,
  Bookmark,
  ChevronDown,
  CircleUser,
  Command,
  Contrast,
  Gift,
  Heart,
  Library,
  Menu,
  MessageCircle,
  Moon,
  PanelsTopLeft,
  ScanSearch,
  Search,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  Star,
  Sun,
  SunMoon,
  User,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { CurrencySwitcher, LanguageSwitcher, useT } from "../locale";
import { useLayoutPreferences, useReadingList, useCart, useTheme, useWishlist } from "../state";
import { CartDropdown } from "./CartDropdown";
import { SearchAutocomplete, type SearchAutocompleteProps } from "./SearchAutocomplete";
import { ResponsiveImage } from "../media";
import { getMegaMenuConfiguration, isMenuInitiallyExpanded } from "./menuClasses";
import { MenuDescription } from "./MenuDescription";
import { SafeHtmlContent } from "./SafeHtmlContent";
import { sanitizeStorefrontHtml } from "./sanitizeStorefrontHtml";

export type HeaderNavItem = {
  id?: string;
  label: string;
  href: string;
  title?: string;
  /** Sanitized WordPress menu-item description HTML. */
  description?: string;
  target?: string;
  cssClasses?: string[];
  linkRelationship?: string;
  children?: HeaderNavItem[];
};

/** Recursively checks whether the current path matches this nav item or any of its
 * nested descendants — used to highlight a dropdown trigger as active even when the
 * matching link is nested two or more levels deep. */
function navItemMatchesPath(item: HeaderNavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  return (item.children ?? []).some((child) => navItemMatchesPath(child, pathname));
}

/** `"full-width"` keeps the search bar permanently visible in the header row (current
 * default). `"expandable"` collapses it down to a single icon button that smoothly
 * grows into the same search field on click — a denser alternative for headers with
 * more nav items or branding that needs the extra horizontal room by default. */
export type HeaderSearchVariant = "full-width" | "expandable";
/** `"text"` shows the wordmark+tagline only. `"image"` shows only the gradient icon
 * mark. `"text-image"` (default, current) shows both — mirrors `FooterLogoVariant`. */
export type HeaderLogoVariant = "text" | "image" | "text-image";
/** `"drawer"` (default, current) opens `CartDrawer`'s full slide-in side panel.
 * `"dropdown"` opens a compact `CartDropdown` popover anchored under this header's
 * cart icon instead — the mounting page decides which one to render based on this
 * same preference (see `StorefrontChromeMockup`). */
export type CartTriggerVariant = "drawer" | "dropdown";

export type HeaderIconConfiguration = {
  search: string;
  theme: string;
  account: string;
  push: string;
  readingList: string;
  wishlist: string;
  cart: string;
  menu: string;
  assistant: string;
};
export type HeaderIconMediaConfiguration = Partial<Record<keyof HeaderIconConfiguration, string | null>>;

export type HeaderMockupProps = {
  announcementHtml?: string;
  /** Whether the top promo/announcement bar can ever show at all. `true` (default)
   * keeps the existing scroll-collapse behavior (visible at the top, hides on scroll).
   * `false` removes it entirely, regardless of scroll position. */
  showAnnouncementBar?: boolean;
  projectName?: string;
  projectTagline?: string;
  logoUrl?: string;
  iconUrl?: string;
  /** Path the logo / brand mark links to. Defaults to `"/"`. Pass the language-aware
   * home path (e.g. `"/en"` or `"/pl"`) so the link lands on the correct home
   * without triggering an intermediate redirect. */
  homePath?: string;
  headerIcons?: Partial<HeaderIconConfiguration>;
  headerIconMedia?: HeaderIconMediaConfiguration;
  primaryNavigation?: HeaderNavItem[];
  mobileNavigation?: HeaderNavItem[];
  hideNavigation?: boolean;
  showSearch?: boolean;
  searchVariant?: HeaderSearchVariant;
  search?: SearchAutocompleteProps["search"];
  /** Which parts of the header brand mark render — mirrors `FooterLogoVariant`. */
  logoVariant?: HeaderLogoVariant;
  showLanguageSwitcher?: boolean;
  showCurrencySwitcher?: boolean;
  showDarkModeToggle?: boolean;
  showAccountLink?: boolean;
  showPushAction?: boolean;
  pushSubscribed?: boolean;
  pushBusy?: boolean;
  onPushToggle?: () => void;
  showReadingListLink?: boolean;
  showWishlistLink?: boolean;
  showCartIcon?: boolean;
  /** Whole brand-mark block on/off — independent of `logoVariant` (which only picks
   * which parts of a *visible* logo render). `true` (default). */
  showLogo?: boolean;
  /** `true` (default, current) pins the header to the top of the viewport. `false`
   * lets it scroll away with the page like ordinary content. */
  sticky?: boolean;
  /** Whether the announcement bar collapses on scroll (current default) or stays
   * fixed in place regardless of scroll position while `showAnnouncementBar` is on. */
  announcementScrollEffect?: boolean;
  /** Which cart-trigger presentation the cart icon opens — see `CartTriggerVariant`. */
  cartTriggerVariant?: CartTriggerVariant;
  actionSlot?: ReactNode;
};

const DEFAULT_PRIMARY_NAVIGATION: HeaderNavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Shop",
    href: "/shop",
    // Mock deep links so the in-progress templates can be previewed from the nav while
    // they're being built out — remove/expand once real catalog data is wired up.
    children: [
      { label: "Nebula Hoodie (product template preview)", href: "/shop/nebula-hoodie" },
      {
        label: "Categories",
        href: "/shop/category/apparel",
        children: [
          { label: "Apparel", href: "/shop/category/apparel" },
          { label: "Footwear", href: "/shop/category/footwear" },
          { label: "Accessories", href: "/shop/category/accessories" },
        ],
      },
      {
        label: "Tags",
        href: "/shop/tag/layering",
        children: [
          { label: "Layering", href: "/shop/tag/layering" },
          { label: "New season", href: "/shop/tag/new-season" },
          { label: "Unisex", href: "/shop/tag/unisex" },
        ],
      },
    ],
  },
  {
    label: "Blog",
    href: "/blog",
    children: [
      { label: "Behind the design of the Nebula collection (post template preview)", href: "/blog/behind-the-design-of-the-nebula-collection" },
      {
        label: "Categories",
        href: "/blog/category/guides",
        children: [
          { label: "Behind the Scenes", href: "/blog/category/behind-the-scenes" },
          { label: "Guides", href: "/blog/category/guides" },
          { label: "Sustainability", href: "/blog/category/sustainability" },
          { label: "Style", href: "/blog/category/style" },
        ],
      },
      {
        label: "Tags",
        href: "/blog/tag/hoodies",
        children: [
          { label: "Hoodies", href: "/blog/tag/hoodies" },
          { label: "Materials", href: "/blog/tag/materials" },
          { label: "New Arrivals", href: "/blog/tag/new-arrivals" },
        ],
      },
    ],
  },
  { label: "Page template preview", href: "/page/about-us" },
  { label: "Shortcode library", href: "/shortcodes" },
  {
    label: "Community",
    href: "/community",
    children: [
      { label: "All posts feed", href: "/community" },
      { label: "My profile (preview)", href: "/community/jordandoe" },
    ],
  },
  { label: "Cart", href: "/cart" },
  { label: "Checkout", href: "/checkout" },
  { label: "Wishlist", href: "/wishlist" },
  { label: "Reading list", href: "/reading-list" },
  {
    label: "Account",
    href: "/account",
    children: [
      { label: "Dashboard", href: "/account#dashboard" },
      { label: "Orders", href: "/account#orders" },
      { label: "Addresses", href: "/account#addresses" },
      { label: "Community", href: "/account#community" },
    ],
  },
  { label: "Auth", href: "/auth" },
];

export function HeaderMockup({
  announcementHtml = "",
  showAnnouncementBar = true,
  projectName = "Superfunky",
  projectTagline = "Modern storefront mockup",
  logoUrl,
  iconUrl,
  homePath = "/",
  headerIcons,
  headerIconMedia,
  primaryNavigation = DEFAULT_PRIMARY_NAVIGATION,
  mobileNavigation,
  hideNavigation = false,
  showSearch = true,
  searchVariant = "full-width",
  search,
  logoVariant = "text-image",
  showLanguageSwitcher = true,
  showCurrencySwitcher = true,
  showDarkModeToggle = true,
  showAccountLink = true,
  showPushAction = false,
  pushSubscribed = false,
  pushBusy = false,
  onPushToggle,
  showReadingListLink = true,
  showWishlistLink = true,
  showCartIcon = true,
  showLogo = true,
  sticky = true,
  announcementScrollEffect = true,
  cartTriggerVariant = "drawer",
  actionSlot,
}: HeaderMockupProps) {
  const t = useT();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { themeMaxWidthPx } = useLayoutPreferences();
  const { count: wishlistCount, syncError: wishlistSyncError } = useWishlist();
  const { count: readingListCount, syncError: readingListSyncError } = useReadingList();
  const { itemCount: cartBadgeCount, toggleDrawer: toggleCartDrawer } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasMountedMobileMenu, setHasMountedMobileMenu] = useState(false);
  const [isAnnouncementVisible, setIsAnnouncementVisible] = useState(
    () => typeof window === "undefined" || window.scrollY <= 4,
  );
  const safeAnnouncementHtml = sanitizeStorefrontHtml(announcementHtml);
  const isAnnouncementBarShown = showAnnouncementBar && Boolean(safeAnnouncementHtml) && isAnnouncementVisible;
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const openMobileMenu = () => {
    setHasMountedMobileMenu(true);
    setIsMenuOpen(true);
  };
  const resolvedMobileNavigation = hideNavigation
    ? []
    : mobileNavigation?.length
      ? mobileNavigation
      : primaryNavigation;
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // The header is `fixed` (not `sticky`) so it's always pinned regardless of ancestor
  // overflow — `position: sticky` silently stops sticking in some browsers once any
  // ancestor (here, `html`/`body`'s `overflow-x: hidden` safety net for the mobile
  // drawer) becomes a scroll container. Being fixed and out of flow, its rendered
  // height (which changes as the announcement bar collapses) is measured here and fed
  // into a same-height spacer below so page content is never covered nor left with a
  // gap.
  useEffect(() => {
    const node = headerRef.current;
    if (!node) return;

    const updateHeight = () => setHeaderHeight(node.getBoundingClientRect().height);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Close the mobile drawer whenever the route changes, and lock body scroll while it's
  // open. Uses the position:fixed technique (not just overflow:hidden) so the page behind
  // the drawer can't be scrolled on iOS Safari, and restores the exact scroll position on close.
  useEffect(() => setIsMenuOpen(false), [location.pathname]);
  useEffect(() => {
    setIsSearchExpanded(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!showSearch || searchVariant !== "expandable") setIsSearchExpanded(false);
  }, [searchVariant, showSearch]);
  useEffect(() => {
    if (!isMenuOpen) return;

    const scrollY = window.scrollY;
    const { style } = document.body;
    const previous = { position: style.position, top: style.top, left: style.left, right: style.right, width: style.width };

    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.left = "0";
    style.right = "0";
    style.width = "100%";

    return () => {
      style.position = previous.position;
      style.top = previous.top;
      style.left = previous.left;
      style.right = previous.right;
      style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, [isMenuOpen]);

  // Collapse the announcement bar once the user scrolls away from the very top, and only
  // bring it back once they scroll back up to the top again. Deliberately does NOT reveal
  // it on every scroll-up mid-page — otherwise it would keep popping back over the sticky
  // header whenever the user scrolls up even slightly, which is the bug this guards against.
  // Skipped entirely when `announcementScrollEffect` is off — the bar then just stays put.
  useEffect(() => {
    if (!announcementScrollEffect) {
      setIsAnnouncementVisible(true);
      return;
    }

    function handleScroll() {
      setIsAnnouncementVisible(window.scrollY <= 4);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [announcementScrollEffect]);

  const [isCartDropdownOpen, setIsCartDropdownOpen] = useState(false);
  const handleCartTriggerClick = () => {
    if (cartTriggerVariant === "dropdown") {
      setIsCartDropdownOpen((current) => !current);
      return;
    }
    toggleCartDrawer();
  };

  return (
    <>
      <header
        ref={headerRef}
        id="sf-header"
        className={`sf-header funky-header ${sticky ? "fixed inset-x-0 top-0" : "relative"} z-40 border-b border-zinc-200/70 bg-white/80 text-zinc-900 backdrop-blur-lg backdrop-saturate-150 dark:border-zinc-800/70 dark:bg-zinc-950/80 dark:text-zinc-100`}
      >
        <div
          className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isAnnouncementBarShown ? "max-h-10" : "max-h-0"}`}
        >
          <div
            className={`bg-brand-950 px-4 py-2 text-center text-[0.72rem] font-medium tracking-wide text-zinc-50 transition-transform duration-300 ease-in-out ${
              isAnnouncementBarShown ? "translate-y-0" : "-translate-y-full"
            }`}
          >
            <SafeHtmlContent
              html={safeAnnouncementHtml}
              className="[&_a]:font-semibold [&_a]:text-inherit [&_a]:underline [&_ol]:m-0 [&_p]:m-0 [&_ul]:m-0"
            />
          </div>
        </div>

      <div className="mx-auto grid w-full gap-3 px-4 py-4 sm:px-6 lg:px-8" style={{ maxWidth: `${themeMaxWidthPx}px` }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          {showLogo ? (
            <Link to={homePath} className="group inline-flex items-center gap-2.5 text-inherit no-underline">
              {logoVariant !== "text" ? (
                logoUrl ? (
                  <ResponsiveImage src={logoUrl} alt={projectName} priority sizes="12rem" className="h-10 w-auto max-w-48 object-contain" />
                ) : (
                  <span className="inline-grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-brand-gradient text-white shadow-glow transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
                    {iconUrl ? <ResponsiveImage src={iconUrl} alt="" priority sizes="2.5rem" className="h-full w-full object-cover" /> : <Sparkles className="h-5 w-5" aria-hidden="true" />}
                  </span>
                )
              ) : null}
              {logoVariant !== "image" ? (
                <span className="grid gap-0.5">
                  <strong className="funky-brand-heading font-display text-xl font-bold tracking-tight sm:text-2xl">{projectName}</strong>
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{projectTagline}</span>
                </span>
              ) : null}
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}

          {showSearch && searchVariant !== "expandable" ? (
            <SearchAutocomplete search={search} className="hidden min-w-[220px] flex-1 basis-80 lg:block" />
          ) : null}

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {showSearch && searchVariant === "expandable" ? (
              <div className="hidden items-center gap-1 lg:flex">
                <div
                  inert={isSearchExpanded ? undefined : true}
                  className={`transition-[width,opacity] duration-300 ease-in-out ${
                    isSearchExpanded ? "w-72 overflow-visible opacity-100" : "w-0 overflow-hidden opacity-0"
                  }`}
                >
                  <SearchAutocomplete search={search} autoFocus={isSearchExpanded} className="w-72" />
                </div>
                <button
                  type="button"
                  onClick={() => setIsSearchExpanded((value) => !value)}
                  aria-label={t(isSearchExpanded ? "search.close" : "search.open")}
                  aria-expanded={isSearchExpanded}
                  className={iconButtonClass}
                >
                  <span className="grid transition-transform duration-300">
                    {isSearchExpanded ? <X className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" /> : <HeaderActionIcon name={headerIcons?.search} mediaUrl={headerIconMedia?.search} fallback={Search} />}
                  </span>
                </button>
              </div>
            ) : null}

            {showLanguageSwitcher ? <LanguageSwitcher className="hidden sm:block" /> : null}

            {showCurrencySwitcher ? <CurrencySwitcher className="hidden sm:block" /> : null}

            {actionSlot}

            <div className="mx-1 hidden h-6 w-px bg-zinc-200 dark:bg-zinc-800 lg:block" aria-hidden="true" />

            {showDarkModeToggle ? (
              <button
                type="button"
                data-storefront-control="theme"
                className={iconButtonClass}
                onClick={toggleDarkMode}
                aria-label={t("header.theme.toggle")}
                title={t(isDarkMode ? "header.theme.light" : "header.theme.dark")}
              >
                <span className="grid transition-transform duration-500 motion-safe:hover:rotate-12">
                  <HeaderActionIcon name={headerIcons?.theme} mediaUrl={headerIconMedia?.theme} fallback={isDarkMode ? Sun : Moon} />
                </span>
              </button>
            ) : null}

            {showPushAction && onPushToggle ? (
              <button
                type="button"
                data-storefront-control="push"
                onClick={onPushToggle}
                disabled={pushBusy}
                className={`${iconButtonClass} focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-wait disabled:opacity-60 ${
                  pushSubscribed
                    ? "border-brand-300 text-brand-600 dark:border-brand-700 dark:text-brand-300"
                    : ""
                }`}
                aria-label={t(pushSubscribed ? "header.push.disable" : "header.push.enable")}
                aria-pressed={pushSubscribed}
                title={t(pushSubscribed ? "header.push.enabled" : "header.push.enable")}
              >
                <HeaderActionIcon
                  name={pushSubscribed ? "bell-ring" : headerIcons?.push}
                  mediaUrl={pushSubscribed ? null : headerIconMedia?.push}
                  fallback={pushSubscribed ? BellRing : Bell}
                />
              </button>
            ) : null}

            {showAccountLink ? (
              <Link to="/account" data-storefront-control="account" aria-label={t("header.account")} title={t("header.account")} className={`${iconButtonClass} hidden lg:inline-grid`}>
                <HeaderActionIcon name={headerIcons?.account} mediaUrl={headerIconMedia?.account} fallback={User} />
              </Link>
            ) : null}
            {showReadingListLink ? (
              <Link
                to="/reading-list"
                data-storefront-control="reading-list"
                aria-label={readingListSyncError
                  ? t("header.sync_error", { label: t("header.reading_list") })
                  : t("header.reading_list")}
                title={readingListSyncError
                  ? t("header.sync_error_detail", { label: t("header.reading_list"), message: readingListSyncError })
                  : t("header.reading_list")}
                className={`${iconButtonClass} relative hidden lg:inline-grid`}
              >
                <HeaderActionIcon name={headerIcons?.readingList} mediaUrl={headerIconMedia?.readingList} fallback={BookMarked} />
                {readingListCount > 0 ? <BadgeCount count={readingListCount} /> : null}
                {readingListSyncError ? <SyncErrorDot /> : null}
              </Link>
            ) : null}
            {showWishlistLink ? (
              <Link
                to="/wishlist"
                data-storefront-control="wishlist"
                aria-label={wishlistSyncError
                  ? t("header.sync_error", { label: t("header.wishlist") })
                  : t("header.wishlist")}
                title={wishlistSyncError
                  ? t("header.sync_error_detail", { label: t("header.wishlist"), message: wishlistSyncError })
                  : t("header.wishlist")}
                className={`${iconButtonClass} relative hidden lg:inline-grid`}
              >
                <HeaderActionIcon name={headerIcons?.wishlist} mediaUrl={headerIconMedia?.wishlist} fallback={Heart} />
                {wishlistCount > 0 ? <BadgeCount count={wishlistCount} /> : null}
                {wishlistSyncError ? <SyncErrorDot /> : null}
              </Link>
            ) : null}
            {showCartIcon ? (
              <div className="relative">
                <button
                  type="button"
                  data-storefront-control="cart"
                  onClick={handleCartTriggerClick}
                  aria-label={t("header.cart")}
                  title={t("header.cart")}
                  className={`${iconButtonClass} relative`}
                >
                  <HeaderActionIcon name={headerIcons?.cart} mediaUrl={headerIconMedia?.cart} fallback={ShoppingCart} />
                  {cartBadgeCount > 0 ? <BadgeCount count={cartBadgeCount} /> : null}
                </button>
                {cartTriggerVariant === "dropdown" ? (
                  <CartDropdown isOpen={isCartDropdownOpen} onClose={() => setIsCartDropdownOpen(false)} />
                ) : null}
              </div>
            ) : null}

            {!hideNavigation ? (
              <button
              type="button"
              data-storefront-control="menu"
              className={`${iconButtonClass} lg:hidden`}
              onClick={openMobileMenu}
              aria-label={t("header.menu.open")}
              aria-expanded={isMenuOpen}
              aria-controls={hasMountedMobileMenu ? "storefront-mobile-menu" : undefined}
            >
              <HeaderActionIcon name={headerIcons?.menu} mediaUrl={headerIconMedia?.menu} fallback={Menu} />
              </button>
            ) : null}
          </div>
        </div>

        {!hideNavigation ? <div className="hidden border-t border-zinc-100 pt-2.5 dark:border-zinc-800/70 lg:block">
          {/* `flex-wrap` (not `overflow-x-auto`) on purpose: per the CSS spec, setting only
              `overflow-x` to a non-visible value forces the browser to compute `overflow-y`
              as `auto` too — which was silently clipping/scroll-cutting the "Shop" dropdown
              panel below. Wrapping avoids the clip entirely instead of working around it. */}
          {/* `-ml-3.5` cancels the first nav link's own `px-3.5` pill padding (see
              `navLinkClass`) so its label text sits flush with the row's left edge —
              i.e. the same column as the logo above and the theme's max-width edge —
              instead of appearing indented by the pill's hit-area padding. */}
          <nav aria-label={t("header.navigation.main")} className="-ml-3.5 flex flex-wrap items-center gap-x-1 gap-y-1.5">
            {primaryNavigation.map((item) =>
              item.children?.length ? (
                <NavDropdownItem key={menuItemKey(item)} item={item} />
              ) : (
                <NavLink
                  key={menuItemKey(item)}
                  to={item.href}
                  end={item.href === "/"}
                  reloadDocument={isExternalHref(item.href)}
                  title={item.title}
                  target={item.target}
                  rel={menuItemRel(item)}
                  className={(state) => joinMenuClasses(navLinkClass(state), item)}
                >
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>
        </div> : null}
      </div>
      </header>

      {/* Spacer: kept in sync with the (fixed, out-of-flow) header's live height above,
          including as the announcement bar collapses, so page content is never covered
          nor left with a gap. Not needed when `sticky` is off — the header is already
          in normal document flow at that point. */}
      {sticky ? (
        <div style={{ height: headerHeight }} className="shrink-0" aria-hidden="true" />
      ) : null}

      {hasMountedMobileMenu && !hideNavigation ? (
        <MobileDrawer
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          primaryNavigation={resolvedMobileNavigation}
          wishlistCount={wishlistCount}
          wishlistSyncError={wishlistSyncError}
          readingListCount={readingListCount}
          readingListSyncError={readingListSyncError}
          cartBadgeCount={cartBadgeCount}
          onCartClick={handleCartTriggerClick}
          search={search}
          headerIcons={headerIcons}
          headerIconMedia={headerIconMedia}
          showSearch={showSearch}
          showLanguageSwitcher={showLanguageSwitcher}
          showCurrencySwitcher={showCurrencySwitcher}
          showAccountLink={showAccountLink}
          showReadingListLink={showReadingListLink}
          showWishlistLink={showWishlistLink}
          showCartIcon={showCartIcon}
        />
      ) : null}
    </>
  );
}

function MobileDrawer({
  isOpen,
  onClose,
  primaryNavigation,
  wishlistCount,
  wishlistSyncError,
  readingListCount,
  readingListSyncError,
  cartBadgeCount,
  onCartClick,
  search,
  headerIcons,
  headerIconMedia,
  showSearch,
  showLanguageSwitcher,
  showCurrencySwitcher,
  showAccountLink,
  showReadingListLink,
  showWishlistLink,
  showCartIcon,
}: {
  isOpen: boolean;
  onClose: () => void;
  primaryNavigation: HeaderNavItem[];
  wishlistCount: number;
  wishlistSyncError?: string | null;
  readingListCount: number;
  readingListSyncError?: string | null;
  cartBadgeCount: number;
  onCartClick: () => void;
  search?: SearchAutocompleteProps["search"];
  headerIcons?: Partial<HeaderIconConfiguration>;
  headerIconMedia?: HeaderIconMediaConfiguration;
  showSearch: boolean;
  showLanguageSwitcher: boolean;
  showCurrencySwitcher: boolean;
  showAccountLink: boolean;
  showReadingListLink: boolean;
  showWishlistLink: boolean;
  showCartIcon: boolean;
}) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return undefined;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || [])].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);
  // Rendered via a portal directly into <body>: the header uses `backdrop-blur`, which
  // (like `filter`/`will-change: transform`) establishes a new containing block for any
  // `position: fixed` descendant. Left in place, the drawer's `fixed inset-y-0` would be
  // sized against the header's own (short) box instead of the viewport — the cause of
  // the "wrong height" bug. Escaping to `document.body` guarantees it's always
  // viewport-relative regardless of header/ancestor styling.
  return createPortal(
    <div className={`fixed inset-0 z-50 lg:hidden ${isOpen ? "visible" : "invisible"}`} aria-hidden={!isOpen}>
      <div
        className={`fixed inset-0 bg-zinc-950/50 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        id="storefront-mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label={t("header.menu.site")}
        inert={isOpen ? undefined : true}
        className={`fixed inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-white shadow-soft-lg transition-transform duration-300 ease-out dark:bg-zinc-950 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between p-6 pb-4">
          <span className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">{t("header.menu.title")}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("header.menu.close")}
            className="inline-grid h-9 w-9 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="scrollbar-thin grid min-h-0 flex-1 content-start gap-6 overflow-y-auto px-6 pb-6 pt-1">
          {showSearch ? <SearchAutocomplete search={search} fullWidth onNavigate={onClose} /> : null}

          {/* Moved here (from a fixed footer strip) so the dropdown panel has room to
              open downward inside this scrollable area — anchored at the very bottom of
              the drawer, it had nowhere to expand into and was effectively unreachable. */}
          <div className="flex gap-2">
            {showLanguageSwitcher ? <LanguageSwitcher fullWidth /> : null}
            {showCurrencySwitcher ? <CurrencySwitcher fullWidth /> : null}
          </div>

          <nav aria-label={t("header.navigation.mobile")} className="grid gap-1">
            {primaryNavigation.map((item) => (
              <MobileNavItem key={menuItemKey(item)} item={item} />
            ))}
          </nav>

          {showAccountLink || showReadingListLink || showWishlistLink || showCartIcon ? (
            <div className="grid gap-1 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              {showAccountLink ? (
                <Link to="/account" className={mobileActionLinkClass}>
                  <HeaderActionIcon name={headerIcons?.account} mediaUrl={headerIconMedia?.account} fallback={User} /> {t("header.account")}
                </Link>
              ) : null}
              {showReadingListLink ? (
                <Link to="/reading-list" className={mobileActionLinkClass}>
                  <HeaderActionIcon name={headerIcons?.readingList} mediaUrl={headerIconMedia?.readingList} fallback={BookMarked} /> {t("header.reading_list")}
                  {readingListCount > 0 ? <span className="ml-auto text-xs font-semibold text-brand-600 dark:text-brand-400">{readingListCount}</span> : null}
                  {readingListSyncError ? <span className="ml-auto h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" title={readingListSyncError} /> : null}
                </Link>
              ) : null}
              {showWishlistLink ? (
                <Link to="/wishlist" className={mobileActionLinkClass}>
                  <HeaderActionIcon name={headerIcons?.wishlist} mediaUrl={headerIconMedia?.wishlist} fallback={Heart} /> {t("header.wishlist")}
                  {wishlistCount > 0 ? <span className="ml-auto text-xs font-semibold text-brand-600 dark:text-brand-400">{wishlistCount}</span> : null}
                  {wishlistSyncError ? <span className="ml-auto h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" title={wishlistSyncError} /> : null}
                </Link>
              ) : null}
              {showCartIcon ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCartClick();
                  }}
                  className={`${mobileActionLinkClass} w-full text-left`}
                >
                  <HeaderActionIcon name={headerIcons?.cart} mediaUrl={headerIconMedia?.cart} fallback={ShoppingCart} /> {t("header.cart")}
                  {cartBadgeCount > 0 ? <span className="ml-auto text-xs font-semibold text-brand-600 dark:text-brand-400">{cartBadgeCount}</span> : null}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Recursive mobile-nav row: renders a link plus, when the item has children, a chevron
 * toggle that expands an indented sub-list — mirrors the legacy prototype's
 * `NestedList` (`menu-header.js`, supports arbitrary nesting depth) but with a smoother
 * CSS grid-rows height transition instead of a fixed `max-h-96` cap, and no artificial
 * nesting-depth limit. Every sub-list starts collapsed unless its parent has the
 * WordPress menu-item CSS class `expanded`. */
function MobileNavItem({ item, depth = 0 }: { item: HeaderNavItem; depth?: number }) {
  const t = useT();
  const initiallyExpanded = isMenuInitiallyExpanded(item.cssClasses);
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [hasMountedChildren, setHasMountedChildren] = useState(initiallyExpanded);
  const hasChildren = Boolean(item.children?.length);
  const toggleExpanded = () => {
    if (!isExpanded) setHasMountedChildren(true);
    setIsExpanded((previous) => !previous);
  };

  return (
    <div>
      <div className="flex items-start">
        <div className="min-w-0 flex-1">
          <NavLink
            to={item.href}
            end={item.href === "/"}
            reloadDocument={isExternalHref(item.href)}
            title={item.title}
            target={item.target}
            rel={menuItemRel(item)}
            className={({ isActive }) => joinMenuClasses(`${mobileNavLinkClass({ isActive })} block`, item)}
          >
            <span>{item.label}</span>
          </NavLink>
          <MenuDescription
            html={item.description}
            className="-mt-1 px-3.5 pb-1 text-xs font-normal text-zinc-400 dark:text-zinc-500"
          />
        </div>
        {hasChildren ? (
          <button
            type="button"
            onClick={toggleExpanded}
            aria-label={t(isExpanded ? "footer.nav.collapse" : "footer.nav.expand", { label: item.label })}
            aria-expanded={isExpanded}
            className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {hasChildren && hasMountedChildren ? (
        <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden" aria-hidden={!isExpanded}>
            <div className={`mt-1 grid gap-1 border-l border-zinc-200 pl-3 dark:border-zinc-800 ${depth === 0 ? "ml-3" : "ml-2"}`}>
              {item.children?.map((child) => (
                <MobileNavItem key={menuItemKey(child)} item={child} depth={depth + 1} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BadgeCount({ count }: { count: number }) {
  return (
    <span className="absolute -right-1 -top-1 inline-grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-brand-gradient px-1 text-[0.625rem] font-bold leading-none text-white shadow-sm">
      {count}
    </span>
  );
}

/** Small warning dot for a saved list (wishlist/reading list) whose most recent
 * toggle/clear/merge with the backend failed and was rolled back — surfaces
 * `syncError` from the shared `createPersistedIdCollection` abstraction without a
 * disruptive banner, since the optimistic local UI already reverted. */
function SyncErrorDot() {
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 inline-block h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-900"
      aria-hidden="true"
    />
  );
}

/** Desktop-only dropdown for nav items with `children` (currently just "Shop", to preview
 * the in-progress product template). Mirrors the legacy Gatsby prototype's `DesktopMenu`
 * hover-to-reveal interaction (`menu-header.js`), with click/keyboard support layered on
 * top for touch and accessibility. The panel is rendered through a portal and positioned
 * from the trigger's own bounding box (like `MobileDrawer`) so it's never clipped by an
 * ancestor's overflow/stacking context — the actual cause of the old dropdown not showing
 * reliably. */
function NavDropdownItem({ item }: { item: HeaderNavItem }) {
  const initiallyExpanded = isMenuInitiallyExpanded(item.cssClasses);
  const [isOpen, setIsOpen] = useState(initiallyExpanded);
  const [position, setPosition] = useState<{ top: number; left: number; width?: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimeoutRef = useRef<number | undefined>(undefined);
  const openedByClickRef = useRef(false);
  const location = useLocation();
  const isActive = navItemMatchesPath(item, location.pathname);
  const megaMenu = getMegaMenuConfiguration(item.cssClasses, item.children?.length || 0);

  const updatePosition = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const top = rect.bottom + 8;
    if (!megaMenu) {
      const viewportPadding = 16;
      const width = Math.min(288, window.innerWidth - viewportPadding * 2);
      const left = Math.max(
        viewportPadding,
        Math.min(rect.left, window.innerWidth - width - viewportPadding),
      );
      setPosition({ top, left, width });
      return;
    }

    const viewportPadding = 16;
    const width = Math.min(
      window.innerWidth - viewportPadding * 2,
      Math.max(320, megaMenu.columns * 208),
    );
    const left = Math.max(
      viewportPadding,
      Math.min(rect.left, window.innerWidth - width - viewportPadding),
    );
    setPosition({ top, left, width });
  };

  const openMenu = () => {
    window.clearTimeout(closeTimeoutRef.current);
    updatePosition();
    setIsOpen(true);
  };

  // Small close delay so the pointer can travel from the trigger down into the panel
  // (matching the legacy `group`/`mouseleave` hover behaviour) without it snapping shut.
  const scheduleClose = () => {
    window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = window.setTimeout(() => {
      openedByClickRef.current = false;
      setIsOpen(false);
    }, 150);
  };
  const toggleMenu = () => {
    if (isOpen && openedByClickRef.current) {
      openedByClickRef.current = false;
      setIsOpen(false);
      return;
    }
    openMenu();
    openedByClickRef.current = true;
  };
  const focusPanelItem = (last = false) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const items = [...(panelRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"], button:not([disabled])',
      ) || [])];
      const target = last ? items[items.length - 1] : items[0];
      target?.focus();
    }));
  };
  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    openedByClickRef.current = true;
    openMenu();
    focusPanelItem(event.key === "ArrowUp");
  };
  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      openedByClickRef.current = false;
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>(
      '[role="menuitem"], button:not([disabled])',
    ) || [])];
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? Math.min(items.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);
    if (!items[nextIndex]) return;
    event.preventDefault();
    items[nextIndex].focus();
  };

  useEffect(() => {
    openedByClickRef.current = false;
    setIsOpen(initiallyExpanded);
  }, [initiallyExpanded, location.pathname]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      openedByClickRef.current = false;
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        openedByClickRef.current = false;
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  useEffect(() => () => window.clearTimeout(closeTimeoutRef.current), []);

  return (
    <div ref={containerRef} className="relative" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
      <div className="flex items-center">
        <NavLink
          to={item.href}
          end
          reloadDocument={isExternalHref(item.href)}
          title={item.title}
          target={item.target}
          rel={menuItemRel(item)}
          className={(state) => joinMenuClasses(navLinkClass(state), item)}
        >
          {item.label}
        </NavLink>
        <button
          ref={triggerRef}
          type="button"
          onClick={toggleMenu}
          onKeyDown={handleTriggerKeyDown}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label={`Show ${item.label} links`}
          className={`-ml-1.5 inline-grid h-6 w-6 place-items-center rounded-full transition ${
            isActive ? "text-brand-600 dark:text-brand-400" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          }`}
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {isOpen && position
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              onKeyDown={handlePanelKeyDown}
              onMouseEnter={openMenu}
              onMouseLeave={scheduleClose}
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: `calc(100vh - ${position.top + 16}px)`,
              }}
              className={`fixed z-50 origin-top-left rounded-xl border border-zinc-100 bg-white shadow-xl transition-all duration-150 dark:border-zinc-800 dark:bg-zinc-900 ${
                megaMenu ? "overflow-auto p-5" : "grid w-72 gap-1 overflow-y-auto p-2"
              }`}
            >
              {megaMenu ? (
                <div
                  className="grid gap-6"
                  style={{
                    gridTemplateColumns: `repeat(${megaMenu.columns}, minmax(11rem, 1fr))`,
                    minWidth: `${megaMenu.columns * 11}rem`,
                  }}
                >
                  {item.children?.map((child) => (
                    <MegaMenuColumn key={menuItemKey(child)} item={child} />
                  ))}
                </div>
              ) : (
                item.children?.map((child) => (
                  <NavDropdownPanelItem key={menuItemKey(child)} item={child} />
                ))
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function MegaMenuColumn({ item }: { item: HeaderNavItem }) {
  return (
    <div className="min-w-0">
      <NavLink
        role="menuitem"
        to={item.href}
        end={item.href === "/"}
        reloadDocument={isExternalHref(item.href)}
        title={item.title}
        target={item.target}
        rel={menuItemRel(item)}
        className={({ isActive }) =>
          joinMenuClasses(`grid gap-1 text-sm font-semibold no-underline transition ${
            isActive
              ? "text-brand-600 dark:text-brand-400"
              : "text-zinc-800 hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400"
          }`, item)
        }
      >
        <span>{item.label}</span>
      </NavLink>
      <MenuDescription
        html={item.description}
        className="mt-1 text-xs font-normal leading-snug text-zinc-500 dark:text-zinc-400"
      />
      {item.children?.length ? (
        <div className="mt-3 grid gap-1 border-l border-zinc-200 pl-2 dark:border-zinc-800">
          {item.children.map((child) => (
            <NavDropdownPanelItem key={menuItemKey(child)} item={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A single entry inside a desktop dropdown panel. Renders as a plain link, or — when
 * it has its own `children` — as an inline expandable group (arrow toggle, like the
 * nested footer-menu columns) rather than a further flyout, keeping deep nesting simple
 * to reach with a mouse without chaining hover-timers across multiple panels. */
function NavDropdownPanelItem({ item }: { item: HeaderNavItem }) {
  const t = useT();
  const [isExpanded, setIsExpanded] = useState(
    () => isMenuInitiallyExpanded(item.cssClasses),
  );
  const hasChildren = Boolean(item.children?.length);

  if (!hasChildren) {
    return (
      <div className="min-w-0">
        <NavLink
          role="menuitem"
          to={item.href}
          end={item.href === "/"}
          reloadDocument={isExternalHref(item.href)}
          title={item.title}
          target={item.target}
          rel={menuItemRel(item)}
          className={({ isActive }) =>
            joinMenuClasses(`block rounded-lg px-3 py-2 text-sm font-medium no-underline transition ${
              isActive
                ? "font-semibold text-brand-600 dark:text-brand-400"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
            }`, item)
          }
        >
          <span>{item.label}</span>
        </NavLink>
        <MenuDescription
          html={item.description}
          className="mt-0.5 max-w-full break-words px-3 pb-2 text-xs font-normal leading-snug text-zinc-400 [overflow-wrap:anywhere] dark:text-zinc-500"
        />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center">
        <NavLink
          role="menuitem"
          to={item.href}
          end={item.href === "/"}
          reloadDocument={isExternalHref(item.href)}
          title={item.title}
          target={item.target}
          rel={menuItemRel(item)}
          className={({ isActive }) =>
            joinMenuClasses(`flex-1 rounded-lg px-3 py-2 text-sm font-medium no-underline transition ${
              isActive
                ? "font-semibold text-brand-600 dark:text-brand-400"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
            }`, item)
          }
        >
          <span>{item.label}</span>
        </NavLink>
        <button
          type="button"
          onClick={() => setIsExpanded((previous) => !previous)}
          aria-label={t(isExpanded ? "footer.nav.collapse" : "footer.nav.expand", { label: item.label })}
          aria-expanded={isExpanded}
          className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>
      <MenuDescription
        html={item.description}
        className="mt-0.5 max-w-full break-words px-3 pb-2 text-xs font-normal leading-snug text-zinc-400 [overflow-wrap:anywhere] dark:text-zinc-500"
      />

      <div className={`grid transition-all duration-200 ease-in-out ${isExpanded ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden" aria-hidden={!isExpanded}>
          <div className="ml-2 mt-2 grid gap-1 border-l border-zinc-200 pl-2 dark:border-zinc-800">
            {item.children?.map((child) => (
              <NavDropdownPanelItem key={menuItemKey(child)} item={child} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function menuItemKey(item: HeaderNavItem): string {
  return item.id || `${item.label}:${item.href}`;
}

function isExternalHref(href: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href);
}

function joinMenuClasses(baseClassName: string, item: HeaderNavItem): string {
  return [baseClassName, ...(item.cssClasses || [])].filter(Boolean).join(" ");
}

function menuItemRel(item: HeaderNavItem): string | undefined {
  const relationships = new Set(item.linkRelationship?.split(/\s+/).filter(Boolean) || []);
  if (item.target === "_blank") {
    relationships.add("noopener");
    relationships.add("noreferrer");
  }
  return relationships.size ? [...relationships].join(" ") : undefined;
}

const iconButtonClass =
  "inline-grid h-10 w-10 place-items-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 no-underline shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-600 hover:shadow-soft-lg active:translate-y-0 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-brand-500 dark:hover:text-brand-300";

export const headerIconButtonClassName = iconButtonClass;
const loadedHeaderIconUrls = new Set<string>();

const HEADER_ACTION_ICONS: Record<string, LucideIcon> = {
  bell: Bell,
  "bell-ring": BellRing,
  "align-justify": AlignJustify,
  "book-marked": BookMarked,
  bookmark: Bookmark,
  "circle-user": CircleUser,
  command: Command,
  contrast: Contrast,
  gift: Gift,
  heart: Heart,
  library: Library,
  menu: Menu,
  "message-circle": MessageCircle,
  moon: Moon,
  "panels-top-left": PanelsTopLeft,
  "scan-search": ScanSearch,
  search: Search,
  "shopping-bag": ShoppingBag,
  "shopping-basket": ShoppingBasket,
  "shopping-cart": ShoppingCart,
  star: Star,
  "sun-moon": SunMoon,
  user: User,
  "user-check": UserCheck,
};

function HeaderActionIcon({ name, mediaUrl, fallback: Fallback }: { name?: string; mediaUrl?: string | null; fallback: LucideIcon }) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const [mediaReady, setMediaReady] = useState(() => Boolean(mediaUrl && loadedHeaderIconUrls.has(mediaUrl)));
  useEffect(() => {
    setMediaFailed(false);
    setMediaReady(Boolean(mediaUrl && loadedHeaderIconUrls.has(mediaUrl)));
  }, [mediaUrl]);
  const Icon = resolveHeaderActionIcon(name, Fallback);
  if (mediaUrl) {
    return (
      <span className="relative grid h-[18px] w-[18px] place-items-center">
        <Icon
          className={`h-[18px] w-[18px] transition-opacity duration-150 ${
            mediaReady && !mediaFailed ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden="true"
        />
        {!mediaFailed ? (
          <img
            src={mediaUrl}
            alt=""
            aria-hidden="true"
            decoding="async"
            fetchPriority="high"
            height={18}
            width={18}
            className={`absolute h-[18px] w-[18px] object-contain transition-opacity duration-150 ${
              mediaReady ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => {
              loadedHeaderIconUrls.add(mediaUrl);
              setMediaReady(true);
            }}
            onError={() => setMediaFailed(true)}
          />
        ) : null}
      </span>
    );
  }
  return <Icon className="h-[18px] w-[18px]" aria-hidden="true" />;
}

export function resolveHeaderActionIcon(name: string | undefined, fallback: LucideIcon): LucideIcon {
  return (name && HEADER_ACTION_ICONS[name]) || fallback;
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return [
    "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium no-underline transition",
    isActive
      ? "font-semibold text-brand-600 dark:text-brand-400"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100",
  ].join(" ");
}

function mobileNavLinkClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-xl px-3.5 py-2.5 text-sm font-medium no-underline transition-colors duration-200",
    isActive
      ? "font-semibold text-brand-600 dark:text-brand-400"
      : "text-zinc-600 hover:bg-brand-50 hover:text-brand-700 dark:text-zinc-300 dark:hover:bg-brand-500/10 dark:hover:text-brand-300",
  ].join(" ");
}

const mobileActionLinkClass =
  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-zinc-700 no-underline transition-colors duration-200 hover:bg-brand-50 hover:text-brand-700 dark:text-zinc-200 dark:hover:bg-brand-500/10 dark:hover:text-brand-300";
