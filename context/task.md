# TrackerProd audit prompt

Run this from the TrackerProd repository.

> Inspect how TrackerProd fetches data, processes it, caches it, and stores it. Trace the real code from the UI/API route through ClickUp and Turso, including errors and updates.
>
> Create documentation only; do not change application code, ClickUp tasks, Turso data/schema, environment variables, webhooks, or deployment settings.
>
> Write these documents using actual file paths, functions, routes, tables, and environment-variable names. Do not include secrets or guess missing behavior:
>
> 1. `context/data-flow.md` — explain the main data flows with a simple Mermaid diagram: browser/API → TrackerProd → ClickUp/Turso/cache → response. Include the PPIC scan, project/dashboard load, and status update flows.
> 2. `context/clickup.md` — document every ClickUp read/write: caller, endpoint, input, response use, custom-field update, OAuth/token use, retry/timeout, webhook, and failure risk.
> 3. `context/turso.md` — document Turso connection code, tables used, what each table stores, who reads/writes it, and how it relates to ClickUp data.
> 4. `context/improvement-audit.md` — list risks and improvements in a table: severity, evidence (file/function), impact, smallest safe improvement, and how to verify it.
>
> Check especially for: slow/full-list ClickUp requests, stale cache, per-instance cache, duplicate or concurrent updates, partial success when ClickUp succeeds but Turso fails (or the reverse), missing authorization/validation, unsafe retry, webhook verification, and missing logs/metrics.
>
> Mark every claim as **Confirmed**, **Inferred**, or **Unverified**. Prefer the smallest improvement; do not add a dependency or new cache/database unless the inspected code and measured evidence show it is needed.
>
> At the end, report the files created, the most important confirmed flows, the top risks, the recommended first improvement, checks actually run, and what could not be verified.

## Related context

- [[05-Projects/trackerprod/_overview|TrackerProd overview]]
- [[06-Project-Logs/trackerprod/2026-10-21-performance-reference-and-measurement-plan|Performance reference and measurement plan]]
