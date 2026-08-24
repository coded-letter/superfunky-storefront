export type RawLocalizedTermTranslation = {
  id: string;
  databaseId: number;
  uri?: string | null;
  language?: { code: string | null } | null;
};

export type RawLocalizedTerm = RawLocalizedTermTranslation & {
  name: string | null;
  slug: string | null;
  uri: string | null;
  description?: string | null;
  count?: number | null;
  image?: { sourceUrl: string | null } | null;
  translations?: (RawLocalizedTermTranslation | null)[] | null;
};

export type MappedProductTerm = {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  uri: string;
  descriptionHtml: string;
  count: number;
  imageUrl: string | null;
};

export function mapLocalizedTerms(
  terms: RawLocalizedTerm[] | undefined,
  languageCode?: string,
): MappedProductTerm[] {
  const normalizedLanguage = languageCode?.trim().toLowerCase();
  const hasLanguageMetadata = Boolean(
    normalizedLanguage && terms?.some((term) => term.language?.code),
  );
  return dedupeBy(
    (terms || []).flatMap((term) =>
      term.name
      && term.slug
      && term.uri
      && (
        !hasLanguageMetadata
        || term.language?.code?.toLowerCase() === normalizedLanguage
      )
        ? [{
            id: term.id,
            databaseId: term.databaseId,
            name: term.name,
            slug: term.slug,
            uri: term.uri,
            descriptionHtml: term.description || "",
            count: term.count || 0,
            imageUrl: term.image?.sourceUrl || null,
          }]
        : [],
    ),
    (term) => {
      const rawTerm = terms?.find(({ id }) => id === term.id);
      const translationIds = (rawTerm?.translations || []).flatMap((translation) =>
        translation ? [`database:${translation.databaseId}`, `global:${translation.id}`] : [],
      );
      return [`database:${term.databaseId}`, `global:${term.id}`, ...translationIds].sort().join("|");
    },
  );
}

export function mapLocalizedCatalogTerms<TProduct>(
  products: TProduct[] | undefined,
  listingTerms: RawLocalizedTerm[] | undefined,
  languageCode: string | undefined,
  termsOf: (product: TProduct) => RawLocalizedTerm[] | undefined,
): MappedProductTerm[] {
  const normalizedLanguage = languageCode?.trim().toLowerCase();
  const listingByIdentity = new Map<string, RawLocalizedTerm>();
  const listings = [...(listingTerms || [])].sort((left, right) => {
    const leftMatches = left.language?.code?.toLowerCase() === normalizedLanguage;
    const rightMatches = right.language?.code?.toLowerCase() === normalizedLanguage;
    return Number(rightMatches) - Number(leftMatches);
  });
  for (const term of listings) {
    for (const identity of termIdentities(term)) {
      if (!listingByIdentity.has(identity)) listingByIdentity.set(identity, term);
    }
    if (normalizedLanguage && term.language?.code?.toLowerCase() === normalizedLanguage) {
      for (const translation of term.translations || []) {
        if (!translation) continue;
        for (const identity of termIdentities(translation)) {
          if (!listingByIdentity.has(identity)) listingByIdentity.set(identity, term);
        }
      }
    }
  }

  const assignedTerms = products?.flatMap((product) => termsOf(product) || []) || [];
  return mapLocalizedTerms(
    dedupeBy(assignedTerms, ({ id }) => id).map((term) => ({
      ...term,
      ...termIdentities(term).map((identity) => listingByIdentity.get(identity)).find(Boolean),
    })),
    normalizedLanguage,
  );
}

function termIdentities(term: Pick<RawLocalizedTermTranslation, "id" | "databaseId">): string[] {
  return [`global:${term.id}`, `database:${term.databaseId}`];
}

function dedupeBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
