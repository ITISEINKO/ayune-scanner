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
2026-10-27: `node tests/lby-import.cjs` passed over 24 real HTTP requests to the local simulation. The sole `lby` member served panel lookup, model lookup and binary archive download; no members were silent (23 responses were HTTP 200 and one was 429). Tests verified ZIP/CRC, mapping, immutable/idempotent imports, explicit activation and rollback, tamper rejection, and active-pointer retention for 429, missing matches, wrong-order models, corrupt CRC, unexpected download hosts and non-finite world coordinates. These fixtures do not prove future vendor compatibility. A separate live import of the supplied FIORDINI share link succeeded with 377 panels; its new catalog entry was activated locally and passed browser/build/deployment-trace checks.
<!-- end:observations -->
