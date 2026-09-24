import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { filterVisibleSocialLinks } from "./FooterMockup.socialVisibility.ts";
import { sanitizeStorefrontHtml } from "./sanitizeStorefrontHtml.ts";

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

test("footer copyright preserves safe links and removes executable markup", () => {
  const html = sanitizeStorefrontHtml(
    '&copy; Example <a href="/privacy" onclick="alert(1)">Privacy</a><script>alert(1)</script>',
  );

  assert.equal(html, '&copy; Example <a href="/privacy">Privacy</a>');
  assert.match(footerSource, /const safeCopyrightHtml = sanitizeStorefrontHtml\(copyrightText\)/);
  assert.equal((footerSource.match(/<SafeHtmlContent[\s\S]*?html=\{safeCopyrightHtml\}/g) || []).length, 2);
});

test("footer supports one through seven-column editorial layouts", () => {
  for (const layout of ["grid-1", "grid-2-wide", "grid-3", "grid-4", "grid-5", "grid-6", "grid-7", "accordion-single"]) {
    assert.match(footerSource, new RegExp(layout));
  }
  assert.match(footerSource, /xl:grid-cols-7/);
});

test("footer supports explicit newsletter, assistant, and Spotify feature combinations", () => {
  for (const layout of ["separate", "newsletter-spotify", "newsletter-assistant", "assistant-spotify", "none"]) {
    assert.match(footerSource, new RegExp(layout));
  }
  assert.match(footerSource, /const pairNewsletterFeature = showNewsletterFeature/);
  assert.match(footerSource, /pairNewsletterFeature \? "mb-12 grid items-start gap-5 lg:grid-cols-2"/);
});

test("footer theme credit is independently sanitized and rendered", () => {
  assert.match(footerSource, /const safeThemeCreditHtml = sanitizeStorefrontHtml\(themeCredit\)/);
  assert.match(footerSource, /showStandaloneThemeCredit = showThemeCredit/);
  assert.match(footerSource, /!showCopyright \|\| safeThemeCreditHtml !== safeCopyrightHtml/);
  assert.match(footerSource, /html=\{safeThemeCreditHtml\}/);
});
