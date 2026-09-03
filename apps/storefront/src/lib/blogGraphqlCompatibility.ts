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
    .replace(/,\s*where:\s*\{\s*\}/g, "")
    .replace(/posts\(first:\s*20\b/g, "posts(first: 100");
}

const polylangRule: GraphqlCompatibilityRule = {
  matches: (message, error) =>
    (
      (
        message === "Internal server error"
        || message.includes("Cannot access offset of type string on string")
      )
      && error.path?.some((segment) => segment === "language" || segment === "translations") === true
    )
    || hasOnlyMissingGraphqlFields([{ message }], ["language", "translations"]),
  transform: createCompatibleBlogDataQuery,
};

const malformedPublishedStatusRule: GraphqlCompatibilityRule = {
  matches: (message, error) =>
    message.includes("Cannot access offset of type string on string")
    && error.path?.some((segment) => segment === "status" || segment === "categories" || segment === "tags") === true,
  transform: (query) => {
    return query
      .replace(/status:\s*PUBLISH\s*,\s*/g, "")
      .replace(/,\s*status:\s*PUBLISH/g, "")
      .replace(/status:\s*PUBLISH/g, "")
      .replace(/(categories|tags)\(first:\s*100,\s*where:\s*\{[^{}]*\}\)/g, "$1(first: 100)");
  },
};

const malformedCommentsRule: GraphqlCompatibilityRule = {
  matches: (message, error) =>
    message.includes("Cannot access offset of type string on string")
    && error.path?.includes("comments") === true,
  transform: (query) => removeGraphqlFieldSelections(query, "comments"),
};

const nullAvatarRule: GraphqlCompatibilityRule = {
  matches: (message, error) =>
    message.toLowerCase().includes("cannot return null for non-nullable field")
    && error.path?.some((segment) => segment === "avatar" || segment === "url") === true,
  transform: (query) => removeGraphqlFieldSelections(query, "avatar"),
};

export const BLOG_DATA_COMPATIBILITY_RULES = [
  polylangRule,
  malformedPublishedStatusRule,
  malformedCommentsRule,
  nullAvatarRule,
  missingGraphqlFieldRule("seo"),
  unsupportedRenderedFormatRule,
] as const;
