const OPTIONAL_LOGIN_PAYLOAD_FIELDS = new Set([
  "cartToken",
  "customer",
  "sessionToken",
]);

export type LoginGraphqlError = {
  message: string;
};

function getUnsupportedLoginPayloadFields(
  errors: readonly LoginGraphqlError[] | null | undefined,
): string[] | null {
  if (!errors?.length) return null;
  const fields = errors.map(({ message }) => {
    const match = message.match(
      /^Cannot query field "([^"]+)" on type "LoginPayload"\./,
    );
    return match && OPTIONAL_LOGIN_PAYLOAD_FIELDS.has(match[1]) ? match[1] : null;
  });
  return fields.every((field): field is string => field !== null) ? fields : null;
}

export function hasOnlyLoginPayloadCompatibilityErrors(
  errors: readonly LoginGraphqlError[] | null | undefined,
): boolean {
  return getUnsupportedLoginPayloadFields(errors) !== null;
}

export function omitUnsupportedLoginPayloadFields(
  query: string,
  errors: readonly LoginGraphqlError[] | null | undefined,
): string | null {
  const unsupportedFields = getUnsupportedLoginPayloadFields(errors);
  if (!unsupportedFields) return null;
  return unsupportedFields.reduce((compatibleQuery, field) => {
    if (field === "customer") {
      return compatibleQuery.replace(/\n\s*customer\s*\{[^{}]*\}/, "");
    }
    return compatibleQuery.replace(new RegExp(`\\n[^\\S\\n]*${field}[^\\S\\n]*`), "");
  }, query);
}
