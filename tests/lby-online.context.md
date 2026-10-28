# Online LBY import simulation

## Purpose and execution

Run `postman simulation run tests/lby-online.sim.yaml --port 4914 --output ndjson --no-history`, then after `npm.cmd run build`, run `node tests/lby-online.cjs`. The real Next application and temporary local libSQL database run outside the simulation. The test's preload redirects the two allowlisted LBY origins and ClickUp to the corresponding members; other outbound requests are rejected.

## Assumptions

Uses the repository's existing synthetic LBY panel/model/ZIP fixture and ClickUp task contract. No external owner-provided mock was used. The LBY slow mode delays archive delivery for 21 seconds; unknown endpoints return 501. Runtime database persistence, ADMIN authorization, preview/activation/rollback and failure retention are the application under test, not mock members.

## Observations

<!-- begin:observations -->
2026-10-28: `node tests/lby-online.cjs` passed against the production Next build and a temporary local database, including a real 21-second archive delay while the dialog stayed busy. Exact ADMIN controls/API, SUPER_ADMIN/MEMBER denial, fresh role revocation, persisted compressed candidates, ADMIN-only previews, active member reads, activation/rollback, identical-content reuse, project/order isolation, expired-lease recovery, concurrent-import refusal, stale activation and failure retention all passed. Both `lby` and `clickup` members served their paths; no members were silent. Failed ZIP/CRC, mappings, download hosts, finite coordinates, HTTP 429 and wrong orders left the active version unchanged. Build/TypeScript, standalone viewer, manual status browser checks and project/group/shared-refresh regressions passed. The first group regression exposed the broader permission read added to all roles; restoring the existing page guard and querying full access only for ADMIN fixed that compatibility issue. The mobile dialog screenshot was inspected. No production DB, live vendor, deployed timing or physical device was used.
<!-- end:observations -->

2026-10-28 profile/serial revision: `npm.cmd run build`, `node tests/lby-online.cjs`, `node tests/panel-location.cjs`, `node tests/admin-manual-location.cjs` (with the dashboard simulation on 4900), and `node --experimental-strip-types tests/profile-overview.cjs` passed. The online test now imports a URL from ADMIN profile without a selected ClickUp project, resolves by exact serial (including leading zeroes) with no/mismatched project parameter, checks the saved-source list, rejects ambiguous active serials and retains source-specific draft preview. Existing safety checks and the real 21-second delay passed. The online run's `lby` member served requests; `clickup` was silent because import no longer validates a root project and the project-page smoke check used a seeded snapshot. The separate manual-location simulation served ClickUp serial/status requests and asserted that parent/project hierarchy fetches never occur, including a cyclic hierarchy fixture. Mobile import screenshot inspected. Initial regression failures were outdated project/hierarchy expectations and an ambiguous Playwright alert selector; updated checks passed. Existing fixture provenance and live/production limits above still apply.

## Limits

Local checks do not establish Vercel production configuration, quota usage, real vendor timing/schema compatibility, or physical panel accuracy. No real share tokens or production database are needed.
