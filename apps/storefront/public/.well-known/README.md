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
transformation (no HTML wrapper, no trailing newline changes). The checked-in file
next to this README is an empty placeholder purely so the route/deploy path exists —
replace its contents with the real downloaded file before enabling Apple Pay in
production, and re-download it if the domain ever changes.
