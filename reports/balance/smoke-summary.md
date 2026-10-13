# M16A balance report

Agent: m16-public-1; rules: alpha2-1; content: 144ae545

Games: 90; seeds: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10

| Group | Games | Wins | Win rate (Wilson 95%) | Action median / P95 / peak |
| --- | ---: | ---: | --- | --- |
| loadout:vanguard | 30 | 30 | 100.0% (88.6%–100.0%) | 427.5 / 437.55 / 444 |
| loadout:breaker | 30 | 29 | 96.7% (83.3%–99.4%) | 409.5 / 430.2 / 441 |
| loadout:channeler | 30 | 30 | 100.0% (88.6%–100.0%) | 402 / 474.1 / 486 |
| strategy:novice | 30 | 30 | 100.0% (88.6%–100.0%) | 419.5 / 474.1 / 486 |
| strategy:survivor | 30 | 30 | 100.0% (88.6%–100.0%) | 414 / 437.55 / 444 |
| strategy:fighter | 30 | 29 | 96.7% (83.3%–99.4%) | 417.5 / 435.65 / 441 |
| vanguard/novice | 10 | 10 | 100.0% (72.2%–100.0%) | 419.5 / 422.65 / 424 |
| vanguard/survivor | 10 | 10 | 100.0% (72.2%–100.0%) | 434 / 441.3 / 444 |
| vanguard/fighter | 10 | 10 | 100.0% (72.2%–100.0%) | 427.5 / 435.65 / 437 |
| breaker/novice | 10 | 10 | 100.0% (72.2%–100.0%) | 402.5 / 405.55 / 406 |
| breaker/survivor | 10 | 10 | 100.0% (72.2%–100.0%) | 414 / 417.1 / 418 |
| breaker/fighter | 10 | 9 | 90.0% (59.6%–98.2%) | 417.5 / 436.95 / 441 |
| channeler/novice | 10 | 10 | 100.0% (72.2%–100.0%) | 469.5 / 481.05 / 486 |
| channeler/survivor | 10 | 10 | 100.0% (72.2%–100.0%) | 402 / 408.2 / 410 |
| channeler/fighter | 10 | 10 | 100.0% (72.2%–100.0%) | 397 / 399 / 399 |

Outcomes: {"won":89,"dead":1}

Death causes: {"Emberling":1}

## Paired seed comparisons

| Comparison | Pairs | Win-rate difference | Bootstrap 95% |
| --- | ---: | ---: | --- |
| vanguard:survivor minus novice | 10 | 0.0% | 0.0%–0.0% |
| breaker:survivor minus novice | 10 | 0.0% | 0.0%–0.0% |
| channeler:survivor minus novice | 10 | 0.0% | 0.0%–0.0% |
| vanguard:fighter minus novice | 10 | 0.0% | 0.0%–0.0% |
| breaker:fighter minus novice | 10 | -10.0% | -30.0%–0.0% |
| channeler:fighter minus novice | 10 | 0.0% | 0.0%–0.0% |
| vanguard:fighter minus survivor | 10 | 0.0% | 0.0%–0.0% |
| breaker:fighter minus survivor | 10 | -10.0% | -30.0%–0.0% |
| channeler:fighter minus survivor | 10 | 0.0% | 0.0%–0.0% |

## Limits

- 90-game smoke is a regression sample, not calibrated human difficulty.
- Death source uses the last public hurt journal entry; other damage attribution groups environmental and periodic damage.
- Condition counts are changes observed at command boundaries; no hidden intermediate events are inferred.
- Unknown harmful outcome is correlation during the use command, not causal attribution.
- Rarity is absent from public projection and is intentionally not inferred.
- Tick budget stops at the first stable boundary at or beyond the threshold; an accepted command is never interrupted.
- Current strategies do not experiment with unknown consumables; zero unknown trials is not evidence that those effects are safe.
- No CPU timing is included in deterministic game results. Device/browser performance is separate.

Full resource quantiles and depth entry/death denominators are in summary.json. Every run is in runs.json and runs.csv; non-winning formal command traces are in failures/.

Node timing/memory (not browser performance):

```json
{
  "preset": "smoke",
  "sourceSha256": "16f77a010e4465cbececebdb20b157751036847e83efc103e19101bcc0646b38",
  "node": "v24.14.0",
  "platform": "win32 10.0.26300 x64",
  "cpu": "12th Gen Intel(R) Core(TM) i5-12600KF",
  "concurrency": 2,
  "games": 90,
  "durationMs": 48679.5314,
  "perGameMs": {
    "median": 1032.8700000000026,
    "p95": 1322.858555000003,
    "peak": 1683.4141
  },
  "workerHeapBytes": {
    "median": 59110884,
    "p95": 100363344.8,
    "peak": 107463720
  },
  "notes": "Node headless throughput; heap sampled after each game, not peak process RSS/GPU memory; includes deterministic trace/digest costs."
}
```
