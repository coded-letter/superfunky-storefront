export type ShortcodeCta = {
  label: string;
  href: string;
  target?: "_blank" | "_self";
  rel?: string;
};

type ShortcodeAttributes = Record<string, string>;

export function resolveShortcodeCta(
  attributes: ShortcodeAttributes,
  position: "primary" | "secondary",
): ShortcodeCta | undefined {
  const shorthand = (attributes[position === "primary" ? "cta1" : "cta2"] || "")
    .split("|")
    .map((item) => item.trim());
  const label = shorthand[0] || attributes[`${position}-cta-label`];
  const href = shorthand[1] || attributes[`${position}-cta-href`];
  if (!label || !href) return undefined;

  const rawTarget = (shorthand[2] || attributes[`${position}-cta-target`] || "").toLowerCase();
  const target: ShortcodeCta["target"] = ["_blank", "blank", "new"].includes(rawTarget)
    ? "_blank"
    : rawTarget === "_self"
      ? "_self"
      : undefined;
  const allowedRel = new Set(["external", "nofollow", "noopener", "noreferrer", "sponsored", "ugc"]);
  const relTokens = (shorthand[3] || attributes[`${position}-cta-rel`] || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => allowedRel.has(token));
  if (target === "_blank" && !relTokens.includes("noopener")) relTokens.push("noopener");

  return {
    label,
    href,
    target,
    rel: relTokens.length ? Array.from(new Set(relTokens)).join(" ") : undefined,
  };
}
