const MAX_FILE_BYTES = 65_536;
const MAX_LINES = 1_000;
const MAX_LINE_BYTES = 4_096;
const CONTROL_CHARACTERS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

function normalizeLines(contents, label) {
  if (typeof contents !== "string") {
    throw new Error(`${label} must be text.`);
  }
  const normalized = contents.replaceAll("\r\n", "\n");
  if (Buffer.byteLength(normalized, "utf8") > MAX_FILE_BYTES) {
    throw new Error(`${label} exceeds the 64 KB limit.`);
  }
  if (normalized.includes("\r") || CONTROL_CHARACTERS.test(normalized)) {
    throw new Error(`${label} contains unsupported control characters.`);
  }
  const lines = normalized.split("\n");
  if (lines.length > MAX_LINES) {
    throw new Error(`${label} exceeds the 1,000-line limit.`);
  }
  for (const [index, line] of lines.entries()) {
    if (Buffer.byteLength(line, "utf8") > MAX_LINE_BYTES) {
      throw new Error(`${label} line ${index + 1} exceeds the 4 KB line limit.`);
    }
  }
  return { normalized, lines };
}

export function validateNetlifyRedirects(contents = "") {
  const { normalized, lines } = normalizeLines(contents, "Netlify _redirects");
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2 || !parts[0].startsWith("/")) {
      throw new Error(`Netlify _redirects line ${index + 1} must contain a source path and destination.`);
    }
    if (parts[2] && !/^[2-5]\d\d!?$/.test(parts[2])) {
      throw new Error(`Netlify _redirects line ${index + 1} has an invalid redirect status.`);
    }
    if (parts.slice(3).some((option) => !/^[A-Za-z][A-Za-z0-9_-]*=[A-Za-z0-9_.*,:-]+$/.test(option))) {
      throw new Error(`Netlify _redirects line ${index + 1} has an invalid redirect option.`);
    }
  }
  return normalized;
}

export function validateNetlifyHeaders(contents = "") {
  const { normalized, lines } = normalizeLines(contents, "Netlify _headers");
  let hasPath = false;
  for (const [index, line] of lines.entries()) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (/^[ \t]/.test(line)) {
      const match = line.match(/^[ \t]+([^:]+):[ \t]*(.*)$/);
      if (!hasPath || !match || !HEADER_NAME.test(match[1]) || CONTROL_CHARACTERS.test(match[2])) {
        throw new Error(`Netlify _headers line ${index + 1} must be a valid indented header following a path.`);
      }
      continue;
    }
    if (!line.trim().startsWith("/") || /\s/.test(line.trim())) {
      throw new Error(`Netlify _headers line ${index + 1} must be a path beginning with /.`);
    }
    hasPath = true;
  }
  return normalized;
}
