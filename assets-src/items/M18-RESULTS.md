# M18 item asset author verification — 2026-10-11

Candidate: 45 original public identities, 135 real GLBs, 24 fixed definitions + 21 secret public appearances. All 45 catalog definitions have geometry coverage; catalog status is `geometry-produced`, not natural-game or device approval. Source recipes and GLBs are MIT original work; no external item assets or textures were introduced.

Frozen candidate hashes (SHA-256):

| File | Hash |
| --- | --- |
| public/assets/items/manifest.json (identical runtime copy) | a40d2ede0706adc610ec8210cef3614d006f04a1c7d3fd91a75d6163df752243 |
| assets-src/items/recipes.mjs | ea7e6ddb74a6a8ce27984058f0b8ce1ac1227d6afdbdf18e8f494b9b8cb6db2b |
| src/visual/items/equipment.ts | b4e988dc8a1f362bca309ab735a0a88121ccecd22084d953567b8b643c1221eb |
| src/visual/items/presenter.ts | 90a8cff92d8ef59af2e4bb8fb0ecc94a30e9f3e2656f9e96c42bd058b9c0816f |
| tests/visual/items-equipment.test.ts | 6c77ddfa831c6f65bb2a4d4ed0068eeb16198f6a5796135766d8736763930229 |

Executed successfully:

- `node scripts/build-item-models.mjs`: 135 GLBs, 1,929,988 total bytes. Three LODs strictly reduce triangle counts for each identity.
- `node scripts/audit-item-models.mjs`: deterministic source/outputs, all hashes, physical GLB structure and actual buffers, 45-definition coverage, sockets, garments, budgets and no stale assets. All levels together contain 21,624 triangles. Largest single GLB is brigandine LOD0: 1,692 triangles, 9 calls, 126,872 bytes. Maximum calls per single model: 11. No textures.
- `npx vitest run tests/visual/items.test.ts tests/visual/items-equipment.test.ts`: 2 files, 9 tests passed, 1.38 s on final source. Includes real GLTFLoader parsing of all 135 files; exact grip/muzzle/contact/supportGrip across levels; ReadingSheet fold/unfold; unchanged secret appearance before/after identification; public-session nonmutation; six-slot binding, mask and hand restoration; LOD switch; shared disposal; stale async and disposed equipment.
- `npm run typecheck`: passed. An earlier attempt observed another group's transient incomplete native-ui edit; this final candidate passed after the edit completed.
- `node scripts/profile-item-models.mjs C:/Users/coolking/.codex/visualizations/2026/10/11/01a129c4-1522-7131-8c77-c1a1ae3a19cd/m18-assets`: Chromium 156.0.8078.4, Vite dev, 1240×960 viewport, DPR 1, no antialias, no page errors. Seven 45-entry atlas screenshots, ten ground/equipment/reading screenshots. Actual result JSON includes manifest hash and each equipped slot's public identity.

Author visually inspected 48/64/96 atlases for LOD0/2, 64 atlas for LOD1, both ground levels, all three equipment batches at both levels, and all six scrolls folded/unfolded at LOD0/2. Long spear/staff remain deliberately slender at 48 px; heads distinguish them. Brigandine loses rivets at lower levels but retains overlapping plates; plate retains central ridge. Helm and cap are distinct. No clipping of atlas frames or missing items was observed. The read sheet expands from the original roll, with no hidden effect symbols. These observations are self-checks, not independent review.

Actual rendered counts, including floor and character where present (not timings):

| Scene | LOD0 calls / triangles | LOD2 calls / triangles |
| --- | --- | --- |
| Ground, all 45 | 200 / 11,110 | 177 / 4,348 |
| Equipment sword/knife/maul | 219 / 6,672 | 197 / 3,304 |
| Equipment spear/bow/fireblade | 220 / 6,792 | 195 / 3,338 |
| Equipment silverblade/staff | 148 / 5,116 | 131 / 2,362 |
| Six folded + six unfolded scrolls | 67 / 2,572 | 67 / 1,480 |

Coverage limits / owner: natural command actions and projected receipts, animation contact/recovery, busy lifecycle, renderer quality selection and integrated gameplay remain M18I's responsibility. These controlled public item fixtures do not assert natural acquisition or full gameplay acceptance. Physical phone frame-time/memory measurements, all animation phases and all content combinations are not covered here. Independent review is pending integration assignment, with at most two rounds. No STATUS completion, full-suite test, release, commit or push was performed by this asset task.

## Independent round 1 finding and author repair candidate

Integrator independently identified P2: food freshness had no visual difference after the ready GLB bypassed the legacy renderer's stale color. Accepted and repaired with original green/brown surface patches in `FreshnessOverlay` on all four food models and all three LODs. Default fresh instances hide the node; stale changes only its clone transform/visibility. `getItem`/`itemAppearanceKey` propagate the public freshness to thumbnail caches. Secret categories still use public ordinal appearance only. Integrator and UI author own their call-site adoption. Public tool contact points were also added at kit hammer head, salve jar top, pot rim and lantern body for the integrator's apply action.

Second candidate hashes (SHA-256; prior evidence above retained):

| File | Hash |
| --- | --- |
| public/assets/items/manifest.json | c43841a6f21d92fb7f958efeed406d94fe420ee93034e3cff0cb10bcd26bf636 |
| assets-src/items/recipes.mjs | 276bc0b83c3d849786f0adcf5db39cb9b8d7034396792c47bfdcceb710964c57 |
| src/visual/items/appearance.ts | 47f95a4ed251ab03e1e86dfafc1be2263e6a79657068e9a1355d01073c512677 |
| src/visual/items/presenter.ts | fd35d1afa1a212ad68432c70d67a4916e86c32eb347a6a3382c08f6bb9b048e1 |
| src/visual/items/thumbnail-cache.ts | 8d136ff9e02f6f9c6e0d2c6accbd99c9ad81a93f371591aff091bb412301bf8c |
| tests/visual/items-equipment.test.ts | d4fdb9a6497e005d78520c539a176e67037624478e64569c7b3b8bcb9def471e |

Author repair checks: deterministic generation and full resource audit passed: 135 GLBs, 2,094,500 bytes, 23,688 total triangles across three LODs, within unchanged per-GLB budgets. Item unit files now **10/10 passed, 923 ms**, including fresh/stale clone isolation, unchanged shared materials, restoration to fresh, and non-food secret-condition immunity. Typecheck passed. Latest actual Chromium inspection is external `m18-assets/round2`, manifest-bound report timestamp 2026-10-11T09:01:19.997Z, no page errors. Twenty images include three fresh/stale comparison sheets. Actual same-camera rendered pixel differences exist for all four foods at LOD0/2: 48 px 26–196 changed pixels, 64 px 43–338, 96 px 101–785. Author inspected all three sizes; no prior first-candidate approval is relabeled as independent second-round closure. Second-round independent verification belongs to the integrator.

## Independent round 2 — integrator verification

The root integrator, independently of the asset author, verified the second candidate above: **10/10 item tests passed in 704 ms**, reviewed `appearance.ts` and `presenter.ts`, and visually inspected the actual 48 px fresh/stale comparison at LOD0 and LOD2. The integrator confirmed default-hidden overlays, clone condition restoration and shared-material isolation, and closed the first-round freshness P2. This is the integrator's reported independent result, separate from the author's 923 ms run. The two-round asset review is complete; it does not expand the documented scope to physical-device performance or every integrated action.
