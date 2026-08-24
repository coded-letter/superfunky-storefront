export function normalizeManagedMediaUrl(source: string): string {
  try {
    const url = new URL(source);
    if (url.protocol === "http:" && /(?:^|\.)superfunky\.pro$/i.test(url.hostname)) {
      url.protocol = "https:";
      return url.toString();
    }
  } catch {
    return source;
  }
  return source;
}
