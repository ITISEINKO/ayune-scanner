# Member scan summary

`GET /api/panel/members/summary?user_id=<ClickUp member ID>&period=7`

Requires the existing `clickup_access_token` cookie. The caller must currently
have the `SUPER_ADMIN` database role; the target must be in the panel member list.
No writes. Responses use `Cache-Control: private, no-store`.

Identity uses the verified, signed `ppic_session` when available, avoiding the
separate ClickUp user lookup. Missing or invalid sessions fall back to the existing
token identity lookup. The database admin role is checked on every request;
the session's role does not authorize access. Panel member validation still uses
the existing 60-second cache and can call ClickUp when that cache expires.

`user_id` is required. `period` is `7` (default), `30`, or `month`.
Periods include today and use Asia/Jakarta calendar days. `month` starts on the
first of the current month. Previous totals use the same number of preceding
calendar days. Today's counts are partial; the previous period includes full days.

200 JSON fields:

- `total`: recorded successful scan events in the selected period, across projects.
- `lifetimeTotal`: all recorded successful scan events for this member, excluding future timestamps.
- `today`: today's recorded events.
- `previousTotal`: events in the preceding period.
- `lastScannedAt`: latest recorded scan as an ISO UTC timestamp, or null, across all history.
- `days`: ordered `{ date: "YYYY-MM-DD", count: number }` entries, including zero days.
- `statuses`: `{ status, count }` entries for each PPIC status, plus `OTHER` if needed for legacy values.

Repeated scans count as separate events. Future timestamps are excluded.
This reports scan history, not current component inventory or manual status edits.

Errors: 400 `INVALID_SUMMARY_FILTER`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`,
404 `MEMBER_NOT_FOUND`, 502 `DATABASE_ERROR`. Panel member lookup failures return
`MEMBERS_UNAVAILABLE` with the upstream helper's 401, 403, or 502 status.

Local regression check with an in-memory database and session boundary stub:

```sh
node --experimental-strip-types tests/member-scan-summary.cjs
```

Drawer checks with intercepted summary responses and a local server/database:

```sh
npm run build
node --experimental-strip-types tests/settings-member-overview.cjs
```

## Member profile

`GET /api/profile/scan-summary` returns the same fields for the authenticated
member, with a fixed seven-day period. Identity comes from the signed
`ppic_session`, falling back to the ClickUp token identity. The current database
role must be `MEMBER`; inactive members may read their own history. Query
parameters cannot select another user or change the period. This route does not
fetch the panel member list. No writes; successful responses are private and
not cached. Errors: 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 502 `DATABASE_ERROR`.

The member profile shows lifetime and seven-day totals; daily and status charts
cover the last seven Jakarta calendar days. The admin profile has no overview.

`GET /api/profile` also returns `displayName: string | null` alongside `email`,
`role`, and `allowedStatuses`. Name and email come from the same authenticated
ClickUp user request. Profile headers capitalize the name for display and use a
skeleton while loading; a missing name falls back to `Akun`.

```sh
node --experimental-strip-types tests/profile-scan-summary.cjs
node tests/profile-overview.cjs # after npm run build; local server, intercepted UI data
```
