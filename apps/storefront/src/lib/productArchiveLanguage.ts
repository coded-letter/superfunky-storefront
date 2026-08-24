export type ArchiveLanguageRoute = {
  languageCode: string;
  uri: string;
};

export type ArchiveLanguageMetadata = {
  languageCode: string | null;
  translations: ArchiveLanguageRoute[];
};

export type ArchiveRequestIdentifier = {
  identifier: string;
  idType: "URI" | "SLUG";
};

export type ProductArchiveLanguageRoute = ArchiveLanguageRoute;
export type ProductArchiveLanguageMetadata = ArchiveLanguageMetadata;
export type ProductArchiveRequestIdentifier = ArchiveRequestIdentifier;

export function resolveArchiveRequestIdentifier(
  current: ArchiveRequestIdentifier,
  archive: ArchiveLanguageMetadata | null,
  selectedLanguageCode: string,
): ArchiveRequestIdentifier {
  if (!archive?.languageCode) return current;
  const selectedLanguage = selectedLanguageCode.trim().toLowerCase();
  if (archive.languageCode.toLowerCase() === selectedLanguage) return current;

  const translation = archive.translations.find(
    ({ languageCode, uri }) => languageCode.toLowerCase() === selectedLanguage && Boolean(uri),
  );
  if (!translation) return current;
  return {
    identifier: toInternalUri(translation.uri),
    idType: "URI",
  };
}

export function resolveProductArchiveRequestIdentifier(
  current: ProductArchiveRequestIdentifier,
  archive: ProductArchiveLanguageMetadata | null,
  selectedLanguageCode: string,
): ProductArchiveRequestIdentifier {
  return resolveArchiveRequestIdentifier(current, archive, selectedLanguageCode);
}

function toInternalUri(uri: string): string {
  try {
    const parsed = new URL(uri, "https://storefront.invalid");
    return parsed.pathname || "/";
  } catch {
    return uri;
  }
}
