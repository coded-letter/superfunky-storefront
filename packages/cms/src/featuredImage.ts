export type CmsFeaturedImage = {
  sourceUrl: string;
  altText: string;
  width?: number;
  height?: number;
  srcSet?: string;
};

export type RawFeaturedImage = {
  node?: {
    sourceUrl?: string | null;
    altText?: string | null;
    srcSet?: string | null;
    mediaDetails?: {
      width?: number | null;
      height?: number | null;
    } | null;
  } | null;
} | null;

type SeoSchema = {
  raw?: string | null;
} | null;

export function normalizeFeaturedImage(
  featuredImage: RawFeaturedImage,
  schema: SeoSchema,
): CmsFeaturedImage | null {
  const node = featuredImage?.node;
  if (isHttpImageUrl(node?.sourceUrl)) {
    return {
      sourceUrl: node.sourceUrl,
      altText: node.altText || "",
      ...positiveDimensions(node.mediaDetails?.width, node.mediaDetails?.height),
      ...(node.srcSet?.trim() ? { srcSet: node.srcSet.trim() } : {}),
    };
  }

  const schemaImage = imageObjectFromSchema(schema?.raw);
  if (!schemaImage) return null;
  return {
    sourceUrl: schemaImage.sourceUrl,
    altText: schemaImage.altText,
    ...positiveDimensions(schemaImage.width, schemaImage.height),
  };
}

function imageObjectFromSchema(raw?: string | null): CmsFeaturedImage | null {
  if (!raw) return null;
  try {
    const schema = JSON.parse(raw) as { "@graph"?: unknown[] };
    const candidates = Array.isArray(schema["@graph"]) ? schema["@graph"] : [];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") continue;
      const image = candidate as Record<string, unknown>;
      const types = Array.isArray(image["@type"]) ? image["@type"] : [image["@type"]];
      if (!types.includes("ImageObject")) continue;
      const sourceUrl = stringValue(image.contentUrl) || stringValue(image.url);
      if (!isHttpImageUrl(sourceUrl)) continue;
      return {
        sourceUrl,
        altText: stringValue(image.caption) || "",
        ...positiveDimensions(numberValue(image.width), numberValue(image.height)),
      };
    }
  } catch {
    return null;
  }
  return null;
}

function positiveDimensions(width?: number | null, height?: number | null) {
  return width && width > 0 && height && height > 0 ? { width, height } : {};
}

function isHttpImageUrl(value?: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
