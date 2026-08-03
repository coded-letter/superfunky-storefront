import { getLanguageFlagCode, type CurrencyOption, type FooterColumn, type HeaderNavItem, type LanguageOption } from "@funky/ui";
import { BACKEND_ORIGIN } from "./env";
import { graphqlRequest } from "./graphqlClient";
import { mapBackendLanguages } from "./languageMapping";

type RawMenuItem = {
  id: string;
  databaseId: number;
  parentDatabaseId: number | null;
  order: number | null;
  label: string | null;
  title: string | null;
  description: string | null;
  path: string | null;
  uri: string | null;
  url: string | null;
  target: string | null;
  cssClasses: (string | null)[] | null;
  linkRelationship: string | null;
  locations: string[] | null;
};

type NavigationQueryResult = {
  menus: {
    nodes: {
      id: string;
      databaseId: number;
      name: string | null;
      slug: string | null;
      locations: string[] | null;
      menuItems: {
        nodes: RawMenuItem[];
      } | null;
    }[];
  } | null;
  languages: { code: string; name: string; slug: string }[] | null;
  storefrontConfig: StorefrontConfiguration | null;
  uiStrings: string | null;
};

type StorefrontRuntimeQueryResult = {
  storefrontConfig: Pick<StorefrontConfiguration, "defaultCustomerCountry" | "shippingCountries" | "freeShippingZones" | "stripePublishableKey"> | null;
};

export type StorefrontConfiguration = {
  baseCurrency: string;
  rateMode: string;
  currencies: CurrencyOption[];
  defaultCustomerCountry?: string | null;
  shippingCountries?: Array<{ code: string; name: string }>;
  freeShippingZones?: Array<{
    countryCode: string;
    zoneName?: string | null;
    minAmount?: number | null;
    requires?: string | null;
    currencyCode?: string | null;
  }>;
  stripePublishableKey?: string | null;
  branding: {
    storeName: string;
    companyName: string;
    tagline: string;
    logoUrl: string | null;
    iconUrl: string | null;
    promoText: string;
  };
  headerIcons: {
    search: string;
    theme: string;
    account: string;
    readingList: string;
    wishlist: string;
    cart: string;
    menu: string;
  };
  features: {
    promo: boolean;
    search: boolean;
    languages: boolean;
    currencies: boolean;
    account: boolean;
    wishlist: boolean;
    readingList: boolean;
    cart: boolean;
    crypto: boolean;
  };
  checkout: {
    heading: string;
    intro: string;
    trustMessage: string;
    supportMessage: string;
    supportUrl?: string | null;
    marketingLabel: string;
    termsMessage: string;
    submitLabel: string;
  };
};

export type CmsNavigationData = {
  header: HeaderNavItem[];
  mobile: HeaderNavItem[];
  footer: FooterColumn[];
  languages: LanguageOption[];
  storefrontConfig: StorefrontConfiguration;
  uiStrings: Record<string, string>;
};

export const DEFAULT_STOREFRONT_CONFIGURATION: StorefrontConfiguration = {
  baseCurrency: "EUR",
  rateMode: "manual",
  currencies: [{ code: "EUR", label: "EUR", symbol: "€", rate: 1 }],
  defaultCustomerCountry: null,
  shippingCountries: [],
  freeShippingZones: [],
  stripePublishableKey: null,
  branding: {
    storeName: "FunkyCommerce",
    companyName: "FunkyCommerce",
    tagline: "Modern storefront mockup",
    logoUrl: null,
    iconUrl: null,
    promoText: "Free shipping over €60 · Dispatch in 24h · 30-day returns",
  },
  headerIcons: {
    search: "search",
    theme: "moon",
    account: "user",
    readingList: "book-marked",
    wishlist: "heart",
    cart: "shopping-cart",
    menu: "menu",
  },
  features: {
    promo: true,
    search: true,
    languages: true,
    currencies: true,
    account: true,
    wishlist: true,
    readingList: true,
    cart: true,
    crypto: false,
  },
  checkout: {
    heading: "Secure checkout",
    intro: "Complete your details and choose a payment method to place your order.",
    trustMessage: "Encrypted payment · Clear totals · Secure processing",
    supportMessage: "Need help with your order? Contact our support team.",
    supportUrl: null,
    marketingLabel: "Keep me posted about new drops, offers, and restocks by email.",
    termsMessage: "By placing your order, you agree to the store terms and privacy policy.",
    submitLabel: "Place order",
  },
};

const NAVIGATION_QUERY = /* GraphQL */ `
  query StorefrontNavigation($language: String) {
    languages { code name slug }
    uiStrings: funkycommerceUiStrings(language: $language)
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      baseCurrency
      rateMode
      currencies {
        code
        label
        symbol
        rate
      }
      branding {
        storeName
        companyName
        tagline
        logoUrl
        iconUrl
        promoText
      }
      headerIcons {
        search
        theme
        account
        readingList
        wishlist
        cart
        menu
      }
      features {
        promo
        search
        languages
        currencies
        account
        wishlist
        readingList
        cart
        crypto
      }
      checkout {
        heading
        intro
        trustMessage
        supportMessage
        supportUrl
        marketingLabel
        termsMessage
        submitLabel
      }
    }
    menus(first: 100) {
      nodes {
        id
        databaseId
        name
        slug
        locations
        menuItems(first: 100) {
          nodes {
            id
            databaseId
            parentDatabaseId
            order
            label
            title
            description
            path
            uri
            url
            target
            cssClasses
            linkRelationship
            locations
          }
        }
      }
    }
  }
`;

const STOREFRONT_RUNTIME_QUERY = /* GraphQL */ `
  query StorefrontRuntimeConfig($language: String) {
    storefrontConfig: funkycommerceStorefrontConfig(language: $language) {
      defaultCustomerCountry
      shippingCountries {
        code
        name
      }
      freeShippingZones {
        countryCode
        zoneName
        minAmount
        requires
        currencyCode
      }
      stripePublishableKey
    }
  }
`;

export async function getNavigationData(languageCode: string): Promise<CmsNavigationData> {
  const [{ data, errors }, runtime] = await Promise.all([
    graphqlRequest<NavigationQueryResult>(NAVIGATION_QUERY, { language: languageCode.toLowerCase() }),
    graphqlRequest<StorefrontRuntimeQueryResult>(STOREFRONT_RUNTIME_QUERY, { language: languageCode.toLowerCase() }),
  ]);

  if (errors?.length) {
    throw new Error(errors.map(({ message }) => message).join("; "));
  }
  if (!data) {
    throw new Error("The navigation query returned no data");
  }

  const menus = (data.menus?.nodes || []).filter((menu) => menu.menuItems?.nodes.length);
  const header = mapBestAvailableMenu(menus, "HEADER", languageCode);
  const mobile = mapBestAvailableMenu(menus, "MOBILE", languageCode, ["HEADER"]);
  const footer = mapBestAvailableMenu(menus, "FOOTER", languageCode, ["HEADER", "MOBILE"]);
  return {
    header,
    mobile: mobile.length ? mobile : header,
    footer: mapFooterColumns(footer.length ? footer : header),
    languages: mapBackendLanguages(data.languages || []).map((language) => ({
      ...language,
      flagCode: getLanguageFlagCode(language.code),
    })),
    storefrontConfig: normalizeStorefrontConfiguration({
      ...(data.storefrontConfig || {}),
      ...(runtime.data?.storefrontConfig || {}),
    } as StorefrontConfiguration),
    uiStrings: parseUiStrings(data.uiStrings),
  };
}

function parseUiStrings(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // Malformed JSON — fall through to empty map.
  }
  return {};
}

function normalizeStorefrontConfiguration(configuration: StorefrontConfiguration | null): StorefrontConfiguration {
  if (!configuration) return DEFAULT_STOREFRONT_CONFIGURATION;
  return {
    baseCurrency: configuration.baseCurrency || DEFAULT_STOREFRONT_CONFIGURATION.baseCurrency,
    rateMode: configuration.rateMode || DEFAULT_STOREFRONT_CONFIGURATION.rateMode,
    currencies: Array.isArray(configuration.currencies) && configuration.currencies.length
      ? configuration.currencies
          .filter((currency) => currency?.code && currency?.symbol)
          .map((currency) => ({
            code: currency.code.toUpperCase(),
            label: currency.label || currency.code.toUpperCase(),
            symbol: currency.symbol,
            rate: Number.isFinite(currency.rate) ? currency.rate : 0,
          }))
      : DEFAULT_STOREFRONT_CONFIGURATION.currencies,
    defaultCustomerCountry:
      typeof configuration.defaultCustomerCountry === "string" && configuration.defaultCustomerCountry
        ? configuration.defaultCustomerCountry.toUpperCase()
        : DEFAULT_STOREFRONT_CONFIGURATION.defaultCustomerCountry,
    shippingCountries:
      Array.isArray(configuration.shippingCountries) && configuration.shippingCountries.length
        ? configuration.shippingCountries
            .filter((country) => country?.code && country?.name)
            .map((country) => ({ code: country.code.toUpperCase(), name: country.name }))
        : DEFAULT_STOREFRONT_CONFIGURATION.shippingCountries,
    freeShippingZones:
      Array.isArray(configuration.freeShippingZones) && configuration.freeShippingZones.length
        ? configuration.freeShippingZones
            .filter((zone) => zone?.countryCode)
            .map((zone) => ({
              countryCode: zone.countryCode.toUpperCase(),
              zoneName: zone.zoneName || null,
              minAmount: Number.isFinite(zone.minAmount) ? zone.minAmount : null,
              requires: zone.requires || null,
              currencyCode: zone.currencyCode?.toUpperCase() || null,
            }))
        : DEFAULT_STOREFRONT_CONFIGURATION.freeShippingZones,
    stripePublishableKey:
      typeof configuration.stripePublishableKey === "string" && configuration.stripePublishableKey.startsWith("pk_")
        ? configuration.stripePublishableKey
        : DEFAULT_STOREFRONT_CONFIGURATION.stripePublishableKey,
    branding: { ...DEFAULT_STOREFRONT_CONFIGURATION.branding, ...configuration.branding },
    headerIcons: { ...DEFAULT_STOREFRONT_CONFIGURATION.headerIcons, ...configuration.headerIcons },
    features: { ...DEFAULT_STOREFRONT_CONFIGURATION.features, ...configuration.features },
  };
}

type RawMenu = NonNullable<NavigationQueryResult["menus"]>["nodes"][number];
type MenuLocation = "HEADER" | "MOBILE" | "FOOTER";

function mapBestAvailableMenu(
  menus: RawMenu[],
  location: MenuLocation,
  languageCode: string,
  fallbackLocations: MenuLocation[] = [],
): HeaderNavItem[] {
  const locationPriority = [location, ...fallbackLocations];
  const ranked = menus
    .map((menu, index) => ({
      menu,
      index,
      score: scoreMenu(menu, locationPriority, languageCode),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index);

  for (const { menu } of ranked) {
    const mapped = mapMenuItems(menu.menuItems?.nodes || []);
    if (mapped.length) return mapped;
  }
  return [];
}

function scoreMenu(menu: RawMenu, locations: MenuLocation[], languageCode: string): number {
  const assignedLocations = new Set([
    ...(menu.locations || []),
    ...(menu.menuItems?.nodes.flatMap((item) => item.locations || []) || []),
  ]);
  const language = languageCode.toUpperCase();
  const searchableName = `${menu.name || ""} ${menu.slug || ""}`.toUpperCase();

  for (let index = 0; index < locations.length; index += 1) {
    const location = locations[index];
    const priority = (locations.length - index) * 100;
    if (assignedLocations.has(`${location}___${language}`)) return priority + 30;
    if (assignedLocations.has(location)) return priority + 20;
    if ([...assignedLocations].some((assigned) => assigned.startsWith(`${location}___`))) return priority + 10;
    if (searchableName.includes(location)) return priority + 5;
  }
  return 1;
}

function mapMenuItems(items: RawMenuItem[]): HeaderNavItem[] {
  const uniqueItems = new Map<number, RawMenuItem>();
  items.forEach((item) => uniqueItems.set(item.databaseId, item));

  const sortedItems = [...uniqueItems.values()].sort(
    (left, right) => (left.order || 0) - (right.order || 0),
  );
  const childrenByParent = new Map<number, RawMenuItem[]>();
  const roots: RawMenuItem[] = [];

  sortedItems.forEach((item) => {
    const parentId = item.parentDatabaseId || 0;
    if (!parentId || !uniqueItems.has(parentId)) {
      roots.push(item);
      return;
    }
    const children = childrenByParent.get(parentId) || [];
    children.push(item);
    childrenByParent.set(parentId, children);
  });

  return roots.flatMap((item) => mapMenuItem(item, childrenByParent, undefined, new Set()));
}

function mapFooterColumns(items: HeaderNavItem[]): FooterColumn[] {
  return items.map((item) => ({
    title: item.label,
    links: item.children?.length
      ? item.children.map(mapFooterLink)
      : [{ label: item.label, href: item.href }],
  }));
}

function mapFooterLink(item: HeaderNavItem) {
  return {
    label: item.label,
    href: item.href,
    children: item.children?.map(mapFooterLink),
  };
}

function mapMenuItem(
  item: RawMenuItem,
  childrenByParent: Map<number, RawMenuItem[]>,
  parentHref: string | undefined,
  ancestors: Set<number>,
): HeaderNavItem[] {
  const label = item.label?.trim();
  if (!label || ancestors.has(item.databaseId)) return [];

  const href = normalizeMenuHref(item.path || item.uri || item.url, parentHref);
  const nextAncestors = new Set(ancestors).add(item.databaseId);
  const children = (childrenByParent.get(item.databaseId) || []).flatMap((child) =>
    mapMenuItem(child, childrenByParent, href, nextAncestors),
  );

  return [{
    id: item.id,
    label,
    href,
    title: item.title?.trim() || undefined,
    description: htmlToText(item.description || "") || undefined,
    target: item.target?.trim() || undefined,
    cssClasses: item.cssClasses?.flatMap((className) => className?.trim() || []) || [],
    linkRelationship: item.linkRelationship?.trim() || undefined,
    children: children.length ? children : undefined,
  }];
}

function normalizeMenuHref(value: string | null, parentHref: string | undefined): string {
  const href = value?.trim();
  if (!href) return "#";
  if (href.startsWith("#")) {
    const parentPath = parentHref?.split("#")[0];
    return parentPath && parentPath !== "#" ? `${parentPath}${href}` : href;
  }
  if (href.startsWith("/")) return href;

  try {
    const parsed = new URL(href, BACKEND_ORIGIN || window.location.origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return href;
    if (parsed.origin === BACKEND_ORIGIN || parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.href;
  } catch {
    return href;
  }
}

function htmlToText(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.textContent?.replace(/\s+/g, " ").trim() || "";
}
