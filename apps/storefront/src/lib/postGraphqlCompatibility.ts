import { createCompatibleBlogDataQuery } from "./blogGraphqlCompatibility.ts";
import { removeGraphqlFieldSelections, type GraphqlCompatibilityRule } from "./graphqlFieldFallback.ts";

const malformedPostCommentsRule: GraphqlCompatibilityRule = {
  matches: (message, error) =>
    message.includes("Cannot access offset of type string on string")
    && error.path?.includes("comments") === true,
  transform: (query) => removeGraphqlFieldSelections(query, "comments"),
};

const malformedPostPolylangRule: GraphqlCompatibilityRule = {
  matches: (message, error) =>
    message.includes("Cannot access offset of type string on string")
    && error.path?.some((segment) => segment === "language" || segment === "translations") === true,
  transform: createCompatibleBlogDataQuery,
};

const malformedLanguageEnumRule: GraphqlCompatibilityRule = {
  matches: (message) =>
    message.includes("Expected a value of type LanguageCodeEnum but received: false")
    || message.includes("Cannot serialize value as enum: false"),
  transform: createCompatibleBlogDataQuery,
};

export const POST_GRAPHQL_COMPATIBILITY_RULES = [
  malformedPostCommentsRule,
  malformedPostPolylangRule,
  malformedLanguageEnumRule,
] as const;
