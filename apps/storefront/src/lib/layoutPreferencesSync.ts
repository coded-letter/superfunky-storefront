import { useEffect, useRef } from "react";
import { useLayoutPreferences } from "@funky/ui";
import { authStore } from "./auth";
import { loadLayoutPreferences, saveLayoutPreferences } from "./account";

const DEBOUNCE_MS = 2000;

type PrefsContext = ReturnType<typeof useLayoutPreferences>;

/** Calls every set* setter from useLayoutPreferences() for each key present in
 *  the saved snapshot. Unknown or invalid keys are silently skipped. */
function applySnapshot(prefs: PrefsContext, snapshot: Record<string, unknown>) {
  if (typeof snapshot.showAnnouncementBar === "boolean") prefs.setShowAnnouncementBar(snapshot.showAnnouncementBar);
  if (typeof snapshot.announcementBarScrollEffect === "boolean") prefs.setAnnouncementBarScrollEffect(snapshot.announcementBarScrollEffect);
  if (typeof snapshot.headerSticky === "boolean") prefs.setHeaderSticky(snapshot.headerSticky);
  if (typeof snapshot.headerSearchVariant === "string") prefs.setHeaderSearchVariant(snapshot.headerSearchVariant as never);
  if (typeof snapshot.headerLogoVariant === "string") prefs.setHeaderLogoVariant(snapshot.headerLogoVariant as never);
  if (typeof snapshot.showHeaderLogo === "boolean") prefs.setShowHeaderLogo(snapshot.showHeaderLogo);
  if (typeof snapshot.showHeaderSearchIcon === "boolean") prefs.setShowHeaderSearchIcon(snapshot.showHeaderSearchIcon);
  if (typeof snapshot.showHeaderLanguageSwitcher === "boolean") prefs.setShowHeaderLanguageSwitcher(snapshot.showHeaderLanguageSwitcher);
  if (typeof snapshot.showHeaderCurrencySwitcher === "boolean") prefs.setShowHeaderCurrencySwitcher(snapshot.showHeaderCurrencySwitcher);
  if (typeof snapshot.showHeaderDarkModeToggle === "boolean") prefs.setShowHeaderDarkModeToggle(snapshot.showHeaderDarkModeToggle);
  if (typeof snapshot.showHeaderAccountLink === "boolean") prefs.setShowHeaderAccountLink(snapshot.showHeaderAccountLink);
  if (typeof snapshot.showHeaderReadingListLink === "boolean") prefs.setShowHeaderReadingListLink(snapshot.showHeaderReadingListLink);
  if (typeof snapshot.showHeaderWishlistLink === "boolean") prefs.setShowHeaderWishlistLink(snapshot.showHeaderWishlistLink);
  if (typeof snapshot.showHeaderCartIcon === "boolean") prefs.setShowHeaderCartIcon(snapshot.showHeaderCartIcon);
  if (typeof snapshot.cartTriggerVariant === "string") prefs.setCartTriggerVariant(snapshot.cartTriggerVariant as never);
  if (typeof snapshot.showCartDrawerPromotedProduct === "boolean") prefs.setShowCartDrawerPromotedProduct(snapshot.showCartDrawerPromotedProduct);
  if (typeof snapshot.showFooter === "boolean") prefs.setShowFooter(snapshot.showFooter);
  if (typeof snapshot.footerColumnsLayout === "string") prefs.setFooterColumnsLayout(snapshot.footerColumnsLayout as never);
  if (typeof snapshot.footerNewsletterLayout === "string") prefs.setFooterNewsletterLayout(snapshot.footerNewsletterLayout as never);
  if (typeof snapshot.showFooterNewsletter === "boolean") prefs.setShowFooterNewsletter(snapshot.showFooterNewsletter);
  if (typeof snapshot.footerAssistantLayout === "string") prefs.setFooterAssistantLayout(snapshot.footerAssistantLayout as never);
  if (typeof snapshot.footerLogoVariant === "string") prefs.setFooterLogoVariant(snapshot.footerLogoVariant as never);
  if (typeof snapshot.footerBottomBarLayout === "string") prefs.setFooterBottomBarLayout(snapshot.footerBottomBarLayout as never);
  if (typeof snapshot.footerExtraWrapperLayout === "string") prefs.setFooterExtraWrapperLayout(snapshot.footerExtraWrapperLayout as never);
  if (typeof snapshot.showFooterLogo === "boolean") prefs.setShowFooterLogo(snapshot.showFooterLogo);
  if (typeof snapshot.showFooterExtraWrapper === "boolean") prefs.setShowFooterExtraWrapper(snapshot.showFooterExtraWrapper);
  if (typeof snapshot.showFooterSpotifyPlayer === "boolean") prefs.setShowFooterSpotifyPlayer(snapshot.showFooterSpotifyPlayer);
  if (typeof snapshot.showFooterAssistantFrame === "boolean") prefs.setShowFooterAssistantFrame(snapshot.showFooterAssistantFrame);
  if (typeof snapshot.showFooterPaymentMethods === "boolean") prefs.setShowFooterPaymentMethods(snapshot.showFooterPaymentMethods);
  if (typeof snapshot.showFooterSocialLinks === "boolean") prefs.setShowFooterSocialLinks(snapshot.showFooterSocialLinks);
  if (typeof snapshot.showFooterCopyright === "boolean") prefs.setShowFooterCopyright(snapshot.showFooterCopyright);
  if (typeof snapshot.themeMaxWidthPx === "number") prefs.setThemeMaxWidthPx(snapshot.themeMaxWidthPx);
  if (typeof snapshot.themeRadiusPx === "number") prefs.setThemeRadiusPx(snapshot.themeRadiusPx);
  if (typeof snapshot.showBreadcrumbs === "boolean") prefs.setShowBreadcrumbs(snapshot.showBreadcrumbs);
  if (typeof snapshot.showNewsletterPopup === "boolean") prefs.setShowNewsletterPopup(snapshot.showNewsletterPopup);
  if (typeof snapshot.newsletterPopupVariant === "string") prefs.setNewsletterPopupVariant(snapshot.newsletterPopupVariant as never);
  if (typeof snapshot.newsletterPopupCooldownDays === "number") prefs.setNewsletterPopupCooldownDays(snapshot.newsletterPopupCooldownDays);
  if (typeof snapshot.brandPalette === "string") prefs.setBrandPalette(snapshot.brandPalette as never);
  if (typeof snapshot.brandGradientStyle === "string") prefs.setBrandGradientStyle(snapshot.brandGradientStyle as never);
  if (typeof snapshot.checkoutStoreMode === "string") prefs.setCheckoutStoreMode(snapshot.checkoutStoreMode as never);
  if (typeof snapshot.checkoutCouponPosition === "string") prefs.setCheckoutCouponPosition(snapshot.checkoutCouponPosition as never);
  if (typeof snapshot.checkoutPaymentPosition === "string") prefs.setCheckoutPaymentPosition(snapshot.checkoutPaymentPosition as never);
  if (typeof snapshot.checkoutSummaryPosition === "string") prefs.setCheckoutSummaryPosition(snapshot.checkoutSummaryPosition as never);
  if (typeof snapshot.checkoutHideOptionalBillingFields === "boolean") prefs.setCheckoutHideOptionalBillingFields(snapshot.checkoutHideOptionalBillingFields);
  if (typeof snapshot.checkoutHideOptionalShippingFields === "boolean") prefs.setCheckoutHideOptionalShippingFields(snapshot.checkoutHideOptionalShippingFields);
  if (typeof snapshot.checkoutShowOrderNotes === "boolean") prefs.setCheckoutShowOrderNotes(snapshot.checkoutShowOrderNotes);
  if (typeof snapshot.checkoutShowTerms === "boolean") prefs.setCheckoutShowTerms(snapshot.checkoutShowTerms);
  if (typeof snapshot.checkoutShowPrivacy === "boolean") prefs.setCheckoutShowPrivacy(snapshot.checkoutShowPrivacy);
}

/** Syncs Layout Studio preferences to WP user meta when the user is logged in.
 *  - Loads saved preferences on mount (if auth token present) and restores them.
 *  - Debounces saves (2 s) whenever preferences change so rapid slider moves do
 *    not flood the backend with requests. */
export function useLayoutPreferencesSync() {
  const prefs = useLayoutPreferences();
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load on mount only if logged in.
  useEffect(() => {
    if (loadedRef.current || !authStore.load()?.authToken) return;
    loadedRef.current = true;
    loadLayoutPreferences().then((snapshot) => {
      if (snapshot) applySnapshot(prefs, snapshot);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute a serialized key of all non-function preference values for change detection.
  const stateKey = JSON.stringify(
    Object.fromEntries(Object.entries(prefs).filter(([, v]) => typeof v !== "function")),
  );

  // Debounce saves whenever stateKey changes (skip before initial load completes).
  useEffect(() => {
    if (!loadedRef.current || !authStore.load()?.authToken) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const snapshot = Object.fromEntries(
        Object.entries(prefs).filter(([, v]) => typeof v !== "function"),
      );
      saveLayoutPreferences(snapshot);
    }, DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);
}
