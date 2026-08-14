import {
  normalizePublicRoutePath,
  PUBLIC_ARTIFACT_VARIANT,
} from "./routePolicy.mjs";

export const ARTIFACT_SCHEMA_VERSION = 1 as const;
export const SHELL_SCHEMA_VERSION = 1 as const;
export const REVISION_SCHEMA_VERSION = 1 as const;
export const CHANGE_EVENT_SCHEMA_VERSION = 1 as const;
export const HYDRATION_SCHEMA_VERSION = 1 as const;

export const ARTIFACT_SIGNATURE_HEADERS = Object.freeze({
  signature: "x-superfunky-signature",
  timestamp: "x-superfunky-timestamp",
  eventId: "x-superfunky-event-id",
});

export const SHELL_TEMPLATE_SLOTS = Object.freeze({
  head: "<!--storefront-artifact-head-->",
  routeCss: "<!--storefront-artifact-css-->",
  content: "<!--storefront-artifact-content-->",
  payload: "<!--storefront-artifact-payload-->",
});

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ArtifactState = "ready" | "stale" | "generating" | "failed" | "tombstone";
export type PublicArtifactVariant = typeof PUBLIC_ARTIFACT_VARIANT;

export type ArtifactIdentity = {
  siteKey: string;
  locale: string;
  route: string;
  shellVersion: string;
  variant: PublicArtifactVariant;
};

export type ShellAsset = {
  kind: "script" | "style" | "modulepreload" | "asset";
  url: string;
  integrity?: string;
  crossOrigin?: "anonymous" | "use-credentials";
};

export type ShellSeedRoute = {
  route: string;
  locale: string;
};

export type StorefrontShellManifestV1 = {
  schemaVersion: typeof SHELL_SCHEMA_VERSION;
  artifactSchemaVersion: typeof ARTIFACT_SCHEMA_VERSION;
  siteKey: string;
  shellVersion: string;
  builtAt: string;
  contentHash: string;
  template: string;
  assets: ShellAsset[];
  seedRoutes?: ShellSeedRoute[];
};

export type HydrationSeedEntry = {
  cacheKey: string;
  value: JsonValue;
  dependencies: string[];
};

export type StorefrontHydrationPayloadV1 = {
  schemaVersion: typeof HYDRATION_SCHEMA_VERSION;
  shellVersion: string;
  contentRevision: number;
  generatedAt: string;
  expiresAt: string;
  entries: HydrationSeedEntry[];
};

export type ArtifactSeo = {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  structuredData: JsonValue[];
};

export type ArtifactFailure = {
  code: string;
  message: string;
  retryable: boolean;
  failedAt: string;
};

export type RouteArtifactV1 = {
  schemaVersion: typeof ARTIFACT_SCHEMA_VERSION;
  identity: ArtifactIdentity;
  state: ArtifactState;
  statusCode: number;
  redirectTo: string | null;
  sourceRevision: number;
  generatedAt: string;
  validatedAt: string;
  contentHash: string;
  etag: string;
  documentHtml: string;
  semanticHtml: string;
  routeCss: string;
  seo: ArtifactSeo;
  hydration: StorefrontHydrationPayloadV1;
  dependencies: string[];
  failure: ArtifactFailure | null;
};

export type ContentRevisionV1 = {
  schemaVersion: typeof REVISION_SCHEMA_VERSION;
  siteKey: string;
  revision: number;
  changedAt: string;
  dependencies: string[];
  etag: string;
};

export type ArtifactChangeEventV1 = {
  schemaVersion: typeof CHANGE_EVENT_SCHEMA_VERSION;
  eventId: string;
  siteKey: string;
  revision: number;
  occurredAt: string;
  reason: string;
  dependencies: string[];
};

export type ArtifactGenerationResult =
  | {
      ok: true;
      identity: ArtifactIdentity;
      revision: number;
      contentHash: string;
      changed: boolean;
      generatedAt: string;
    }
  | {
      ok: false;
      identity: ArtifactIdentity;
      revision: number;
      failure: ArtifactFailure;
    };

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

const SITE_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ETAG_PATTERN = /^(?:W\/)?"[^"\r\n]{1,256}"$/;
const SIMPLE_DEPENDENCY_VALUE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,190}$/;
const DEPENDENCY_KINDS = new Set([
  "archive",
  "author",
  "community",
  "config",
  "media",
  "menu",
  "page",
  "post",
  "product",
  "redirect",
  "route",
  "site",
  "sitemap",
  "term",
  "theme",
  "translation",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 32) return false;
  if (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1));
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => isJsonValue(item, depth + 1));
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T/.test(value)
    && Number.isFinite(Date.parse(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function hasExactlyOneSlot(template: string, slot: string): boolean {
  return template.split(slot).length === 2;
}

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

function validateSchemaVersion(
  input: Record<string, unknown>,
  expected: number,
  issues: ValidationIssue[],
  path = "schemaVersion",
): void {
  if (input.schemaVersion !== expected) {
    issues.push(issue(path, `Expected schema version ${expected}.`));
  }
}

function validateSiteKey(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || !SITE_KEY_PATTERN.test(value)) {
    issues.push(issue(path, "Expected a lowercase site key."));
  }
}

function validateVersion(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || !VERSION_PATTERN.test(value)) {
    issues.push(issue(path, "Expected a bounded version identifier."));
  }
}

function validateHash(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    issues.push(issue(path, "Expected a lowercase sha256 content hash."));
  }
}

function validateEtag(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || !ETAG_PATTERN.test(value)) {
    issues.push(issue(path, "Expected a quoted HTTP entity tag."));
  }
}

export function isDependencyTag(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 256 || /[\u0000-\u0020\u007f]/.test(value)) {
    return false;
  }
  const separator = value.indexOf(":");
  if (separator <= 0) return false;
  const kind = value.slice(0, separator);
  const identifier = value.slice(separator + 1);
  if (!DEPENDENCY_KINDS.has(kind) || !identifier) return false;

  if (kind === "route") {
    return normalizePublicRoutePath(identifier) === identifier;
  }
  if (kind === "term") {
    const parts = identifier.split(":");
    return parts.length === 2 && parts.every((part) => SIMPLE_DEPENDENCY_VALUE.test(part));
  }
  return SIMPLE_DEPENDENCY_VALUE.test(identifier);
}

function validateDependencies(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!Array.isArray(value)) {
    issues.push(issue(path, "Expected an array of dependency tags."));
    return;
  }
  const seen = new Set<string>();
  value.forEach((dependency, index) => {
    if (!isDependencyTag(dependency)) {
      issues.push(issue(`${path}[${index}]`, "Invalid dependency tag."));
    } else if (seen.has(dependency)) {
      issues.push(issue(`${path}[${index}]`, "Duplicate dependency tag."));
    } else {
      seen.add(dependency);
    }
  });
}

function collectArtifactIdentityIssues(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    issues.push(issue(path, "Expected an artifact identity object."));
    return;
  }
  validateSiteKey(value.siteKey, `${path}.siteKey`, issues);
  if (typeof value.locale !== "string" || !LOCALE_PATTERN.test(value.locale)) {
    issues.push(issue(`${path}.locale`, "Expected a normalized locale."));
  }
  if (
    typeof value.route !== "string"
    || normalizePublicRoutePath(value.route) !== value.route
  ) {
    issues.push(issue(`${path}.route`, "Expected a normalized public route."));
  }
  validateVersion(value.shellVersion, `${path}.shellVersion`, issues);
  if (value.variant !== PUBLIC_ARTIFACT_VARIANT) {
    issues.push(issue(`${path}.variant`, "Only the public artifact variant is supported."));
  }
}

export function validateArtifactIdentity(
  input: unknown,
): ValidationResult<ArtifactIdentity> {
  const issues: ValidationIssue[] = [];
  collectArtifactIdentityIssues(input, "identity", issues);
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: input as ArtifactIdentity };
}

export function createArtifactIdentityKey(identity: ArtifactIdentity): string {
  const result = validateArtifactIdentity(identity);
  if (!result.ok) {
    throw new TypeError(result.issues.map(({ path, message }) => `${path}: ${message}`).join("; "));
  }
  return [
    identity.siteKey,
    identity.locale,
    identity.shellVersion,
    identity.variant,
    identity.route,
  ].map(encodeURIComponent).join("|");
}

function validateHydration(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    issues.push(issue(path, "Expected a hydration payload object."));
    return;
  }
  validateSchemaVersion(value, HYDRATION_SCHEMA_VERSION, issues, `${path}.schemaVersion`);
  validateVersion(value.shellVersion, `${path}.shellVersion`, issues);
  if (!isNonNegativeInteger(value.contentRevision)) {
    issues.push(issue(`${path}.contentRevision`, "Expected a non-negative revision."));
  }
  if (!isIsoDate(value.generatedAt)) {
    issues.push(issue(`${path}.generatedAt`, "Expected an ISO timestamp."));
  }
  if (!isIsoDate(value.expiresAt)) {
    issues.push(issue(`${path}.expiresAt`, "Expected an ISO timestamp."));
  }
  if (
    isIsoDate(value.generatedAt)
    && isIsoDate(value.expiresAt)
    && Date.parse(value.expiresAt) < Date.parse(value.generatedAt)
  ) {
    issues.push(issue(`${path}.expiresAt`, "Expiration cannot precede generation."));
  }
  if (!Array.isArray(value.entries)) {
    issues.push(issue(`${path}.entries`, "Expected hydration seed entries."));
    return;
  }
  const keys = new Set<string>();
  value.entries.forEach((entry, index) => {
    const entryPath = `${path}.entries[${index}]`;
    if (!isRecord(entry)) {
      issues.push(issue(entryPath, "Expected a hydration seed entry."));
      return;
    }
    if (typeof entry.cacheKey !== "string" || !entry.cacheKey.trim() || entry.cacheKey.length > 256) {
      issues.push(issue(`${entryPath}.cacheKey`, "Expected a bounded cache key."));
    } else if (keys.has(entry.cacheKey)) {
      issues.push(issue(`${entryPath}.cacheKey`, "Duplicate hydration cache key."));
    } else {
      keys.add(entry.cacheKey);
    }
    if (!Object.hasOwn(entry, "value") || !isJsonValue(entry.value)) {
      issues.push(issue(`${entryPath}.value`, "Expected a JSON seed value."));
    }
    validateDependencies(entry.dependencies, `${entryPath}.dependencies`, issues);
  });
}

export function validateStorefrontHydrationPayload(
  input: unknown,
): ValidationResult<StorefrontHydrationPayloadV1> {
  const issues: ValidationIssue[] = [];
  validateHydration(input, "$", issues);
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: input as StorefrontHydrationPayloadV1 };
}

function validateSeo(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(path, "Expected SEO metadata."));
    return;
  }
  for (const key of ["title", "description", "robots"] as const) {
    if (typeof value[key] !== "string") {
      issues.push(issue(`${path}.${key}`, "Expected a string."));
    }
  }
  if (!isHttpsUrl(value.canonicalUrl)) {
    issues.push(issue(`${path}.canonicalUrl`, "Expected a credential-free HTTPS URL."));
  }
  if (
    !Array.isArray(value.structuredData)
    || !value.structuredData.every((entry) => isJsonValue(entry))
  ) {
    issues.push(issue(`${path}.structuredData`, "Expected a structured-data array."));
  }
}

function validateFailure(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(path, "Expected failure metadata."));
    return;
  }
  if (typeof value.code !== "string" || !VERSION_PATTERN.test(value.code)) {
    issues.push(issue(`${path}.code`, "Expected a bounded failure code."));
  }
  if (typeof value.message !== "string" || !value.message.trim() || value.message.length > 500) {
    issues.push(issue(`${path}.message`, "Expected a bounded sanitized message."));
  }
  if (typeof value.retryable !== "boolean") {
    issues.push(issue(`${path}.retryable`, "Expected a boolean."));
  }
  if (!isIsoDate(value.failedAt)) {
    issues.push(issue(`${path}.failedAt`, "Expected an ISO timestamp."));
  }
}

export function validateStorefrontShellManifest(
  input: unknown,
): ValidationResult<StorefrontShellManifestV1> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: [issue("$", "Expected a shell manifest object.")] };
  }
  validateSchemaVersion(input, SHELL_SCHEMA_VERSION, issues);
  if (input.artifactSchemaVersion !== ARTIFACT_SCHEMA_VERSION) {
    issues.push(issue("artifactSchemaVersion", `Expected artifact schema version ${ARTIFACT_SCHEMA_VERSION}.`));
  }
  validateSiteKey(input.siteKey, "siteKey", issues);
  validateVersion(input.shellVersion, "shellVersion", issues);
  if (!isIsoDate(input.builtAt)) issues.push(issue("builtAt", "Expected an ISO timestamp."));
  validateHash(input.contentHash, "contentHash", issues);
  if (typeof input.template !== "string" || input.template.length === 0) {
    issues.push(issue("template", "Expected a shell HTML template."));
  } else {
    Object.entries(SHELL_TEMPLATE_SLOTS).forEach(([name, slot]) => {
      if (!hasExactlyOneSlot(input.template as string, slot)) {
        issues.push(issue("template", `Expected exactly one ${name} insertion slot.`));
      }
    });
  }
  if (!Array.isArray(input.assets)) {
    issues.push(issue("assets", "Expected a shell asset array."));
  } else {
    input.assets.forEach((asset, index) => {
      const path = `assets[${index}]`;
      if (!isRecord(asset)) {
        issues.push(issue(path, "Expected a shell asset."));
        return;
      }
      if (!["script", "style", "modulepreload", "asset"].includes(String(asset.kind))) {
        issues.push(issue(`${path}.kind`, "Unsupported shell asset kind."));
      }
      if (
        typeof asset.url !== "string"
        || (!asset.url.startsWith("/") && !isHttpsUrl(asset.url))
      ) {
        issues.push(issue(`${path}.url`, "Expected a root-relative or HTTPS asset URL."));
      }
      if (
        asset.crossOrigin !== undefined
        && asset.crossOrigin !== "anonymous"
        && asset.crossOrigin !== "use-credentials"
      ) {
        issues.push(issue(`${path}.crossOrigin`, "Unsupported cross-origin mode."));
      }
    });
  }
  if (input.seedRoutes !== undefined) {
    if (!Array.isArray(input.seedRoutes) || input.seedRoutes.length > 10_000) {
      issues.push(issue("seedRoutes", "Expected at most 10000 seed routes."));
    } else {
      const identities = new Set<string>();
      input.seedRoutes.forEach((seed, index) => {
        const path = `seedRoutes[${index}]`;
        if (!isRecord(seed)) {
          issues.push(issue(path, "Expected a seed route."));
          return;
        }
        const route = normalizePublicRoutePath(seed.route);
        if (route === null || route !== seed.route) {
          issues.push(issue(`${path}.route`, "Expected a normalized public route."));
        }
        if (typeof seed.locale !== "string" || !LOCALE_PATTERN.test(seed.locale)) {
          issues.push(issue(`${path}.locale`, "Expected a normalized locale."));
        }
        const identity = `${seed.locale}|${seed.route}`;
        if (identities.has(identity)) {
          issues.push(issue(path, "Duplicate seed route identity."));
        }
        identities.add(identity);
      });
    }
  }
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: input as StorefrontShellManifestV1 };
}

export function validateRouteArtifact(input: unknown): ValidationResult<RouteArtifactV1> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: [issue("$", "Expected a route artifact object.")] };
  }
  validateSchemaVersion(input, ARTIFACT_SCHEMA_VERSION, issues);
  collectArtifactIdentityIssues(input.identity, "identity", issues);
  if (!["ready", "stale", "generating", "failed", "tombstone"].includes(String(input.state))) {
    issues.push(issue("state", "Unsupported artifact state."));
  }
  if (!Number.isInteger(input.statusCode) || Number(input.statusCode) < 200 || Number(input.statusCode) > 599) {
    issues.push(issue("statusCode", "Expected a valid HTTP status code."));
  }
  if (input.redirectTo !== null && !isHttpsUrl(input.redirectTo)) {
    issues.push(issue("redirectTo", "Expected null or a credential-free HTTPS URL."));
  }
  if (
    Number(input.statusCode) >= 300
    && Number(input.statusCode) < 400
    && input.redirectTo === null
  ) {
    issues.push(issue("redirectTo", "Redirect artifacts require a destination."));
  }
  if (
    input.state === "tombstone"
    && input.statusCode !== 404
    && input.statusCode !== 410
  ) {
    issues.push(issue("statusCode", "Tombstones must return 404 or 410."));
  }
  if (!isNonNegativeInteger(input.sourceRevision)) {
    issues.push(issue("sourceRevision", "Expected a non-negative revision."));
  }
  if (!isIsoDate(input.generatedAt)) issues.push(issue("generatedAt", "Expected an ISO timestamp."));
  if (!isIsoDate(input.validatedAt)) issues.push(issue("validatedAt", "Expected an ISO timestamp."));
  validateHash(input.contentHash, "contentHash", issues);
  validateEtag(input.etag, "etag", issues);
  for (const key of ["documentHtml", "semanticHtml", "routeCss"] as const) {
    if (typeof input[key] !== "string") issues.push(issue(key, "Expected a string."));
  }
  validateSeo(input.seo, "seo", issues);
  validateHydration(input.hydration, "hydration", issues);
  validateDependencies(input.dependencies, "dependencies", issues);
  if (input.failure !== null) validateFailure(input.failure, "failure", issues);
  if (input.state === "failed" && input.failure === null) {
    issues.push(issue("failure", "Failed artifacts require failure metadata."));
  }
  if (input.state !== "failed" && input.failure !== null) {
    issues.push(issue("failure", "Only failed artifacts may include failure metadata."));
  }
  if (
    isRecord(input.identity)
    && isRecord(input.hydration)
    && input.identity.shellVersion !== input.hydration.shellVersion
  ) {
    issues.push(issue("hydration.shellVersion", "Hydration and artifact shell versions must match."));
  }
  if (
    isRecord(input.hydration)
    && input.sourceRevision !== input.hydration.contentRevision
  ) {
    issues.push(issue("hydration.contentRevision", "Hydration and artifact revisions must match."));
  }
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: input as RouteArtifactV1 };
}

export function validateContentRevision(input: unknown): ValidationResult<ContentRevisionV1> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: [issue("$", "Expected a content revision object.")] };
  }
  validateSchemaVersion(input, REVISION_SCHEMA_VERSION, issues);
  validateSiteKey(input.siteKey, "siteKey", issues);
  if (!isNonNegativeInteger(input.revision)) {
    issues.push(issue("revision", "Expected a non-negative revision."));
  }
  if (!isIsoDate(input.changedAt)) issues.push(issue("changedAt", "Expected an ISO timestamp."));
  validateDependencies(input.dependencies, "dependencies", issues);
  validateEtag(input.etag, "etag", issues);
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: input as ContentRevisionV1 };
}

export function validateArtifactChangeEvent(
  input: unknown,
): ValidationResult<ArtifactChangeEventV1> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: [issue("$", "Expected a change event object.")] };
  }
  validateSchemaVersion(input, CHANGE_EVENT_SCHEMA_VERSION, issues);
  if (typeof input.eventId !== "string" || !VERSION_PATTERN.test(input.eventId)) {
    issues.push(issue("eventId", "Expected a bounded unique event ID."));
  }
  validateSiteKey(input.siteKey, "siteKey", issues);
  if (!isNonNegativeInteger(input.revision) || Number(input.revision) === 0) {
    issues.push(issue("revision", "Expected a positive revision."));
  }
  if (!isIsoDate(input.occurredAt)) issues.push(issue("occurredAt", "Expected an ISO timestamp."));
  if (typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 200) {
    issues.push(issue("reason", "Expected a bounded change reason."));
  }
  validateDependencies(input.dependencies, "dependencies", issues);
  if (Array.isArray(input.dependencies) && input.dependencies.length === 0) {
    issues.push(issue("dependencies", "A change event requires at least one dependency."));
  }
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: input as ArtifactChangeEventV1 };
}
