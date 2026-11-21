export type {
  ContentRevisionV1,
  StorefrontHydrationPayloadV1,
} from "@funky/shared";
export {
  BACKEND_ORIGIN,
  BACKEND_BASE_URL,
  BACKEND_BASE_PATH,
  backendPathFromUrl,
  backendUrl,
  GRAPHQL_ENDPOINT,
  isBackendConfigured,
  restUrl,
  STOREFRONT_BACKEND_PROFILE,
  STOREFRONT_DEFAULT_LANGUAGE,
  STOREFRONT_EXPECTED_LOCALES,
  type StorefrontBackendProfile,
} from "./environment.ts";
export {
  graphqlRequest,
  hasOnlyMissingGraphqlFields,
  type GraphqlResponse,
} from "./graphqlClient.ts";
export { invalidateIncrementalDataPrefix } from "./incrementalData.ts";
