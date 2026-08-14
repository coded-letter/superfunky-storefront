import { hasOnlyMissingGraphqlFields } from "@funky/sdk";

export const SEARCH_QUERY = /* GraphQL */ `
  query StorefrontSearch($search: String!, $language: LanguageCodeFilterEnum) {
    products(first: 6, where: { search: $search, language: $language }) {
      nodes { id name uri slug }
    }
    posts(first: 6, where: { search: $search, language: $language }) {
      nodes { id title uri slug }
    }
    pages(first: 4, where: { search: $search, language: $language }) {
      nodes { id title uri slug }
    }
    postCategories: categories(first: 4, where: { search: $search, language: $language }) {
      nodes { id name uri slug }
    }
    postTags: tags(first: 4, where: { search: $search, language: $language }) {
      nodes { id name uri slug }
    }
    productCategories(first: 4, where: { search: $search, language: $language }) {
      nodes { id name uri slug }
    }
    productTags(first: 4, where: { search: $search, language: $language }) {
      nodes { id name uri slug }
    }
    productBrands(first: 4, where: { search: $search, hideEmpty: true }) {
      nodes { id name uri slug }
    }
    authors: users(first: 6, where: { search: $search, hasPublishedPosts: POST }) {
      nodes { id databaseId name slug uri }
    }
    communityPosts(first: 6, where: { search: $search, status: PUBLISH, language: $language }) {
      nodes { id databaseId title uri slug }
    }
    communityTags(first: 4, where: { search: $search, hideEmpty: true, language: $language }) {
      nodes { id name uri slug }
    }
    communityMembers(search: $search, first: 6) {
      databaseId
      name
      communityHandle
      description
      communityProfilePublic
    }
  }
`;

export const LEGACY_SEARCH_QUERY = SEARCH_QUERY.replace(
  "communityMembers(search: $search, first: 6)",
  "communityMembers",
);

export const COMPATIBLE_SEARCH_QUERY = /* GraphQL */ `
  query StorefrontSearchCompatible($search: String!) {
    posts(first: 6, where: { search: $search }) {
      nodes { id title uri slug }
    }
    pages(first: 4, where: { search: $search }) {
      nodes { id title uri slug }
    }
    postCategories: categories(first: 4, where: { search: $search }) {
      nodes { id name uri slug }
    }
    postTags: tags(first: 4, where: { search: $search }) {
      nodes { id name uri slug }
    }
    authors: users(first: 6, where: { search: $search, hasPublishedPosts: POST }) {
      nodes { id databaseId name slug uri }
    }
    communityPosts(first: 6, where: { search: $search, status: PUBLISH }) {
      nodes { id databaseId title uri slug }
    }
    communityTags(first: 4, where: { search: $search, hideEmpty: true }) {
      nodes { id name uri slug }
    }
    communityMembers(search: $search, first: 6) {
      databaseId
      name
      communityHandle
      description
      communityProfilePublic
    }
  }
`;

export function isLegacyCommunityMemberSearchSchema(errors: { message: string }[] | undefined): boolean {
  return Boolean(
    errors?.length
    && errors.every(({ message }) =>
      message.includes("communityMembers")
      && message.includes("Unknown argument")
      && (message.includes('"search"') || message.includes('"first"')),
    ),
  );
}

export function isSearchCompatibilitySchemaError(errors: { message: string }[] | undefined): boolean {
  return hasOnlyMissingGraphqlFields(errors, [
    "products",
    "productCategories",
    "productTags",
    "productBrands",
    "language",
  ]) || Boolean(
    errors?.length
    && errors.every(({ message }) =>
      message.includes('Unknown type "LanguageCodeFilterEnum"')
      || message.includes('Field "language" is not defined by type')
      || message.includes('Cannot query field "products"')
      || message.includes('Cannot query field "productCategories"')
      || message.includes('Cannot query field "productTags"')
      || message.includes('Cannot query field "productBrands"')
      || message.includes('Field "language" is not defined by type "RootQueryToCommunityPostConnectionWhereArgs"')
      || message.includes('Field "language" is not defined by type "RootQueryToCommunityTagConnectionWhereArgs"'),
    ),
  );
}
