type LocalizedNode = {
  uri?: string | null;
  language?: { code?: string | null } | null;
};

export function filterLocalizedBlogNodes<T extends LocalizedNode>(
  nodes: T[],
  languageCode: string,
): T[] {
  const normalizedLanguage = languageCode.trim().toLowerCase();
  const explicitLanguages = nodes.some((node) => node.language?.code);
  if (explicitLanguages) {
    return nodes.filter(
      (node) => node.language?.code?.trim().toLowerCase() === normalizedLanguage,
    );
  }
  const requestedPrefix = `/${normalizedLanguage}/`;
  const hasRequestedPrefix = nodes.some((node) =>
    node.uri?.toLowerCase().startsWith(requestedPrefix),
  );
  return nodes.filter((node) => {
    const uri = node.uri?.toLowerCase() || "";
    return hasRequestedPrefix
      ? uri.startsWith(requestedPrefix)
      : !/^\/[a-z]{2}(?:\/|$)/.test(uri);
  });
}
