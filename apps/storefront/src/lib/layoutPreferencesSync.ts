import { useLayoutEffect, useRef } from "react";
import { useLayoutPreferences } from "@funky/ui";
import {
  mapLayoutToHiddenFooterKeys,
  type StorefrontLayoutConfiguration,
} from "./navigation";

type PrefsContext = ReturnType<typeof useLayoutPreferences>;

/** Calls every relevant set* setter from `useLayoutPreferences()` for a normalized
 *  backend `layout` config, plus derives the two hidden-footer-key arrays from the
 *  per-provider `showFooterPayment*`/`showFooterSocial*` booleans. This is the sole
 *  source of truth for the shared layout context: one-directional (backend → UI),
 *  no user-meta persistence, no debounced writes back to the backend. */
export function applyLayoutConfiguration(prefs: PrefsContext, layout: StorefrontLayoutConfiguration) {
  prefs.setShowAnnouncementBar(layout.showAnnouncementBar);
  prefs.setAnnouncementBarScrollEffect(layout.announcementBarScrollEffect);
  prefs.setHeaderSticky(layout.headerSticky);
  prefs.setHeaderSearchVariant(layout.headerSearchVariant);
  prefs.setHeaderLogoVariant(layout.headerLogoVariant);
  prefs.setShowHeaderLogo(layout.showHeaderLogo);
  prefs.setShowHeaderSearchIcon(layout.showHeaderSearchIcon);
  prefs.setShowHeaderLanguageSwitcher(layout.showHeaderLanguageSwitcher);
  prefs.setShowHeaderCurrencySwitcher(layout.showHeaderCurrencySwitcher);
  prefs.setShowHeaderDarkModeToggle(layout.showHeaderDarkModeToggle);
  prefs.setShowHeaderAccountLink(layout.showHeaderAccountLink);
  prefs.setShowHeaderReadingListLink(layout.showHeaderReadingListLink);
  prefs.setShowHeaderWishlistLink(layout.showHeaderWishlistLink);
  prefs.setShowHeaderCartIcon(layout.showHeaderCartIcon);
  prefs.setShowHeaderPublishButton(layout.showHeaderPublishButton);
  prefs.setCartTriggerVariant(layout.cartTriggerVariant);
  prefs.setShowCartDrawerPromotedProduct(layout.showCartDrawerPromotedProduct);
  prefs.setShowAllCartPromotedProducts(layout.showAllCartPromotedProducts);
  prefs.setShowFooter(layout.showFooter);
  prefs.setFooterColumnsLayout(layout.footerColumnsLayout);
  prefs.setFooterNewsletterLayout(layout.footerNewsletterLayout);
  prefs.setShowFooterNewsletter(layout.showFooterNewsletter);
  prefs.setFooterAssistantLayout(layout.footerAssistantLayout);
  prefs.setFooterLogoVariant(layout.footerLogoVariant);
  prefs.setFooterBottomBarLayout(layout.footerBottomBarLayout);
  prefs.setFooterExtraWrapperLayout(layout.footerExtraWrapperLayout);
  prefs.setShowFooterLogo(layout.showFooterLogo);
  prefs.setShowFooterExtraWrapper(layout.showFooterExtraWrapper);
  prefs.setShowFooterSpotifyPlayer(layout.showFooterSpotifyPlayer);
  prefs.setShowFooterAssistantFrame(layout.showFooterAssistantFrame);
  prefs.setShowFooterPaymentMethods(layout.showFooterPaymentMethods);
  prefs.setShowFooterSocialLinks(layout.showFooterSocialLinks);
  prefs.setShowFooterCopyright(layout.showFooterCopyright);
  prefs.setThemeMaxWidthPx(layout.themeMaxWidthPx);
  prefs.setThemeRadiusPx(layout.themeRadiusPx);
  prefs.setShowBreadcrumbs(layout.showBreadcrumbs);
  prefs.setShowNewsletterPopup(layout.showNewsletterPopup);
  prefs.setNewsletterPopupVariant(layout.newsletterPopupVariant);
  prefs.setNewsletterPopupCooldownDays(layout.newsletterPopupCooldownDays);
  prefs.setBrandPalette(layout.brandPalette);
  prefs.setBrandGradientStyle(layout.brandGradientStyle);
  prefs.setProductPageLayout(layout.productPageLayout);
  prefs.setRelatedProductsColumns(layout.relatedProductsColumns);
  prefs.setShowStudioRelatedProductsUnderMeta(layout.showStudioRelatedProductsUnderMeta);
  prefs.setHomeHeroLayout(layout.homeHeroLayout);
  prefs.setShopProductCardVariant(layout.shopProductCardVariant);
  prefs.setAuthLayout(layout.authLayout);
  prefs.setReadingListLayout(layout.readingListLayout);
  prefs.setWishlistCardVariant(layout.wishlistCardVariant);
  prefs.setCommunityFeedLayout(layout.communityFeedLayout);
  prefs.setCommunityFeedLoadMode(layout.communityFeedLoadMode);
  prefs.setCommunityFeedPageSize(layout.communityFeedPageSize);
  prefs.setCommunityFeedFilters(layout.communityFeedFilters);
  prefs.setCartLayout(layout.cartLayout);
  prefs.setCartSummaryPosition(layout.cartSummaryPosition);
  prefs.setCheckoutStoreMode(layout.checkoutStoreMode);
  prefs.setCheckoutCouponPosition(layout.checkoutCouponPosition);
  prefs.setCheckoutPaymentPosition(layout.checkoutPaymentPosition);
  prefs.setCheckoutSummaryPosition(layout.checkoutSummaryPosition);
  prefs.setCheckoutHideOptionalBillingFields(layout.checkoutHideOptionalBillingFields);
  prefs.setCheckoutHideOptionalShippingFields(layout.checkoutHideOptionalShippingFields);
  prefs.setCheckoutShowOrderNotes(layout.checkoutShowOrderNotes);
  prefs.setCheckoutShowTerms(layout.checkoutShowTerms);
  prefs.setCheckoutShowPrivacy(layout.checkoutShowPrivacy);
  prefs.setCommunityProfileHeaderLayout(layout.communityProfileHeaderLayout);
  prefs.setAuthorProfileHeaderLayout(layout.authorProfileHeaderLayout);
  prefs.setProductArchiveHeroLayout(layout.productArchiveHeroLayout);
  prefs.setPostArchiveHeroLayout(layout.postArchiveHeroLayout);
  prefs.setShowArchiveDescriptionInHero(layout.showArchiveDescriptionInHero);
  prefs.setPostTocLayout(layout.postTocLayout);
  prefs.setPostSharePosition(layout.postSharePosition);
  prefs.setPostAuthorLayout(layout.postAuthorLayout);
  prefs.setDiscussionLayout(layout.discussionLayout);

  const { hiddenFooterPaymentMethodKeys, hiddenFooterSocialLinkKeys } = mapLayoutToHiddenFooterKeys(layout);
  prefs.setHiddenFooterPaymentMethodKeys(hiddenFooterPaymentMethodKeys);
  prefs.setHiddenFooterSocialLinkKeys(hiddenFooterSocialLinkKeys);
}

/** Hydrates/reconciles the shared `LayoutPreferencesContext` from the canonical
 *  backend storefront `layout` configuration. Layout Studio temporarily disables
 *  reconciliation while its session-local preview is active so navigation-data
 *  revalidation cannot overwrite the user's in-progress customization. */
export function useLayoutPreferencesFromBackendConfig(
  layout: StorefrontLayoutConfiguration | undefined,
  enabled = true,
) {
  const prefs = useLayoutPreferences();
  const appliedLayoutSignature = useRef<string | null>(null);
  const layoutSignature = enabled && layout ? JSON.stringify(layout) : null;
  useLayoutEffect(() => {
    if (!enabled || !layout || !layoutSignature || prefs.isLayoutPreviewActive) {
      appliedLayoutSignature.current = null;
      return;
    }
    if (appliedLayoutSignature.current === layoutSignature) return;
    appliedLayoutSignature.current = layoutSignature;
    applyLayoutConfiguration(prefs, layout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, layoutSignature, prefs.isLayoutPreviewActive]);
}
