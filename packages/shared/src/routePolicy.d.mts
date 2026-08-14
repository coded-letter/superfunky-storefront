export const PUBLIC_ARTIFACT_VARIANT: "public";
export const PRIVATE_DOCUMENT_PREFIXES: readonly string[];
export const DOCUMENT_BYPASS_PREFIXES: readonly string[];

export type StorefrontRequestDescriptor = {
  target: string;
  localeCodes: readonly string[];
  method?: string;
  authenticated?: boolean;
  preview?: boolean;
  visibility?: "public" | "private" | "bypass";
};

export type StorefrontRequestDecision =
  | {
      kind: "public-artifact";
      reason: "public-document";
      normalizedPath: string;
    }
  | {
      kind: "private-document";
      reason: "authenticated" | "preview" | "private-route";
      normalizedPath: string | null;
    }
  | {
      kind: "bypass";
      reason: "method" | "invalid-route" | "query" | "non-document";
      normalizedPath: string | null;
    };

export function normalizePublicRoutePath(input: unknown): string | null;
export function classifyStorefrontRequest(
  request: StorefrontRequestDescriptor,
): StorefrontRequestDecision;
