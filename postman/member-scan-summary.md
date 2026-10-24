# Member scan summary

`GET /api/panel/members/summary?user_id=<ClickUp member ID>&period=7`

Requires a valid signed `ppic_session` cookie. The session supplies identity only;
the caller must currently have the `SUPER_ADMIN` role in `ppic_permissions`, checked
on every request. A stale session role cannot bypass a revoked local admin role.
Missing or invalid sessions return 401 without a ClickUp token fallback.

The target must have a local `ppic_permissions` record. Inactive members and
admins remain viewable; a ClickUp-only member without a local record returns 404.
This endpoint makes no ClickUp calls and performs no writes. Responses use
`Cache-Control: private, no-store`.

ClickUp-only access revocation is not checked by this endpoint; revoke the local
admin role to block subsequent summary requests. Settings member-list loading,
profile details, and session refresh retain their separate ClickUp calls.

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
- `lifetimeStatuses`: the same status buckets across all recorded history, excluding future timestamps; counts sum to `lifetimeTotal`.

Repeated scans count as separate events. Future timestamps are excluded.
This reports scan history, not current component inventory or manual status edits.

Errors: 400 `INVALID_SUMMARY_FILTER`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`,
404 `MEMBER_NOT_FOUND` (no local target record), 502 `DATABASE_ERROR`.

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

The member profile shows lifetime and seven-day totals. The daily chart covers
the last seven Jakarta calendar days; the status chart uses `lifetimeStatuses`
and `lifetimeTotal`, labeled "Sepanjang waktu". Admin Settings status charts
continue to use the selected period. The admin profile has no overview.

`GET /api/profile` also returns `displayName: string | null` alongside `email`,
`role`, and `allowedStatuses`. Name and email come from the same authenticated
ClickUp user request. Profile headers capitalize the name for display and use a
skeleton while loading; a missing name falls back to `Akun`.

```sh
node --experimental-strip-types tests/profile-scan-summary.cjs
node tests/profile-overview.cjs # after npm run build; local server, intercepted UI data
```
