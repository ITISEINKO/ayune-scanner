# LBY project import simulation

## Purpose

Local-only synthetic LBY panel/model responses and a single-JSON ZIP archive. The real importer runs outside the simulation.

## Execution

Run `postman simulation run tests/lby-import.sim.yaml --port 4913 --output ndjson --no-history`, then `node tests/lby-import.cjs`.
The test redirects only the two hard-coded vendor origins to this local member. It refuses other origins; no real credentials are used.

## Assumptions

- Envelopes, label/splitId mapping and archive format follow the two live projects inspected on 2026-10-27. The fixture contains one synthetic panel and is not a complete vendor contract.
- No owner-provided mock was found in the local repository; no external vendor Postman workspace was used.
- The mock models GET paths used by the helper; other paths return 501.

## Observations

<!-- begin:observations -->
2026-10-29 panel-name revision identity: `node tests/lby-import.cjs` passed 39 local HTTP requests. A synthetic rename with unchanged geometry creates a new revision containing the updated name in both snapshot and mapping; an identical reimport reuses it. The previous revision and active catalog remain unchanged. The new assertion failed before including string panel names in the shared snapshot mapper. The sole `lby` member served panel lookup, model lookup and archive download; this does not verify live vendor behavior or deployment.
2026-10-28 curved geometry: `node tests/lby-import.cjs` passed 33 local HTTP requests, including a synthetic L-bend archive with formed depth 574 rather than its flat box size. The `lby` member served panel lookup, model lookup and ZIP download; no members were silent. Offline geometry checks and a separate real-model isolated browser check cover L/U bends, drawn arcs, normalized origins, parent transforms, selection, door motion and explode. A live FIORDINI living-room import saved a new inactive candidate through `/drafter`; this does not establish fabrication accuracy or production deployment.
2026-10-28 empty panel lookup: `node tests/lby-import.cjs` passed 30 HTTP requests. The lby member served all expected paths; no members were silent. The new synthetic no-panel-data response reproduces HTTP 200/code 0/data [] with a model URL available, matching the live response shape investigated read-only. Shared fetchProject rejects it with LBY_NO_PANEL_DATA and leaves the active catalog unchanged; existing ZIP/mapping/rollback and total-deadline checks passed. Actual generation/publication of vendor serials remains unverified.
2026-10-27: `node tests/lby-import.cjs` passed over 24 real HTTP requests to the local simulation. The sole `lby` member served panel lookup, model lookup and binary archive download; no members were silent (23 responses were HTTP 200 and one was 429). Tests verified ZIP/CRC, mapping, immutable/idempotent imports, explicit activation and rollback, tamper rejection, and active-pointer retention for 429, missing matches, wrong-order models, corrupt CRC, unexpected download hosts and non-finite world coordinates. These fixtures do not prove future vendor compatibility. A separate live import of the supplied FIORDINI share link succeeded with 377 panels; its new catalog entry was activated locally and passed browser/build/deployment-trace checks.
2026-10-28: After removing the standalone model-file trial, `node tests/lby-import.cjs` again passed all 24 real HTTP requests through this simulation. The sole `lby` member served panel lookup, model lookup and archive download; no members were silent. Importer code and mock responses were unchanged. The production build, LBY viewer browser checks and deployment tracing for both retained projects also passed. No live vendor import or production deployment was run.
<!-- end:observations -->
2026-10-28: After extracting the in-memory importer shared with the online ADMIN endpoint, `node tests/lby-import.cjs` passed 28 HTTP requests through the sole `lby` member; no members were silent. Parallel panel/model reads, existing ZIP/mapping/activation/failure checks and a new short total-deadline abort against the delayed archive all passed. A deadline failure preserved the active file pointer. CLI defaults now allow a shared 240-second download deadline; the 21-second online browser wait is covered separately by `tests/lby-online.cjs`.
