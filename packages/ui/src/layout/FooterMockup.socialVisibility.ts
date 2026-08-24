import type { SocialLink } from "../locale";

export function isSocialLinkHidden(link: SocialLink, hiddenKeys: readonly string[]) {
  return hiddenKeys.includes(link.platform) || hiddenKeys.includes(link.id);
}

export function filterVisibleSocialLinks(socialLinks: readonly SocialLink[], hiddenKeys: readonly string[]) {
  return socialLinks.filter((link) => !isSocialLinkHidden(link, hiddenKeys));
}
