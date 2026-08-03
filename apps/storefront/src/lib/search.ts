import type { SearchResultItem } from "@funky/ui";
import { graphqlRequest } from "./graphqlClient";

type SearchQueryResult = {
  products: { nodes: { id: string; name: string | null; uri: string | null }[] } | null;
  posts: { nodes: { id: string; title: string | null; uri: string | null }[] } | null;
  pages: { nodes: { id: string; title: string | null; uri: string | null }[] } | null;
  postCategories: { nodes: { id: string; name: string | null; uri: string | null }[] } | null;
  postTags: { nodes: { id: string; name: string | null; uri: string | null }[] } | null;
  productCategories: { nodes: { id: string; name: string | null; uri: string | null }[] } | null;
  productTags: { nodes: { id: string; name: string | null; uri: string | null }[] } | null;
};

const SEARCH_QUERY = /* GraphQL */ `
  query StorefrontSearch($search: String!, $language: LanguageCodeFilterEnum) {
    products(first: 6, where: { search: $search, language: $language }) {
      nodes { id name uri }
    }
    posts(first: 6, where: { search: $search, language: $language }) {
      nodes { id title uri }
    }
    pages(first: 4, where: { search: $search, language: $language }) {
      nodes { id title uri }
    }
    postCategories: categories(first: 4, where: { search: $search, language: $language }) {
      nodes { id name uri }
    }
    postTags: tags(first: 4, where: { search: $search, language: $language }) {
      nodes { id name uri }
    }
    productCategories(first: 4, where: { search: $search, language: $language }) {
      nodes { id name uri }
    }
    productTags(first: 4, where: { search: $search, language: $language }) {
      nodes { id name uri }
    }
  }
`;

export async function searchStorefront(
  query: string,
  languageCode: string,
  t: (key: string) => string = (key) => key,
): Promise<SearchResultItem[]> {
  const { data, errors } = await graphqlRequest<SearchQueryResult>(SEARCH_QUERY, {
    search: query,
    language: languageCode,
  });
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data) throw new Error("The storefront search returned no data");

  return [
    ...(data.products?.nodes || []).flatMap((node) =>
      node.name && node.uri
        ? [{ type: "product" as const, id: node.id, title: node.name, subtitle: t("search.type.product"), href: node.uri }]
        : [],
    ),
    ...(data.posts?.nodes || []).flatMap((node) =>
      node.title && node.uri
        ? [{ type: "post" as const, id: node.id, title: node.title, subtitle: t("search.type.post"), href: node.uri }]
        : [],
    ),
    ...(data.pages?.nodes || []).flatMap((node) =>
      node.title && node.uri
        ? [{ type: "page" as const, id: node.id, title: node.title, subtitle: t("search.type.page"), href: node.uri }]
        : [],
    ),
    ...mapArchiveResults(data.postCategories?.nodes, "category", t("search.type.post_category")),
    ...mapArchiveResults(data.postTags?.nodes, "tag", t("search.type.post_tag")),
    ...mapArchiveResults(data.productCategories?.nodes, "category", t("search.type.product_category")),
    ...mapArchiveResults(data.productTags?.nodes, "tag", t("search.type.product_tag")),
  ];
}

function mapArchiveResults(
  nodes: { id: string; name: string | null; uri: string | null }[] | undefined,
  type: "category" | "tag",
  subtitle: string,
): SearchResultItem[] {
  return (nodes || []).flatMap((node) =>
    node.name && node.uri ? [{ type, id: node.id, title: node.name, subtitle, href: node.uri }] : [],
  );
}
