export const ACCOUNT_TABS = ["dashboard", "orders", "downloads", "addresses", "community"] as const;

export type AccountTab = (typeof ACCOUNT_TABS)[number];

export function accountTabFromHash(hash: string): AccountTab | null {
  const candidate = hash.replace(/^#/, "");
  return ACCOUNT_TABS.includes(candidate as AccountTab) ? candidate as AccountTab : null;
}

export function configuredAccountTabs(value: string): AccountTab[] {
  const tabs = value
    .split(",")
    .map((tab) => tab.trim())
    .filter((tab): tab is AccountTab => ACCOUNT_TABS.includes(tab as AccountTab));
  const isLegacyDefault = tabs.join(",") === "dashboard,orders,addresses,community";
  return isLegacyDefault
    ? ["dashboard", "orders", "downloads", "addresses", "community"]
    : tabs;
}

export function accountTabLocation(
  location: { pathname: string; search: string },
  tab: AccountTab,
): { pathname: string; search: string; hash: string } {
  return {
    pathname: location.pathname,
    search: location.search,
    hash: `#${tab}`,
  };
}
