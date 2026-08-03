# Extraction Status

Tracks what has been migrated from the private monorepo into this
public repository.

| Date | Module | Status |
|---|---|---|
| 2025-08-03 | Full storefront + UI library | ✅ Complete — 450 files published |

## What's Included

- `apps/storefront/` — Complete React/Vite/TypeScript headless storefront (391 files)
- `packages/ui/` — Shared React component library (59 files)
- Root workspace config (pnpm workspaces)

## Safety Verification

- ✅ No secrets, API keys, or credentials in code
- ✅ `.env.example` contains only placeholder variables (no values)
- ✅ No premium plugin source code
- ✅ All code is MIT-licensed and free to use

## Notes

The storefront is always free and open source. There is no Pro/Free split
on the frontend — all UI features are available. The backend theme controls
which features are active via the `storefrontConfig.proFeatures` GraphQL field.
