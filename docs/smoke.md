# Smoke checks

Manual checks against the real environment. Tests never touch Dataverse; these do.

## Dataverse repositories (task 4)

**How:** run `npm run dev:smoke`, open the printed **Local Play** URL in the browser profile signed in to the tenant, and click each step in the **Dataverse smoke test** panel in order. Check the maker portal (Tables → Todo Lists / Todo Tasks → Data) between steps. The panel deletes everything it creates.

**17 September 2026:** passed. Run by Christopher as `Mackensen5659@vy7kt.onmicrosoft.com` against `Default-dc087386-56cb-4425-82f3-4b2dd04d62d8`.

| Step | Logged result | Outcome |
|---|---|---|
| Create list | `Created list "Smoke test 2026-09-17T12:45:05.098Z" (957d6f9b-95b2-f111-aaac-7c1e5201b9cd)` | Pass |
| Create task | `Created task 977d6f9b-95b2-f111-aaac-7c1e5201b9cd in list 957d6f9b-95b2-f111-aaac-7c1e5201b9cd` | Pass: the list lookup was bound and read back |
| Mark task complete | `Marked task complete at 2026-09-17T12:45:11.000Z` | Pass |
| Delete task | `Deleted task` | Pass |
| Delete list | `Deleted list` | Pass |

The panel's log confirms each write succeeded and read back. Row-by-row checks in the maker portal between steps were part of the instructions but were not reported separately.

Observed: Dataverse stored `cb_completedon` without its milliseconds, and the read-back value ends in `.000Z`. Nothing depends on sub-second precision.

## Published app (task 16)

To be written in task 16: SPEC §8 criteria 1–10 on a phone browser and a desktop browser.
