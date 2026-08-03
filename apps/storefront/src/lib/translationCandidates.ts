/**
 * Raw shape of a translation-candidate search result node, as returned by the
 * `TRANSLATION_CANDIDATES_QUERY` GraphQL query.
 */
export type RawTranslationCandidateNode = {
  databaseId: number;
  title: string | null;
  uri: string | null;
  language: { code: string | null } | null;
};

export type TranslationCandidateResult = {
  databaseId: number;
  title: string;
  languageCode: string;
  uri: string;
};

/**
 * Filters raw translation-candidate search results client-side: excludes results with
 * no known language, results in the same language as the post being edited (a
 * translation must be in a *different* language), and the post itself (no
 * self-association). This mirrors — and is redundantly re-checked by — the backend's
 * own validation in `funkycommerce_associate_post_translation()` (see `inc/community.php`),
 * so an invalid selection can never slip through even if this client-side filter were
 * bypassed.
 */
export function filterTranslationCandidates(
  nodes: RawTranslationCandidateNode[],
  excludeLanguageCode: string,
  excludePostId?: number,
): TranslationCandidateResult[] {
  const excludeLower = excludeLanguageCode.toLowerCase();
  return nodes.flatMap((node) => {
    const languageCode = node.language?.code?.toLowerCase();
    if (!languageCode || languageCode === excludeLower) return [];
    if (excludePostId && node.databaseId === excludePostId) return [];
    return [{ databaseId: node.databaseId, title: node.title || `Post #${node.databaseId}`, languageCode, uri: node.uri || "" }];
  });
}
