# Original item pipeline, M16–M18

`recipes.mjs` contains original MIT geometry, in metres, +Y up / +Z front. No third-party model, image, texture or animation is used for items. `catalog.mjs` records 45 definitions with production stage and `geometry-produced` status: the original 12 M16 samples remain attributable, and M18 adds the remaining fixed models. Runtime contains 24 fixed identities and 21 public secret appearance identities. Geometry production is not a claim of all natural interaction/device acceptance.

`node scripts/build-item-models.mjs` emits 135 GLBs (45 identities × 3 LODs), plus identical runtime and public manifests. `node scripts/audit-item-models.mjs` checks deterministic output, source hashes, all definition coverage, GLB structure, budgets, sockets and public variants. Current budget per GLB is at most 2,000 triangles, 12 calls and 150,000 bytes, with zero textures. Radial segments and small ornaments simplify at distance; structural parts and action sockets remain. See `M18-CONTRACT.md` and `M18-RESULTS.md` for interfaces and actual verification.

Each garment has separate bone-bound pieces. Material batching is by color within a piece. Cache owns shared geometry/material; scene clones must be detached without disposing these resources. Dispose the cache after all scenes/characters that use it have been removed. Async results are checked against current requested equipment; stale models cannot equip an old item. The runtime registry imports `src/visual/items/manifest.json`, generated from the same bytes as the public manifest.

All secret groups resolve with public category + appearance, including after identification. No GLB contains effect names. The production catalog is development-only and never imported by runtime code. Unregistered definitions return planned/null instead of pretending to have production geometry.

Inspection requires a Vite dev server at port 5174:

```text
npm run dev -- --port 5174
node scripts/profile-item-models.mjs <external-output-directory>
npx vitest run tests/visual/items.test.ts tests/visual/items-equipment.test.ts
```

The browser command renders 48/64/96 px atlases, all-item ground scenes, eight weapon and six-slot equipment fixtures, and folded/open scroll sheets. Outputs stay outside the repository. Fixtures use real GLBs, caches, rig and equipment binding; they do not substitute for natural gameplay traces or physical phone performance. Structural checks and author screenshot inspection are not independent review.
