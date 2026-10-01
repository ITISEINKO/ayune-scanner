# Integration guidelines

This folder is the blueprint for building small Next.js apps that connect a
browser workflow to an external business system.

Read these in order:

1. [Flow and security](flow-and-security.md) — the application flow and
   security considerations.
2. [External integration guideline](external-integration-guideline.md) — the
   reusable architecture and delivery checklist.
3. [Current ClickUp implementation](current-clickup.md) — how this Scannow app
   applies the pattern today.
4. [Ginee next project](ginee-next-project.md) — the provider-specific plan for
   the next app.

The current codebase is intentionally unchanged by these documents.

## Flow and security

See [flow-and-security.md](flow-and-security.md) for the standalone version.

### System overview

The application is a lightweight warehouse inventory interface built with
Next.js and integrated directly with Ginee. Ginee remains the source of truth
for inventory data; the application does not maintain a separate product or
stock database.

```text
Warehouse Worker
       │
       ▼
   Next.js App
       │
       ▼
 Next.js Backend
       │
       ├──────────────► Ginee API
       │
       └──────────────► Lightweight Log Database
```

Next.js handles worker authentication, role management, product scanning,
stock operations, transaction history, and Ginee communication. Ginee owns
product data, warehouse inventory, stock quantities, and synchronization. The
log database records inventory activity for audit purposes without duplicating
inventory data.

### Authentication and authorization

Each warehouse worker should have an individual account and authenticated
session. Use role-based access control:

- Workers can scan products, add or subtract stock, view their transactions,
  correct recent mistakes, and perform physical stock counts.
- Admins can view all transactions, review unusual adjustments, approve
  exceptional corrections, manage workers, and manage application settings.

Workers must never have access to Ginee credentials.

### Ginee integration

The browser must never communicate with Ginee using private credentials:

```text
Worker Device → Next.js Application → Next.js Backend / API → Ginee API
```

Store `GINEE_CLIENT_ID`, `GINEE_CLIENT_SECRET`, and `GINEE_ACCESS_TOKEN` only
as server environment secrets. Never expose them through client-side code or
public environment variables.

### Inventory flow

```text
Scan Product
      ↓
Enter Quantity
      ↓
Select Action
      ↓
Validate Request
      ↓
Send to Ginee
      ↓
Confirm Ginee Response
      ↓
Create Transaction Log
```

Only create a successful transaction log after Ginee confirms that the
inventory operation succeeded.

### Corrections and physical adjustments

Workers correct recent mistakes by creating a new transaction; the original
transaction must never be edited or deleted. For example, changing an
original `+50` entry to `+5` creates a `-45` correction.

Physical stock adjustment is separate from input correction. A worker may
adjust stock when the physical count differs from Ginee, while large or
unusual differences can require admin approval. Keep the adjustment threshold
configurable.

### Transaction logging

The lightweight log should record:

```text
id, user_id, sku, warehouse_id, action, quantity, status,
correction_of, reason, approved_by, created_at
```

It should answer who performed the operation, which SKU and warehouse were
affected, what changed, when it happened, whether it succeeded, whether it
was a correction, and who approved it when required.

### Security controls

- Individual accounts and secure sessions.
- Role-based permissions.
- Server-side validation for every inventory request.
- Server-only Ginee credentials.
- Rate limiting for inventory and correction endpoints.
- Idempotency to prevent duplicate processing after retries.
- Audit logging for successful and relevant failed operations.
- Immutable transaction records.
- HTTPS between the client, backend, and external APIs.

### Core principles

1. Ginee is the source of truth for inventory.
2. Next.js controls access and inventory operations.
3. The log database stores only transaction history and audit information.
