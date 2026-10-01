# External integration guideline

Use this when an app has a user-facing workflow but its source of truth lives
in another service: inventory, orders, CRM, accounting, or a marketplace.

## Boundary

```text
Browser UI
  -> Next.js route handler
  -> provider adapter
  -> external API
```

Keep provider credentials and provider-specific request shapes on the server.
The browser should call app-owned `/api/*` routes and receive app-owned data
shapes.

The UI should not know whether the provider calls a product a task, variation,
SKU, or warehouse inventory record.

## Minimum design

### 1. Define the app contract first

Write the small set of operations the UI actually needs:

| App operation | Input | Output |
| --- | --- | --- |
| Find item | scan code, location | normalized item and stock |
| Create item | item fields | normalized item |
| Apply stock change | item, quantity, operator | new stock and provider request id |

Use domain names in this contract. Keep provider IDs in the server-side
adapter and return them only when the UI needs them for a later operation.

### 2. Put provider code behind one adapter

```text
src/
  app/api/.../route.ts       validate input and map errors
  lib/provider/client.ts     auth, HTTP, response handling
  lib/provider/items.ts      provider operations
  lib/domain.ts              app-owned types and calculations
```

One provider does not need a factory or a plugin system. A few functions are
enough. Add an abstraction only when a second provider is actually required.

### 3. Treat the server route as a trust boundary

At every route:

- parse JSON defensively;
- reject blank IDs, invalid quantities, and unsupported enum values;
- validate integer and range constraints;
- never trust stock values supplied by the browser for financial or inventory
  decisions;
- return a stable app error shape;
- log provider request IDs, but never secrets.

The browser value can be used as a display hint. Re-read authoritative stock
before a write when the provider supports it.

### 4. Separate provider success from HTTP success

Some APIs return HTTP 2xx with an error code in JSON. The adapter must inspect
both layers and normalize them:

```ts
type ProviderResult<T> =
  | { ok: true; data: T; requestId?: string }
  | { ok: false; code: string; message: string; requestId?: string };
```

The route maps provider failures to the app contract. Do not expose raw
provider response bodies to users.

### 5. Make stock semantics explicit

Decide whether a write means:

- a delta: `current + quantity` or `current - quantity`; or
- an absolute target: `set stock to quantity`.

Do not pass a delta to an endpoint that expects an absolute stock value. If a
delta must become an absolute update, read the current value, calculate the
target on the server, validate it, then write it. Document the concurrency
limit; a read-then-write flow can lose a simultaneous update unless the
provider offers a conditional or transactional operation.

### 6. Handle retries deliberately

Retry only transient failures such as timeouts, 429s, or provider-declared
busy responses. Use a short bounded retry with backoff. Do not retry a write
unless the operation is idempotent or has a deduplication key.

For a multi-step write, choose one of these explicitly:

- provider-native atomic operation;
- write one source of truth and reconcile the other later;
- record an operation and make it retryable;
- compensate a completed step when the next step fails.

Never report success until the app's required side effects have succeeded.

### 7. Keep sync direction clear

Choose one:

- pull on demand;
- scheduled pull;
- provider webhook into the app;
- app write-through to the provider;
- a deliberate combination with one source of truth.

For webhooks, authenticate when the provider supports it, validate the event
shape, make processing idempotent, and return quickly. Put slow work in a
queue only when the project actually needs it.

## Delivery checklist

- [ ] Provider credentials exist only in server environment variables.
- [ ] Provider base URL and region are configurable.
- [ ] Auth/signature generation has one tested implementation.
- [ ] Provider response codes are normalized.
- [ ] UI-facing DTOs contain no provider-specific shape unless necessary.
- [ ] Read operations handle pagination and empty results.
- [ ] Write operations define absolute-vs-delta semantics.
- [ ] Input validation covers IDs, enums, quantities, and limits.
- [ ] Transient failures and retries are bounded.
- [ ] Multi-step writes have a failure/reconciliation policy.
- [ ] Logs include a provider request ID and omit credentials.
- [ ] One self-check or focused test covers the non-trivial calculation/auth
  logic.
- [ ] The provider documentation URL and checked date are recorded.
