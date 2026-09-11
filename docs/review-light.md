# Light look review

**Verdict: PASS** (tessellation + paper studio). Flag soak on small countries is geographically tiny at world scale.

Shots: `e2e/output/01-title.png`, `02-choose.png`, `04-italy-snapped.png`.

| Check | Result |
|---|---|
| Light background | Pass. Paper `#F4F1EA` on title and play. No black band. |
| Only globe + pieces | Pass. Floating sphere, wordmark, count, silhouette tray. No table, lamp, fog, collection. |
| Countries tessellate | Pass. 204 slots, neighbors share radius 1. FR–DE and US–CA meet. |
| Italy flag after snap | Pass as soak. Boot shows green / white / red. Small because Italy is small on a world globe. |
| Tray has all countries | Pass. Count `n из 204`. Continent tabs + search. Cohort-relative sizes. |

Independent agents: data PASS (204/204 flags). Fit PASS. Visual review failed Italy-as-specks before UV stretch; recapture shows a tricolor boot.
