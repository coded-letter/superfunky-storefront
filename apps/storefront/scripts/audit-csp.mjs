import { policyAllowsEditorCode } from "./security-policy.mjs";

const target = process.argv.slice(2).find((argument) => /^https?:\/\//.test(argument));
if (!target) throw new Error("Usage: node scripts/audit-csp.mjs https://storefront.example/path");

const response = await fetch(target, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
const policy = response.headers.get("content-security-policy") || "";
if (!response.ok) throw new Error(`CSP audit received HTTP ${response.status}`);
if (!policy) throw new Error("CSP audit found no Content-Security-Policy header");
if (!policyAllowsEditorCode(policy)) {
  throw new Error("CSP must allow Custom HTML CSS and JavaScript while blocking event-handler attributes");
}
if (!/(?:^|;)\s*(?:script-src|default-src)\s+[^;]+/.test(policy)) {
  throw new Error("CSP has no script-src or default-src fallback");
}
console.log(`CSP audit passed for ${response.url}\n${policy}`);
