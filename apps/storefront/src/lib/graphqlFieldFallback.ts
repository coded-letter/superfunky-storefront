import type { GraphqlResponse } from "@funky/sdk";

export type GraphqlFieldFallbackRequester = <T>(
  query: string,
  variables?: Record<string, unknown>,
) => Promise<GraphqlResponse<T>>;

export type GraphqlCompatibilityRule = {
  matches: (
    message: string,
    error: NonNullable<GraphqlResponse<unknown>["errors"]>[number],
  ) => boolean;
  transform: (query: string) => string;
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function removeGraphqlFieldSelections(query: string, fieldName: string): string {
  const fieldPattern = new RegExp(`^[\\t ]*${escapeRegExp(fieldName)}\\b`, "m");
  let result = query;

  while (true) {
    const match = fieldPattern.exec(result);
    if (!match) return result;

    const lineStart = match.index;
    let parenthesisDepth = 0;
    let openingBrace = -1;
    let fieldEnd = result.length;
    for (let index = match.index + match[0].length; index < result.length; index += 1) {
      if (result[index] === "(") parenthesisDepth += 1;
      if (result[index] === ")") parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      if (result[index] === "{" && parenthesisDepth === 0) {
        openingBrace = index;
        break;
      }

      if (result[index] === "\n" && parenthesisDepth === 0) {
        fieldEnd = index + 1;
        break;
      }
    }

    if (openingBrace === -1) {
      result = result.slice(0, lineStart) + result.slice(fieldEnd);
      continue;
    }

    let depth = 0;
    let closingBrace = -1;
    for (let index = openingBrace; index < result.length; index += 1) {
      if (result[index] === "{") depth += 1;
      if (result[index] === "}") {
        depth -= 1;
        if (depth === 0) {
          closingBrace = index;
          break;
        }
      }
    }
    if (closingBrace === -1) {
      throw new Error(`Cannot remove unterminated GraphQL field selection: ${fieldName}`);
    }

    const remainderOfLine = result.slice(closingBrace + 1, result.indexOf("\n", closingBrace + 1) === -1
      ? result.length
      : result.indexOf("\n", closingBrace + 1));
    if (remainderOfLine.trim()) {
      result = `${result.slice(0, lineStart)}${result.slice(closingBrace + 1)}`;
      continue;
    }
    const nextLine = result.indexOf("\n", closingBrace + 1);
    result = result.slice(0, lineStart) + result.slice(nextLine === -1 ? result.length : nextLine + 1);
  }
}

export function removeNestedGraphqlFieldSelections(
  query: string,
  parentFieldName: string,
  fieldName: string,
): string {
  const parentPattern = new RegExp(`^[\\t ]*${escapeRegExp(parentFieldName)}\\b`, "gm");
  let result = query;
  let match: RegExpExecArray | null;

  while ((match = parentPattern.exec(result))) {
    let parenthesisDepth = 0;
    let openingBrace = -1;
    for (let index = match.index + match[0].length; index < result.length; index += 1) {
      if (result[index] === "(") parenthesisDepth += 1;
      if (result[index] === ")") parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      if (result[index] === "{" && parenthesisDepth === 0) {
        openingBrace = index;
        break;
      }
      if (result[index] === "\n" && parenthesisDepth === 0) break;
    }
    if (openingBrace === -1) continue;

    let depth = 0;
    let closingBrace = -1;
    for (let index = openingBrace; index < result.length; index += 1) {
      if (result[index] === "{") depth += 1;
      if (result[index] === "}") {
        depth -= 1;
        if (depth === 0) {
          closingBrace = index;
          break;
        }
      }
    }
    if (closingBrace === -1) {
      throw new Error(`Cannot inspect unterminated GraphQL field selection: ${parentFieldName}`);
    }

    const selection = result.slice(openingBrace + 1, closingBrace);
    const compatibleSelection = removeGraphqlFieldSelections(selection, fieldName);
    if (compatibleSelection === selection) {
      parentPattern.lastIndex = closingBrace + 1;
      continue;
    }
    result = `${result.slice(0, openingBrace + 1)}${compatibleSelection}${result.slice(closingBrace)}`;
    parentPattern.lastIndex = openingBrace + compatibleSelection.length + 2;
  }

  return result;
}

export function missingGraphqlFieldRule(fieldName: string): GraphqlCompatibilityRule {
  const normalizedFieldName = fieldName.toLowerCase();
  return {
    matches: (message) => {
      const normalizedMessage = message.toLowerCase();
      return normalizedMessage.includes(`cannot query field "${normalizedFieldName}"`)
        || normalizedMessage.includes(`field "${normalizedFieldName}" is not defined by type`)
        || normalizedMessage.includes(`unknown argument "${normalizedFieldName}"`)
        || normalizedMessage.includes(`unknown type "${normalizedFieldName}"`);
    },
    transform: (query) => removeGraphqlFieldSelections(query, fieldName),
  };
}

export const unsupportedRenderedFormatRule: GraphqlCompatibilityRule = {
  matches: (message) => /Unknown argument "format"/i.test(message),
  transform: (query) => query.replace(/\(\s*format:\s*RENDERED\s*\)/g, ""),
};

export async function requestGraphqlWithCompatibility<T>(
  request: GraphqlFieldFallbackRequester,
  query: string,
  variables: Record<string, unknown>,
  rules: readonly GraphqlCompatibilityRule[],
): Promise<GraphqlResponse<T>> {
  let compatibleQuery = query;
  let response = await request<T>(compatibleQuery, variables);
  const ruleMatchesError = (
    rule: GraphqlCompatibilityRule,
    error: NonNullable<GraphqlResponse<unknown>["errors"]>[number],
  ): boolean => rule.matches(error.message, error)
    || Boolean(error.extensions?.debugMessage && rule.matches(error.extensions.debugMessage, error));

  for (let attempt = 0; response.errors?.length && attempt < rules.length; attempt += 1) {
    const matchingRules = rules.filter((rule) =>
      response.errors?.some((error) => ruleMatchesError(rule, error)),
    );
    if (
      matchingRules.length === 0
      || !response.errors.every((error) => matchingRules.some((rule) => ruleMatchesError(rule, error)))
    ) {
      return response;
    }

    const nextQuery = matchingRules.reduce(
      (currentQuery, rule) => rule.transform(currentQuery),
      compatibleQuery,
    );
    if (nextQuery === compatibleQuery) return response;
    compatibleQuery = nextQuery;
    response = await request<T>(compatibleQuery, variables);
  }

  return response;
}
