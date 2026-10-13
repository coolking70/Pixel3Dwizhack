# M17 public policy experiments

Version: m17-experiment-1; 90 configurations; raw traces in runs.json. This is a limited policy sample, not human difficulty.

| Arm | Games | Wins | Outcomes | Unknown trials | Alternative weapon exposure | Accepted weapon changes |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| explore | 30 | 30 | {"won":30} | 150 | 30 | 6 |
| no-item-use | 30 | 9 | {"won":9,"dead":21} | 0 | 30 | 0 |
| keep-starting-weapon | 30 | 30 | {"won":30} | 150 | 30 | 0 |

## Paired differences

```json
{
  "no-item-use minus explore": {
    "winDifference": {
      "pairs": 10,
      "meanDifference": -0.7000000000000001,
      "ci95": [
        -0.8666666666666668,
        -0.5333333333333333
      ],
      "method": "paired percentile bootstrap; 2000 resamples; fixed seed 362",
      "pairedConfigurations": 30,
      "seedBlocks": 10,
      "unit": "mean across matched loadouts within each seed"
    },
    "hpDifference": {
      "pairs": 10,
      "meanDifference": -49.5,
      "ci95": [
        -55.633333333333326,
        -43.29833333333334
      ],
      "method": "paired percentile bootstrap; 2000 resamples; fixed seed 362",
      "pairedConfigurations": 30,
      "seedBlocks": 10,
      "unit": "mean across matched loadouts within each seed"
    },
    "ticksDifference": {
      "pairs": 10,
      "meanDifference": -1331.1333333333332,
      "ci95": [
        -1719.8283333333331,
        -944.4116666666671
      ],
      "method": "paired percentile bootstrap; 2000 resamples; fixed seed 362",
      "pairedConfigurations": 30,
      "seedBlocks": 10,
      "unit": "mean across matched loadouts within each seed"
    },
    "exposedWeaponPairs": 30
  },
  "keep-starting-weapon minus explore": {
    "winDifference": {
      "pairs": 10,
      "meanDifference": 0,
      "ci95": [
        0,
        0
      ],
      "method": "paired percentile bootstrap; 2000 resamples; fixed seed 362",
      "pairedConfigurations": 30,
      "seedBlocks": 10,
      "unit": "mean across matched loadouts within each seed"
    },
    "hpDifference": {
      "pairs": 10,
      "meanDifference": 0.23333333333333214,
      "ci95": [
        -2.366666666666667,
        3.53416666666666
      ],
      "method": "paired percentile bootstrap; 2000 resamples; fixed seed 362",
      "pairedConfigurations": 30,
      "seedBlocks": 10,
      "unit": "mean across matched loadouts within each seed"
    },
    "ticksDifference": {
      "pairs": 10,
      "meanDifference": 26.733333333333483,
      "ci95": [
        11.931666666666729,
        42.66666666666688
      ],
      "method": "paired percentile bootstrap; 2000 resamples; fixed seed 362",
      "pairedConfigurations": 30,
      "seedBlocks": 10,
      "unit": "mean across matched loadouts within each seed"
    },
    "exposedWeaponPairs": 30
  }
}
```

Policy interventions use only owned/nearby public items through formal commands. They measure the whole policy restriction, including different paths, inventory pressure and opportunity exposure; not isolated hidden item effect strength. No unknown outcome is assigned causality. Zero exposure is not evidence of equivalence. Pooled Wilson intervals in arm summaries are descriptive only: configurations sharing one map seed are correlated. Main intervention conclusions use the paired seed-block bootstrap.

`no-item-use` disables potion and every a2:use action, including food and scrolls; it is a policy/resource restriction, not removal of a hidden rule effect. `keep-starting-weapon` blocks changing main-hand weapons while retaining armor changes.
