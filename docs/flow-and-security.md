# Inventory App — High-Level Architecture & Security

## 1. System Overview

The application is a lightweight warehouse inventory interface built with **Next.js** and integrated directly with **Ginee**.

Ginee remains the **source of truth for inventory data**. The application does not maintain a separate product or stock database.

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

The application is primarily responsible for providing a safer and simpler interface for warehouse workers to perform inventory operations.

---

## 2. Main Responsibilities

### Next.js Application

The application handles:

- Worker authentication
- Role and permission management
- Product scanning
- Stock input
- Stock subtraction
- Stock correction
- Physical stock adjustment
- Transaction history
- Ginee API communication

### Ginee

Ginee remains responsible for:

- Product data
- Warehouse inventory
- Current stock quantities
- Inventory synchronization
- Other existing marketplace and inventory operations

### Log Database

A lightweight database is used only to record inventory activities.

It does **not** duplicate Ginee's inventory data.

---

# 3. Authentication & Authorization

Each warehouse worker should have an individual account.

```text
Worker
   ↓
Login
   ↓
Authenticated Session
   ↓
Inventory App
```

The system should use role-based access control.

### Worker

Workers can:

- Scan products
- Add stock
- Subtract stock
- View their transactions
- Correct recent mistakes
- Perform physical stock counts

### Admin

Admins can:

- View all transactions
- Review unusual adjustments
- Approve exceptional corrections
- Manage workers
- Manage application settings
- Manage Ginee integration settings

Workers should never have access to Ginee credentials.

---

# 4. Ginee Integration

The browser should never communicate with Ginee using private credentials.

Instead:

```text
Worker Device
      │
      ▼
Next.js Application
      │
      ▼
Next.js Backend / API
      │
      ▼
Ginee API
```

Ginee credentials are stored only on the server using environment secrets.

```text
GINEE_CLIENT_ID
GINEE_CLIENT_SECRET
GINEE_ACCESS_TOKEN
```

These credentials must never be exposed through client-side code or public environment variables.

---

# 5. Inventory Operations

The main inventory flow is:

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

The application should only record a successful transaction after Ginee confirms that the inventory operation succeeded.

---

# 6. Correction Flow

Workers should be able to correct their own recent mistakes.

The original transaction must never be edited or deleted.

Instead, the system creates a new transaction that corrects the previous one.

```text
Original Transaction
        ↓
Worker Identifies Mistake
        ↓
Correction
        ↓
Calculate Difference
        ↓
Ginee Adjustment
        ↓
Create Correction Log
```

Example:

```text
Original:    +50
Correct:      +5
Correction:  -45
```

This preserves the complete transaction history.

---

# 7. Physical Stock Adjustment

Physical stock adjustment is different from correcting an input mistake.

### Input Correction

> "I entered the wrong quantity."

### Stock Adjustment

> "The physical stock is different from the stock recorded in Ginee."

Example:

```text
Ginee Stock:       100
Physical Count:     97
Adjustment:         -3
```

Workers can perform normal adjustments because they are responsible for the physical inventory.

Large or unusual adjustments can require admin approval.

```text
Small Difference
       ↓
Worker
       ↓
Ginee

Large Difference
       ↓
Admin Approval
       ↓
Ginee
```

The adjustment threshold should be configurable.

---

# 8. Transaction Logging

The system maintains a lightweight transaction log for audit purposes.

Example:

```text
inventory_logs

id
user_id
sku
warehouse_id
action
quantity
status
correction_of
reason
approved_by
created_at
```

The log should answer:

- Who performed the operation?
- What SKU was affected?
- Which warehouse was affected?
- What action was performed?
- How much stock was changed?
- When did it happen?
- Was the operation successful?
- Was it a correction?
- Who approved it, if approval was required?

The log database does not need to store complete product or inventory information.

---

# 9. Security Controls

The application should implement the following basic security controls:

### Authentication

Individual accounts and secure sessions for warehouse workers.

### Authorization

Role-based permissions for workers and admins.

### Input Validation

All inventory requests must be validated on the server.

### Server-Side Ginee Credentials

Ginee credentials must never be exposed to the browser.

### Rate Limiting

Limit requests to inventory and correction endpoints to prevent accidental or malicious abuse.

### Idempotency

Prevent the same inventory transaction from being processed multiple times due to network failures or repeated requests.

### Audit Logging

Record every successful inventory operation and relevant failed operations.

### Immutable Transactions

Existing transaction records should not be edited or deleted.

### HTTPS

All communication between the client, backend, and external APIs must use HTTPS.

---

# 10. Recommended Architecture

```text
┌─────────────────────────┐
│   Warehouse Worker      │
│   Phone / Tablet / PC   │
└────────────┬────────────┘
             │
             │ HTTPS
             ▼
┌─────────────────────────┐
│       Next.js App       │
│                         │
│ Authentication          │
│ UI / Scanner            │
│ Transaction History     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│     Next.js Backend     │
│                         │
│ Authorization           │
│ Validation              │
│ Rate Limiting           │
│ Idempotency             │
│ Ginee Integration       │
└────────────┬────────────┘
             │
        ┌────┴─────┐
        ▼          ▼
┌────────────┐ ┌──────────────┐
│   Ginee    │ │   Log DB     │
│            │ │              │
│ Stock      │ │ Transactions │
│ Products   │ │ Audit Trail  │
│ Warehouse  │ │ Corrections  │
└────────────┘ └──────────────┘
```

## Core Principle

The system should follow three core principles:

1. **Ginee is the source of truth for inventory.**
2. **Next.js controls access and inventory operations.**
3. **The log database stores only transaction history and audit information.**

This keeps the application lightweight while providing enough security, accountability, and flexibility for day-to-day warehouse operations.
