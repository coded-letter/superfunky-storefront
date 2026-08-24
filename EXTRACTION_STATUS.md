# Extraction Status

Tracks what has been migrated from the private monorepo into this
public repository.

| Date | Module | Status |
|---|---|---|
| 2025-08-03 | Full storefront + UI library | ✅ Complete — 450 files published |
| 2026-08-14 | Static-first storefront and package architecture | ✅ Release candidate extracted |
| 2026-08-24 | Storefront application and public workspace packages | ✅ Synchronized and deployment-ready |

## What's Included

- `apps/storefront/` — Complete React/Vite/TypeScript headless storefront
- `packages/sdk/` — Backend transport, environment, cache and React data hooks
- `packages/cms/` — First extracted CMS normalization primitives
- `packages/commerce/` — First extracted commerce normalization primitives
- `packages/ui/` — Shared presentation and current application primitives
- `packages/shared/` — Framework-independent schemas, validators and route contracts
- Root workspace, test, build and deployment configuration

## Safety Verification

- ✅ No secrets, API keys, or credentials in code
- ✅ `.env.example` contains only placeholder variables (no values)
- ✅ No premium plugin source code
- ✅ All code is MIT-licensed and free to use
- ✅ Extraction safety, complete test suite and production build pass before publication

## Notes

The storefront is always free and open source. There is no Pro/Free split
on the frontend — all UI features are available. The backend theme controls
which features are active via the `storefrontConfig.proFeatures` GraphQL field.
