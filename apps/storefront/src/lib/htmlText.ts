import { normalizeDisplayLabel } from "@funky/ui/src/seo/htmlEntities.ts";

export function htmlToPlainText(value: string): string {
  let text = value;

  for (let pass = 0; pass < 3; pass += 1) {
    const withoutBlockComments = text
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<![\u2010-\u2015-]+\s*\/?wp:[^>]*>/gi, " ");
    const decoded = normalizeDisplayLabel(withoutBlockComments.replace(/<[^>]*>/g, " "));
    if (decoded === text) {
      text = decoded;
      break;
    }
    text = decoded;
  }

  return text
    .replace(/<![\u2010-\u2015-]+\s*\/?wp:[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
