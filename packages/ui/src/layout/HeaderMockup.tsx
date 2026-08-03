import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlignJustify,
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
import { CurrencySwitcher, LanguageSwitcher } from "../locale";
import { useLayoutPreferences, useReadingList, useCart, useTheme, useWishlist } from "../state";
import { CartDropdown } from "./CartDropdown";
import { SearchAutocomplete, type SearchAutocompleteProps } from "./SearchAutocomplete";
import { ResponsiveImage } from "../media";

export type HeaderNavItem = {
  id?: string;
  label: string;
  href: string;
  title?: string;
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
  readingList: string;
  wishlist: string;
  cart: string;
  menu: string;
};

export type HeaderMockupProps = {
  announcementText?: string;
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
  primaryNavigation?: HeaderNavItem[];
  mobileNavigation?: HeaderNavItem[];
  showSearch?: boolean;
  searchVariant?: HeaderSearchVariant;
  search?: SearchAutocompleteProps["search"];
  /** Which parts of the header brand mark render — mirrors `FooterLogoVariant`. */
  logoVariant?: HeaderLogoVariant;
  showLanguageSwitcher?: boolean;
  showCurrencySwitcher?: boolean;
  showDarkModeToggle?: boolean;
  showAccountLink?: boolean;
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
  { label: "Layout studio", href: "/layout-studio" },
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
  announcementText = "Free shipping over €60 · Dispatch in 24h · 30-day returns",
  showAnnouncementBar = true,
  projectName = "FunkyCommerce",
  projectTagline = "Modern storefront mockup",
  logoUrl,
  iconUrl,
  homePath = "/",
  headerIcons,
  primaryNavigation = DEFAULT_PRIMARY_NAVIGATION,
  mobileNavigation,
  showSearch = true,
  searchVariant = "full-width",
  search,
  logoVariant = "text-image",
  showLanguageSwitcher = true,
  showCurrencySwitcher = true,
  showDarkModeToggle = true,
  showAccountLink = true,
  showReadingListLink = true,
  showWishlistLink = true,
  showCartIcon = true,
  showLogo = true,
  sticky = true,
  announcementScrollEffect = true,
  cartTriggerVariant = "drawer",
}: HeaderMockupProps) {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { themeMaxWidthPx } = useLayoutPreferences();
  const { count: wishlistCount } = useWishlist();
  const { count: readingListCount } = useReadingList();
  const { itemCount: cartBadgeCount, toggleDrawer: toggleCartDrawer } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAnnouncementVisible, setIsAnnouncementVisible] = useState(true);
  const isAnnouncementBarShown = showAnnouncementBar && isAnnouncementVisible;
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const resolvedMobileNavigation = mobileNavigation?.length ? mobileNavigation : primaryNavigation;
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
        className={`funky-header ${sticky ? "fixed inset-x-0 top-0" : "relative"} z-40 border-b border-zinc-200/70 bg-white/80 text-zinc-900 backdrop-blur-lg backdrop-saturate-150 dark:border-zinc-800/70 dark:bg-zinc-950/80 dark:text-zinc-100`}
      >
        <div
          className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isAnnouncementBarShown ? "max-h-10" : "max-h-0"}`}
        >
          <div
            className={`bg-zinc-900 px-4 py-2 text-center text-[0.72rem] font-medium tracking-wide text-zinc-50 transition-transform duration-300 ease-in-out dark:bg-brand-950 ${
              isAnnouncementBarShown ? "translate-y-0" : "-translate-y-full"
            }`}
          >
            {announcementText}
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

          <div className="flex flex-wrap items-center gap-2">
            {showSearch && searchVariant === "expandable" ? (
              <div className="hidden items-center gap-1 lg:flex">
                <div
                  className={`overflow-hidden transition-[width,opacity] duration-300 ease-in-out ${
                    isSearchExpanded ? "w-72 opacity-100" : "w-0 opacity-0"
                  }`}
                >
                  <SearchAutocomplete search={search} className="w-72" />
                </div>
                <button
                  type="button"
                  onClick={() => setIsSearchExpanded((value) => !value)}
                  aria-label={isSearchExpanded ? "Close search" : "Open search"}
                  aria-expanded={isSearchExpanded}
                  className={iconButtonClass}
                >
                  <span className="grid transition-transform duration-300">
                    {isSearchExpanded ? <X className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" /> : <HeaderActionIcon name={headerIcons?.search} fallback={Search} />}
                  </span>
                </button>
              </div>
            ) : null}

            {showLanguageSwitcher ? <LanguageSwitcher className="hidden sm:block" /> : null}

            {showCurrencySwitcher ? <CurrencySwitcher className="hidden sm:block" /> : null}

            <div className="mx-1 hidden h-6 w-px bg-zinc-200 dark:bg-zinc-800 lg:block" aria-hidden="true" />

            {showDarkModeToggle ? (
              <button
                type="button"
                className={iconButtonClass}
                onClick={toggleDarkMode}
                aria-label="Toggle dark mode"
                title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                <span className="grid transition-transform duration-500 motion-safe:hover:rotate-12">
                  <HeaderActionIcon name={headerIcons?.theme} fallback={isDarkMode ? Sun : Moon} />
                </span>
              </button>
            ) : null}

            {showAccountLink ? (
              <Link to="/account" aria-label="Account" title="Account" className={`${iconButtonClass} hidden lg:inline-grid`}>
                <HeaderActionIcon name={headerIcons?.account} fallback={User} />
              </Link>
            ) : null}
            {showReadingListLink ? (
              <Link to="/reading-list" aria-label="Reading list" title="Reading list" className={`${iconButtonClass} relative hidden lg:inline-grid`}>
                <HeaderActionIcon name={headerIcons?.readingList} fallback={BookMarked} />
                {readingListCount > 0 ? <BadgeCount count={readingListCount} /> : null}
              </Link>
            ) : null}
            {showWishlistLink ? (
              <Link to="/wishlist" aria-label="Wishlist" title="Wishlist" className={`${iconButtonClass} relative hidden lg:inline-grid`}>
                <HeaderActionIcon name={headerIcons?.wishlist} fallback={Heart} />
                {wishlistCount > 0 ? <BadgeCount count={wishlistCount} /> : null}
              </Link>
            ) : null}
            {showCartIcon ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={handleCartTriggerClick}
                  aria-label="Cart"
                  title="Cart"
                  className={`${iconButtonClass} relative`}
                >
                  <HeaderActionIcon name={headerIcons?.cart} fallback={ShoppingCart} />
                  {cartBadgeCount > 0 ? <BadgeCount count={cartBadgeCount} /> : null}
                </button>
                {cartTriggerVariant === "dropdown" ? (
                  <CartDropdown isOpen={isCartDropdownOpen} onClose={() => setIsCartDropdownOpen(false)} />
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              className={`${iconButtonClass} lg:hidden`}
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={isMenuOpen}
            >
              <HeaderActionIcon name={headerIcons?.menu} fallback={Menu} />
            </button>
          </div>
        </div>

        <div className="hidden border-t border-zinc-100 pt-2.5 dark:border-zinc-800/70 lg:block">
          {/* `flex-wrap` (not `overflow-x-auto`) on purpose: per the CSS spec, setting only
              `overflow-x` to a non-visible value forces the browser to compute `overflow-y`
              as `auto` too — which was silently clipping/scroll-cutting the "Shop" dropdown
              panel below. Wrapping avoids the clip entirely instead of working around it. */}
          {/* `-ml-3.5` cancels the first nav link's own `px-3.5` pill padding (see
              `navLinkClass`) so its label text sits flush with the row's left edge —
              i.e. the same column as the logo above and the theme's max-width edge —
              instead of appearing indented by the pill's hit-area padding. */}
          <nav aria-label="Main navigation" className="-ml-3.5 flex flex-wrap items-center gap-x-1 gap-y-1.5">
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
        </div>
      </div>
      </header>

      {/* Spacer: kept in sync with the (fixed, out-of-flow) header's live height above,
          including as the announcement bar collapses, so page content is never covered
          nor left with a gap. Not needed when `sticky` is off — the header is already
          in normal document flow at that point. */}
      {sticky ? (
        <div style={{ height: headerHeight }} className="shrink-0 transition-[height] duration-300 ease-in-out" aria-hidden="true" />
      ) : null}

      <MobileDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        primaryNavigation={resolvedMobileNavigation}
        wishlistCount={wishlistCount}
        readingListCount={readingListCount}
        cartBadgeCount={cartBadgeCount}
        onCartClick={handleCartTriggerClick}
        search={search}
      />
    </>
  );
}

function MobileDrawer({
  isOpen,
  onClose,
  primaryNavigation,
  wishlistCount,
  readingListCount,
  cartBadgeCount,
  onCartClick,
  search,
}: {
  isOpen: boolean;
  onClose: () => void;
  primaryNavigation: HeaderNavItem[];
  wishlistCount: number;
  readingListCount: number;
  cartBadgeCount: number;
  onCartClick: () => void;
  search?: SearchAutocompleteProps["search"];
}) {
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
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className={`fixed inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-white shadow-soft-lg transition-transform duration-300 ease-out dark:bg-zinc-950 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between p-6 pb-4">
          <span className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">Menu</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-grid h-9 w-9 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="scrollbar-thin grid min-h-0 flex-1 content-start gap-6 overflow-y-auto px-6 pb-6 pt-1">
          <SearchAutocomplete search={search} fullWidth placeholder="Search products..." onNavigate={onClose} />

          {/* Moved here (from a fixed footer strip) so the dropdown panel has room to
              open downward inside this scrollable area — anchored at the very bottom of
              the drawer, it had nowhere to expand into and was effectively unreachable. */}
          <div className="flex gap-2">
            <LanguageSwitcher fullWidth />
            <CurrencySwitcher fullWidth />
          </div>

          <nav aria-label="Mobile navigation" className="grid gap-1">
            {primaryNavigation.map((item) => (
              <MobileNavItem key={menuItemKey(item)} item={item} />
            ))}
          </nav>

          <div className="grid gap-1 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <Link to="/account" className={mobileActionLinkClass}>
              <User className="h-4 w-4" aria-hidden="true" /> Account
            </Link>
            <Link to="/reading-list" className={mobileActionLinkClass}>
              <BookMarked className="h-4 w-4" aria-hidden="true" /> Reading list
              {readingListCount > 0 ? <span className="ml-auto text-xs font-semibold text-brand-600 dark:text-brand-400">{readingListCount}</span> : null}
            </Link>
            <Link to="/wishlist" className={mobileActionLinkClass}>
              <Heart className="h-4 w-4" aria-hidden="true" /> Wishlist
              {wishlistCount > 0 ? <span className="ml-auto text-xs font-semibold text-brand-600 dark:text-brand-400">{wishlistCount}</span> : null}
            </Link>
            <button
              type="button"
              onClick={() => {
                onClose();
                onCartClick();
              }}
              className={`${mobileActionLinkClass} w-full text-left`}
            >
              <ShoppingCart className="h-4 w-4" aria-hidden="true" /> Cart
              {cartBadgeCount > 0 ? <span className="ml-auto text-xs font-semibold text-brand-600 dark:text-brand-400">{cartBadgeCount}</span> : null}
            </button>
          </div>
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
 * nesting-depth limit. Top-level sub-lists start expanded (there's currently just one,
 * "Shop", and it should stay discoverable); deeper levels start collapsed. */
function MobileNavItem({ item, depth = 0 }: { item: HeaderNavItem; depth?: number }) {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const hasChildren = Boolean(item.children?.length);

  return (
    <div>
      <div className="flex items-center">
        <NavLink
          to={item.href}
          end={item.href === "/"}
          reloadDocument={isExternalHref(item.href)}
          title={item.title}
          target={item.target}
          rel={menuItemRel(item)}
          className={({ isActive }) => joinMenuClasses(`${mobileNavLinkClass({ isActive })} flex-1`, item)}
        >
          <span className="grid">
            <span>{item.label}</span>
            {item.description ? <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">{item.description}</span> : null}
          </span>
        </NavLink>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsExpanded((previous) => !previous)}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.label} submenu`}
            aria-expanded={isExpanded}
            className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {hasChildren ? (
        <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden">
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

/** Desktop-only dropdown for nav items with `children` (currently just "Shop", to preview
 * the in-progress product template). Mirrors the legacy Gatsby prototype's `DesktopMenu`
 * hover-to-reveal interaction (`menu-header.js`), with click/keyboard support layered on
 * top for touch and accessibility. The panel is rendered through a portal and positioned
 * from the trigger's own bounding box (like `MobileDrawer`) so it's never clipped by an
 * ancestor's overflow/stacking context — the actual cause of the old dropdown not showing
 * reliably. */
function NavDropdownItem({ item }: { item: HeaderNavItem }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<number | undefined>(undefined);
  const location = useLocation();
  const isActive = navItemMatchesPath(item, location.pathname);

  const updatePosition = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 8, left: rect.left });
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
    closeTimeoutRef.current = window.setTimeout(() => setIsOpen(false), 150);
  };

  useEffect(() => setIsOpen(false), [location.pathname]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
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
          type="button"
          onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
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
              onMouseEnter={openMenu}
              onMouseLeave={scheduleClose}
              style={{ top: position.top, left: position.left }}
              className="fixed z-50 grid w-64 origin-top-left gap-0.5 rounded-xl border border-zinc-100 bg-white p-2 shadow-xl transition-all duration-150 dark:border-zinc-800 dark:bg-zinc-900"
            >
              {item.children?.map((child) => (
                <NavDropdownPanelItem key={menuItemKey(child)} item={child} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** A single entry inside a desktop dropdown panel. Renders as a plain link, or — when
 * it has its own `children` — as an inline expandable group (arrow toggle, like the
 * nested footer-menu columns) rather than a further flyout, keeping deep nesting simple
 * to reach with a mouse without chaining hover-timers across multiple panels. */
function NavDropdownPanelItem({ item }: { item: HeaderNavItem }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = Boolean(item.children?.length);

  if (!hasChildren) {
    return (
      <NavLink
        role="menuitem"
        to={item.href}
        end={item.href === "/"}
        reloadDocument={isExternalHref(item.href)}
        title={item.title}
        target={item.target}
        rel={menuItemRel(item)}
        className={({ isActive }) =>
          joinMenuClasses(`rounded-lg px-3 py-2 text-sm font-medium no-underline transition ${
            isActive
              ? "font-semibold text-brand-600 dark:text-brand-400"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
          }`, item)
        }
      >
        <span className="grid gap-0.5">
          <span>{item.label}</span>
          {item.description ? <span className="text-xs font-normal leading-snug text-zinc-400 dark:text-zinc-500">{item.description}</span> : null}
        </span>
      </NavLink>
    );
  }

  return (
    <div>
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
          <span className="grid gap-0.5">
            <span>{item.label}</span>
            {item.description ? <span className="text-xs font-normal leading-snug text-zinc-400 dark:text-zinc-500">{item.description}</span> : null}
          </span>
        </NavLink>
        <button
          type="button"
          onClick={() => setIsExpanded((previous) => !previous)}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.label} submenu`}
          aria-expanded={isExpanded}
          className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>

      <div className={`grid transition-all duration-200 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="ml-3 mt-0.5 grid gap-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-800">
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

const HEADER_ACTION_ICONS: Record<string, LucideIcon> = {
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

function HeaderActionIcon({ name, fallback: Fallback }: { name?: string; fallback: LucideIcon }) {
  const Icon = (name && HEADER_ACTION_ICONS[name]) || Fallback;
  return <Icon className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />;
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
