This directory holds "well-known" verification files the frontend needs to serve
at exact static paths for third-party platform verification.

apple-developer-merchantid-domain-association
------------------------------------------------
Still useful and kept: this file is required to enable Apple Pay on the Web (the
Stripe Payment Element already renders an Apple Pay button when this verification is
present and Apple Pay is available on the visitor's device/browser — see
`apps/storefront/src/lib/stripe.ts`). Without it, Apple Pay silently doesn't appear
as a payment option; nothing else in the checkout flow depends on it.

The actual file content is NOT something this repo can generate — it's a signed
blob downloaded from the Apple Developer "Merchant IDs" dashboard for a specific,
verified domain, and must be served byte-for-byte unmodified at
`/.well-known/apple-developer-merchantid-domain-association` with no build-time
transformation (no HTML wrapper, no trailing newline changes). Prefer pasting that
complete document into the WordPress Control Center's Apple Pay domain-association
field. A non-empty file next to this README is supported as a deployment fallback;
the checked-in file is an empty placeholder. Re-download the document if the
storefront domain changes.
