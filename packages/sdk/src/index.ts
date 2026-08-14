export type {
  ContentRevisionV1,
  StorefrontHydrationPayloadV1,
} from "@funky/shared";
export {
  BACKEND_ORIGIN,
  GRAPHQL_ENDPOINT,
  isBackendConfigured,
  restUrl,
  STOREFRONT_BACKEND_PROFILE,
  type StorefrontBackendProfile,
} from "./environment.ts";
export {
  graphqlRequest,
  hasOnlyMissingGraphqlFields,
  type GraphqlResponse,
} from "./graphqlClient.ts";
