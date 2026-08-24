import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { filterVisibleSocialLinks } from "./FooterMockup.socialVisibility.ts";

const chromeSource = readFileSync(new URL("StorefrontChromeMockup.tsx", import.meta.url), "utf8");
const footerSource = readFileSync(new URL("FooterMockup.tsx", import.meta.url), "utf8");

test("filters footer social links by backend platform keys while still honoring explicit ids", () => {
  const visible = filterVisibleSocialLinks(
    [
      { id: "generated-instagram-link", platform: "instagram", label: "Instagram", href: "https://instagram.com/acme", icon: "/instagram.svg" },
      { id: "generated-youtube-link", platform: "youtube", label: "YouTube", href: "https://youtube.com/acme", icon: "/youtube.svg" },
      { id: "generated-linkedin-link", platform: "linkedin", label: "LinkedIn", href: "https://linkedin.com/company/acme", icon: "/linkedin.svg" },
    ],
    ["instagram", "generated-youtube-link"],
  );

  assert.deepEqual(visible.map(({ platform }) => platform), ["linkedin"]);
  assert.deepEqual(visible.map(({ id }) => id), ["generated-linkedin-link"]);
});

test("footer crypto marks share an intrinsic transparent presentation", () => {
  assert.match(footerSource, /cryptoCode \? "bg-transparent text-white"/);
  assert.match(footerSource, /<CurrencyMark code=\{cryptoCode\} size=\{10\}/);
  assert.match(footerSource, /role=\{cryptoCode \? "img" : undefined\}/);
  assert.match(footerSource, /cryptoCode \? "bg-transparent text-white" : "rounded-lg p-1\.5 shadow-soft"/);
});

test("footer payment visibility follows layout controls without a crypto feature override", () => {
  assert.match(chromeSource, /hiddenPaymentMethodKeys=\{hiddenFooterPaymentMethodKeys\}/);
  assert.doesNotMatch(chromeSource, /features\.crypto[\s\S]{0,100}\["btc", "eth"\]/);
});
