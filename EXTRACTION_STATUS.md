# Extraction Status

Tracks what has been migrated from the private `superfunky-woo` monorepo into this
public repository. Nothing is extracted automatically — every addition here is a
reviewed, deliberate copy of free-tier-only code.

| Date | Module | Status |
|---|---|---|
| — | (none yet) | Repository scaffold created; awaiting first approved code extraction. |

## Process

1. Identify a free-tier module in the monorepo
   (`workspace/frontend/apps/storefront`, `workspace/frontend/packages/*`) that has no
   dependency on premium/paid functionality.
2. Copy it here manually (no automated subtree/CI export yet).
3. Strip any references to premium plugins, internal URLs, or secrets.
4. Add/adjust tests and this status table in the same change.
5. Open a PR against this repo for review before merging.
