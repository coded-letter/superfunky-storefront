type NavigationGraphqlError = {
  message: string;
  extensions?: { debugMessage?: string };
};

const POLYLANG_RESOLVER_OFFSET_ERROR = "Cannot access offset of type string on string";

export function hasOnlyKnownNavigationResolverErrors(
  errors: NavigationGraphqlError[] | undefined,
): boolean {
  if (!errors?.length) return false;
  return errors.every(
    ({ extensions }) => extensions?.debugMessage === POLYLANG_RESOLVER_OFFSET_ERROR,
  );
}
