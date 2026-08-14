import { hasOnlyMissingGraphqlFields } from "@funky/sdk";
import {
  missingGraphqlFieldRule,
  removeGraphqlFieldSelections,
  unsupportedRenderedFormatRule,
  type GraphqlCompatibilityRule,
} from "./graphqlFieldFallback.ts";

export function createCompatibleBlogDataQuery(query: string): string {
  return removeGraphqlFieldSelections(
    removeGraphqlFieldSelections(query, "language"),
    "translations",
  )
    .replace(/\(\s*\$language:\s*LanguageCodeFilterEnum!\s*,\s*/g, "(")
    .replace(/,\s*\$language:\s*LanguageCodeFilterEnum!\s*(?=\))/g, "")
    .replace(/\(\s*\$language:\s*LanguageCodeFilterEnum!\s*\)/g, "")
    .replace(/,\s*language:\s*(?:\$language|ALL)\b/g, "")
    .replace(/\blanguage:\s*(?:\$language|ALL)\s*,\s*/g, "")
    .replace(/\blanguage:\s*(?:\$language|ALL)\b/g, "")
    .replace(/,\s*where:\s*\{\s*\}/g, "");
}

const polylangRule: GraphqlCompatibilityRule = {
  matches: (message) =>
    message.includes("Cannot access offset of type string on string")
    || hasOnlyMissingGraphqlFields([{ message }], ["language", "translations"]),
  transform: createCompatibleBlogDataQuery,
};

const malformedPublishedStatusRule: GraphqlCompatibilityRule = {
  matches: (message) => message.includes("Cannot access offset of type string on string"),
  transform: (query) => {
    const compatibleQuery = query
      .replace(/status:\s*PUBLISH\s*,\s*/g, "")
      .replace(/,\s*status:\s*PUBLISH/g, "")
      .replace(/status:\s*PUBLISH/g, "")
      .replace(/(categories|tags)\(first:\s*100,\s*where:\s*\{[^{}]*\}\)/g, "$1(first: 100)");
    return removeGraphqlFieldSelections(compatibleQuery, "comments");
  },
};

export const BLOG_DATA_COMPATIBILITY_RULES = [
  polylangRule,
  malformedPublishedStatusRule,
  missingGraphqlFieldRule("seo"),
  unsupportedRenderedFormatRule,
] as const;
