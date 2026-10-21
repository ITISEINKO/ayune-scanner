# Project: Comprehensive Codebase Documentation & Technical Audit

## 1. Role and Mission

Act as a Senior Software Architect, Technical Documentation Engineer, Reliability Engineer, Security Engineer, and Codebase Analyst.

Your mission is to inspect the existing repository and produce comprehensive, accurate, maintainable technical documentation covering the entire application.

The documentation must explain not only what the application does, but also how it works internally, including:

- System architecture and module dependencies.
- Application routes, pages, features, and shared components.
- Data flow, transformations, validation, and persistence.
- Database schemas, relationships, queries, and consistency.
- API endpoints, external integrations, and background processes.
- Authentication, authorization, permissions, and session management.
- Error handling, retries, timeouts, logging, and failure recovery.
- Concurrency, idempotency, and data integrity.
- Configuration, development, testing, deployment, and troubleshooting.
- Technical debt, reliability risks, security findings, and unverified behavior.

The final documentation must enable another developer or AI coding agent to understand the system and plan changes without having to rediscover the entire codebase.

## 2. Core Rules

1. Treat the actual repository implementation as the source of truth.
2. Never invent routes, functions, APIs, schemas, error handling, or business rules.
3. Trace important behavior across files and dependencies instead of documenting isolated snippets.
4. Document both normal execution paths and failure paths.
5. Distinguish verified facts, reasonable inferences, missing implementations, and unknown behavior.
6. Do not modify application source code, business logic, database schemas, or runtime configuration.
7. Create or update documentation files only, apart from disposable analysis artifacts.
8. Never expose secrets, credentials, access tokens, private keys, or sensitive user data.
9. Reference actual repository-relative file paths and implementation symbols.
10. Do not claim a test, check, or verification passed unless it was actually performed.
11. Maintain a persistent task tracker and repository coverage inventory throughout execution.
12. Do not mark a task complete merely because a document exists. Its required analysis and verification must also be complete.

---

# 3. Task Execution System

The project must be executed as a sequence of manageable tasks rather than one uninterrupted documentation-generation operation.

Use a dependency-aware workflow with explicit deliverables and completion criteria.

## 3.1. Task Statuses

Use these statuses consistently:

- `BACKLOG`: Not started.
- `READY`: Dependencies are complete and the task can begin.
- `IN_PROGRESS`: Currently being executed.
- `BLOCKED`: Cannot proceed because of a missing dependency, access, or unresolved issue.
- `REVIEW`: Draft is complete and awaits verification.
- `DONE`: Deliverables and acceptance criteria have been verified.
- `NOT_APPLICABLE`: The task does not apply to the repository, with a documented reason.

Do not mark tasks `DONE` when important findings remain unverified or mandatory acceptance criteria have not been met.

## 3.2. Task Tracker

Create the following project management files:

```
docs/
└── project/
    ├── README.md
    ├── task-board.md
    ├── repository-inventory.md
    ├── coverage-matrix.md
    ├── decisions-and-assumptions.md
    ├── blockers.md
    └── progress-log.md
```

### `task-board.md`

Maintain a table containing:

| Task ID | Task Name | Status | Dependencies | Deliverables | Verification |
| ------- | --------- | ------ | ------------ | ------------ | ------------ |

Track every task defined in this project.

### `repository-inventory.md`

Record discovered routes, modules, services, database models, API handlers, integrations, workers, configuration files, and tests.

### `coverage-matrix.md`

Track documentation coverage by repository component and topic.

For each component, track whether its architecture, data flow, dependencies, security, error handling, tests, and operational behavior have been inspected and documented where applicable.

### `decisions-and-assumptions.md`

Record:

- Architectural conclusions.
- Evidence supporting each conclusion.
- Inferences that remain unverified.
- Decisions made about documentation structure.
- Conflicting implementation patterns.
- Questions requiring human clarification.

### `blockers.md`

Record blocked tasks, missing access, unavailable external systems, unresolved dependencies, and their impact on completion.

### `progress-log.md`

Record concise, chronological progress updates, completed tasks, verification results, newly discovered dependencies, and next actions.

Update the task tracker after each meaningful task completion or when a blocker changes task readiness.

Do not update progress merely to produce activity. Every update must reflect actual work.

## 3.3. Task Execution Rules

- Follow the dependency graph described below.
- Execute independent tasks in parallel only when their shared inputs and outputs are clearly separated.
- Never execute dependent tasks before their required inputs are available.
- Establish the master inventory before delegating detailed documentation.
- Assign stable IDs to discovered routes, modules, integrations, and workflows where useful for coverage tracking.
- Keep findings and coverage information persistent in the repository.
- Before resuming after interruption, read the tracker and relevant progress notes instead of restarting from scratch.
- When context or time is limited, finish the current safe checkpoint, update the tracker, and resume from the next incomplete task.
- Do not create placeholder documentation and mark tasks complete.
- If the repository is too large to finish in one session, report the remaining work accurately and leave the project in a resumable state.

---

# 4. Task Breakdown and Dependencies

## Phase 1: Repository Discovery and Planning

### TASK DOC-001: Inspect Repository and Existing Documentation

**Dependencies:** None.

Inspect the repository structure, package manifests, entry points, configuration files, existing documentation, and project conventions.

Identify:

- Frameworks and languages.
- Application boundaries.
- Build and runtime tooling.
- Major directories.
- Existing documentation.
- Source files versus generated or vendored files.
- Relevant restrictions on inspecting or executing code.

**Deliverables:**

- Initial repository inventory.
- Initial task board.
- Identified documentation conventions.
- List of unresolved discovery questions.

**Acceptance criteria:**

- The repository structure has been inspected.
- Existing documentation has been identified.
- The initial task tracker exists.
- No application source code has been modified.

### TASK DOC-002: Build a Complete Component Inventory

**Dependencies:** DOC-001.

Discover and classify:

- Routes and page entry points.
- Features and functional modules.
- Components and layouts.
- Services, repositories, hooks, and utilities.
- API handlers and server actions.
- Database schemas and queries.
- Authentication and authorization mechanisms.
- External integrations.
- Background jobs and workers.
- Configuration and infrastructure.
- Tests and CI/CD workflows.

Exclude irrelevant generated files and dependency internals unless they materially affect application behavior.

**Deliverables:**

- `repository-inventory.md`
- Initial `coverage-matrix.md`
- Complete list of discovered documentation targets.

**Acceptance criteria:**

- Every discovered application entry point is recorded.
- Major modules and infrastructure dependencies are identified.
- Unknown or ambiguous components are explicitly recorded.

### TASK DOC-003: Map Dependencies and Execution Paths

**Dependencies:** DOC-002.

Trace the important relationships between components.

Identify:

- Application startup and initialization.
- Request lifecycle.
- Route-to-component dependencies.
- Component-to-service dependencies.
- Service-to-database dependencies.
- External API invocation paths.
- Background execution paths.
- Shared state and cross-module interactions.

**Deliverables:**

- Initial module dependency map.
- Initial execution-path map.
- List of critical workflows requiring deeper analysis.

**Acceptance criteria:**

- Important execution paths are grounded in actual code.
- Indirect dependencies are recorded.
- Unresolved dependency chains are identified.

### TASK DOC-004: Finalize Documentation Plan

**Dependencies:** DOC-003.

Create the definitive documentation structure, task dependencies, and coverage requirements based on the actual repository.

**Deliverables:**

- Final task breakdown.
- Final documentation directory structure.
- Updated task board.
- Dependency graph and execution order.

**Acceptance criteria:**

- Every required documentation domain has an assigned task.
- No major domain is left without an owner task.
- The task plan accounts for the repository's actual technologies and architecture.

---

## Phase 2: Architecture and System Foundations

### TASK DOC-010: Document System Architecture

**Dependencies:** DOC-004.

Document the architecture, major layers, module boundaries, runtime responsibilities, entry points, and design patterns.

Include useful Mermaid diagrams where they improve understanding.

**Deliverables:**

- `docs/architecture/architecture-overview.md`
- `docs/system-overview.md`

**Acceptance criteria:**

- The major system boundaries are explained.
- Diagrams match verified implementation.
- Important architectural assumptions are documented.

### TASK DOC-011: Document Module Dependencies

**Dependencies:** DOC-003, DOC-010.

Explain how modules depend on each other and identify shared infrastructure and important coupling points.

**Deliverables:**

- `docs/architecture/module-dependencies.md`
- Updated module inventory.

**Acceptance criteria:**

- Major dependency chains are traceable.
- Shared modules and critical dependencies are identified.
- Potential circular dependencies or fragile coupling are recorded where found.

### TASK DOC-012: Document Startup and Execution Lifecycle

**Dependencies:** DOC-010.

Trace application initialization, configuration loading, runtime startup, request processing, background execution, and shutdown behavior where applicable.

**Deliverables:**

- `docs/architecture/execution-lifecycle.md`

**Acceptance criteria:**

- Startup and critical execution paths are explained.
- Relevant runtime boundaries are documented.
- Unverified infrastructure behavior is clearly distinguished.

### TASK DOC-013: Document Architectural Decisions and Constraints

**Dependencies:** DOC-010, DOC-011, DOC-012.

Record evidenced architectural decisions, implementation constraints, existing trade-offs, and areas where the rationale cannot be determined from the repository.

**Deliverables:**

- `docs/architecture/design-decisions.md`
- Updated `decisions-and-assumptions.md`

**Acceptance criteria:**

- Verified implementation decisions are distinguished from inferred intent.
- No invented historical rationale is presented as fact.

---

## Phase 3: Data Architecture and Persistence

### TASK DOC-020: Document Database Schemas and Relationships

**Dependencies:** DOC-002, DOC-010.

Inspect schema definitions, migrations, models, constraints, indexes, and relationships.

**Deliverables:**

- `docs/data/database-schema.md`

**Acceptance criteria:**

- Relevant entities, fields, keys, and relationships are documented.
- Constraints and indexes are included where verifiable.
- The documented schema reflects actual definitions.

### TASK DOC-021: Trace Data Access Patterns

**Dependencies:** DOC-020, DOC-011.

Trace database reads, writes, queries, repositories, transaction boundaries, and persistence abstractions.

**Deliverables:**

- `docs/data/data-access-patterns.md`

**Acceptance criteria:**

- Important queries and mutation paths are traceable.
- Data access responsibilities are explained.
- Relevant transaction and consistency limitations are documented.

### TASK DOC-022: Document End-to-End Data Flow

**Dependencies:** DOC-021, DOC-012.

Trace data from user input, internal events, or external systems through validation, transformations, business logic, persistence, and output.

**Deliverables:**

- `docs/data/data-flow.md`

**Acceptance criteria:**

- Critical workflows have verified data-flow descriptions.
- Important transformations and side effects are documented.
- Cross-system boundaries and data ownership are identified.

### TASK DOC-023: Document Validation and Normalization

**Dependencies:** DOC-021, DOC-022.

Inspect client and server validation, schemas, sanitization, type conversion, default values, and data normalization.

**Deliverables:**

- `docs/data/validation-and-normalization.md`

**Acceptance criteria:**

- Validation locations and rules are documented.
- Duplicate or inconsistent validation is identified where relevant.
- Missing or inconsistent protections are recorded separately.

### TASK DOC-024: Analyze Transactions and Data Consistency

**Dependencies:** DOC-021, DOC-022.

Investigate partial writes, transaction boundaries, concurrent updates, stale state, duplicate records, and cross-system inconsistencies.

**Deliverables:**

- `docs/data/transactions-and-consistency.md`

**Acceptance criteria:**

- Existing consistency protections are documented.
- Potential failure scenarios are traced to actual operations.
- Missing atomicity or reconciliation mechanisms are identified where supported by evidence.

---

## Phase 4: Application, Features, and API Documentation

### TASK DOC-030: Document Routing and Navigation

**Dependencies:** DOC-002, DOC-010.

Document all routes, nested layouts, dynamic segments, route guards, redirects, and navigation behavior.

**Deliverables:**

- `docs/application/routing-and-navigation.md`
- `docs/reference/route-inventory.md`

**Acceptance criteria:**

- All discovered routes are represented in the inventory.
- Public, protected, dynamic, and API routes are distinguished.
- Redirect behavior is grounded in implementation.

### TASK DOC-031: Document Pages and Features

**Dependencies:** DOC-030, DOC-022.

Document each discovered page and major functional feature, including purpose, dependencies, data usage, state, business rules, permissions, side effects, and error behavior.

**Deliverables:**

- `docs/application/pages-and-features.md`
- Individual page or feature documents when justified by repository size.

**Acceptance criteria:**

- Every applicable page and major feature has documented coverage.
- The documentation explains behavior, not merely UI appearance.
- Important cross-page workflows are included.

### TASK DOC-032: Document Components and State Management

**Dependencies:** DOC-011, DOC-031.

Document reusable components, shared UI logic, hooks, global state, server state, URL state, and state synchronization.

**Deliverables:**

- `docs/application/components-and-ui.md`
- `docs/application/state-management.md`
- `docs/shared/components.md`

**Acceptance criteria:**

- Important shared components and state mechanisms are explained.
- Relevant dependencies and state lifecycles are traceable.
- Page documentation links to shared references.

### TASK DOC-033: Document APIs and Backend Services

**Dependencies:** DOC-021, DOC-022, DOC-023.

Document API routes, server actions, backend services, request and response contracts, validation, persistence, side effects, and authorization.

**Deliverables:**

- `docs/backend/api-reference.md`
- `docs/backend/services-and-business-logic.md`
- `docs/api/README.md`

**Acceptance criteria:**

- Discovered endpoints and backend entry points are inventoried.
- Request and response descriptions are grounded in code.
- Important database and external side effects are documented.

### TASK DOC-034: Document Background Processing

**Dependencies:** DOC-011, DOC-022.

Inspect workers, queues, scheduled jobs, event handlers, and asynchronous processing if present.

**Deliverables:**

- `docs/backend/background-processing.md`

**Acceptance criteria:**

- Applicable asynchronous execution paths are documented.
- Retry, failure, state, and scheduling behavior are explained where implemented.
- If no such mechanisms exist, the absence is recorded with appropriate scope.

---

## Phase 5: Security and Access Control

### TASK DOC-040: Document Authentication and Sessions

**Dependencies:** DOC-010, DOC-030.

Trace login, logout, session creation, session validation, expiration, refresh, cookies or tokens, and protected-route behavior.

**Deliverables:**

- `docs/security/authentication-and-sessions.md`

**Acceptance criteria:**

- The actual authentication lifecycle is documented.
- Session storage and validation points are identified.
- Missing or unverified behavior is recorded.

### TASK DOC-041: Document Authorization and Permissions

**Dependencies:** DOC-040, DOC-033.

Trace role resolution, permission checks, record-level authorization, backend enforcement, and unauthorized behavior.

**Deliverables:**

- `docs/security/authorization-and-permissions.md`

**Acceptance criteria:**

- Critical permission boundaries are identified.
- UI restrictions are distinguished from server-side enforcement.
- Unprotected sensitive operations are documented when verified.

### TASK DOC-042: Perform Security Review

**Dependencies:** DOC-040, DOC-041, DOC-023.

Inspect relevant input handling, secret management, sensitive data exposure, external integration security, and other applicable security boundaries.

**Deliverables:**

- `docs/security/security-considerations.md`

**Acceptance criteria:**

- Findings include evidence and affected locations.
- Severity is justified rather than guessed.
- No secrets are copied into documentation.

---

## Phase 6: Reliability, Errors, and Recovery

### TASK DOC-050: Inventory Error-Handling Mechanisms

**Dependencies:** DOC-012, DOC-033, DOC-034.

Identify exception handlers, validation failures, API error handlers, database error handling, global handlers, logging, and background-job failure paths.

**Deliverables:**

- Initial error-handling inventory.
- Updated coverage matrix.

**Acceptance criteria:**

- Major error-handling locations are inventoried.
- Critical workflows requiring deeper failure analysis are identified.

### TASK DOC-051: Document Error Propagation and Handling

**Dependencies:** DOC-050.

Trace errors from their origin to their final outcome.

For each important workflow, explain where errors originate, whether they are caught or propagated, how they are transformed, what callers receive, what gets logged, and whether partial side effects remain.

**Deliverables:**

- `docs/reliability/error-handling.md`

**Acceptance criteria:**

- Critical error paths are traced through relevant layers.
- Silent failures and swallowed exceptions are identified where found.
- User-facing responses and internal diagnostics are distinguished.

### TASK DOC-052: Document Retries, Timeouts, and Rate Limits

**Dependencies:** DOC-051, DOC-033, DOC-034.

Inspect retry policies, backoff, timeout settings, rate-limit handling, retry exhaustion, and duplicate-side-effect risks.

**Deliverables:**

- `docs/reliability/retries-and-timeouts.md`

**Acceptance criteria:**

- Existing policies and configuration locations are documented.
- Retryable and non-retryable conditions are identified where verifiable.
- Unsafe retry scenarios are recorded.

### TASK DOC-053: Document Logging and Monitoring

**Dependencies:** DOC-051.

Trace application logs, structured logging, error-reporting integrations, monitoring, metrics, and alerting.

**Deliverables:**

- `docs/reliability/logging-and-monitoring.md`

**Acceptance criteria:**

- Logging and monitoring paths are documented.
- Diagnostic context and visibility gaps are identified.
- Missing integrations are not represented as existing capabilities.

### TASK DOC-054: Document Failure Recovery and Reconciliation

**Dependencies:** DOC-024, DOC-051, DOC-052.

Investigate partial success, interrupted operations, external API ambiguity, failed persistence, background-job recovery, replay safety, and reconciliation.

**Deliverables:**

- `docs/reliability/failure-recovery.md`

**Acceptance criteria:**

- Applicable partial-failure scenarios are traced.
- Recovery mechanisms and manual recovery requirements are explained.
- Unsupported recovery assumptions are explicitly flagged.

### TASK DOC-055: Analyze Concurrency and Idempotency

**Dependencies:** DOC-024, DOC-052, DOC-054.

Inspect duplicate submissions, concurrent execution, unique constraints, locking, idempotency keys, race conditions, and cross-system consistency.

**Deliverables:**

- `docs/reliability/concurrency-and-idempotency.md`

**Acceptance criteria:**

- Existing protections are documented.
- Relevant race conditions are identified with implementation evidence.
- Exactly-once guarantees are not claimed without sufficient technical support.

---

## Phase 7: Integrations and Operations

### TASK DOC-060: Document External Integrations

**Dependencies:** DOC-022, DOC-033, DOC-052.

Inspect external APIs, SDKs, webhooks, file storage, and other external dependencies.

**Deliverables:**

- `docs/backend/integrations.md`

**Acceptance criteria:**

- Integration entry points and exchanged data are documented.
- Authentication mechanisms, errors, retries, and rate limits are described where verifiable.
- External behavior that cannot be confirmed is marked accordingly.

### TASK DOC-061: Document Configuration and Environment Variables

**Dependencies:** DOC-001, DOC-010.

Inventory runtime configuration, environment variables, feature flags, and required external services.

**Deliverables:**

- `docs/operations/setup-and-configuration.md`
- `docs/operations/environment-variables.md`
- `docs/reference/configuration-reference.md`

**Acceptance criteria:**

- Required configuration variables and their purposes are documented.
- Actual values of secrets are never disclosed.
- Required versus optional settings are distinguished where verifiable.

### TASK DOC-062: Document Development and Testing

**Dependencies:** DOC-001, DOC-061.

Inspect package scripts, local setup, test frameworks, fixtures, CI checks, and debugging workflows.

**Deliverables:**

- `docs/operations/development-workflow.md`
- `docs/operations/testing.md`

**Acceptance criteria:**

- Commands match actual repository scripts.
- Existing test coverage and gaps are described.
- Test execution claims are evidence-based.

### TASK DOC-063: Document Deployment and Operations

**Dependencies:** DOC-061, DOC-062.

Inspect build, deployment configuration, runtime requirements, health checks, startup dependencies, and operational procedures.

**Deliverables:**

- `docs/operations/deployment.md`
- `docs/operations/troubleshooting.md`

**Acceptance criteria:**

- Verified deployment assumptions are documented.
- Troubleshooting steps correspond to actual implementation and configuration.
- Unverified infrastructure behavior is identified.

### TASK DOC-064: Document Shared Utilities and Operational Reference

**Dependencies:** DOC-011, DOC-032, DOC-033, DOC-053.

Document reusable utilities, common service abstractions, shared error types, and other cross-cutting functionality.

**Deliverables:**

- `docs/shared/utilities-and-services.md`
- `docs/shared/error-handling.md`
- `docs/reference/module-inventory.md`
- `docs/reference/glossary.md`

**Acceptance criteria:**

- Shared behavior is documented once and cross-referenced.
- Important module responsibilities are easy to locate.
- Terminology is consistent throughout the documentation.

---

## Phase 8: Audit and Technical Debt

### TASK DOC-070: Audit Reliability and Error-Handling Gaps

**Dependencies:** DOC-051, DOC-052, DOC-053, DOC-054, DOC-055.

Review documented findings and verify important error-handling gaps against the implementation.

**Deliverables:**

- Reliability findings for the final technical audit.

**Acceptance criteria:**

- Findings have supporting evidence.
- Potential risks are distinguished from confirmed defects.
- Recommendations do not alter the source code.

### TASK DOC-071: Audit Data Integrity and Performance Risks

**Dependencies:** DOC-021, DOC-024, DOC-055.

Review duplicate risks, inconsistent state, inefficient queries, concurrency issues, and other applicable performance concerns.

**Deliverables:**

- Data integrity and performance findings.

**Acceptance criteria:**

- Findings are traceable to specific code paths.
- Performance claims are not fabricated.
- Recommendations are separate from observed behavior.

### TASK DOC-072: Consolidate Security and Technical Debt Findings

**Dependencies:** DOC-042, DOC-070, DOC-071.

Consolidate verified issues, architectural risks, missing tests, and maintainability concerns.

**Deliverables:**

- `docs/audit/known-limitations.md`
- `docs/audit/technical-debt.md`

**Acceptance criteria:**

- Findings include affected locations, impact, evidence, and recommendations.
- Duplicate findings are consolidated.
- Unverified concerns remain explicitly labeled.

---

## Phase 9: Verification and Completion

### TASK DOC-080: Verify Documentation Coverage

**Dependencies:** All applicable documentation tasks.

Compare the repository inventory with the coverage matrix and actual generated documents.

Verify coverage of:

- Routes and features.
- Major modules and shared components.
- APIs and external integrations.
- Database entities and access patterns.
- Authentication and authorization.
- Error handling and failure recovery.
- Configuration and operational procedures.
- Tests and known limitations.

**Deliverables:**

- `docs/audit/documentation-coverage.md`
- Updated `docs/project/coverage-matrix.md`

**Acceptance criteria:**

- Every discovered documentation target has a recorded status.
- Exclusions have documented reasons.
- Incomplete and unverified coverage is visible.
- No task is marked complete merely because its file exists.

### TASK DOC-081: Validate References and Cross-Links

**Dependencies:** DOC-080.

Verify internal Markdown links, source paths, symbol names, route references, and important technical claims.

Use lightweight validation scripts or existing tools when appropriate, without modifying application behavior.

**Deliverables:**

- Validation results.
- Corrected documentation references.
- Updated task board.

**Acceptance criteria:**

- Internal links resolve where they target existing documents.
- Referenced source files exist.
- Any unverifiable symbol or line reference is corrected or marked uncertain.
- The validation scope and limitations are documented.

### TASK DOC-082: Final Review and Handover

**Dependencies:** DOC-080, DOC-081.

Review the documentation as a developer encountering the repository for the first time.

Verify that the system can be understood from the documentation without repeatedly rediscovering its architecture and behavior.

**Deliverables:**

- `docs/README.md`
- Updated `docs/project/README.md`
- Final task board.
- Final coverage matrix.
- Final progress log.
- Final handover report.

**Acceptance criteria:**

- Documentation navigation is clear.
- Major execution paths and failure paths are traceable.
- Remaining gaps are explicitly reported.
- Application source code remains unchanged.
- Final completion claims match verified results.

---

# 5. Task Dependency Overview

Follow this dependency order:

```
flowchart TD
    A["DOC-001: Repository Discovery"] --> B["DOC-002: Component Inventory"]
    B --> C["DOC-003: Dependency Mapping"]
    C --> D["DOC-004: Finalize Task Plan"]

    D --> E["DOC-010–013: Architecture"]
    D --> F["DOC-020–024: Data Architecture"]
    D --> G["DOC-030–034: Application and APIs"]

    E --> H["DOC-040–042: Security"]
    F --> I["DOC-050–055: Reliability"]
    G --> I
    F --> J["DOC-060–064: Integrations and Operations"]
    G --> J

    H --> K["DOC-070–072: Technical Audit"]
    I --> K
    J --> K

    K --> L["DOC-080: Coverage Verification"]
    L --> M["DOC-081: Reference Validation"]
    M --> N["DOC-082: Final Review"]
```

The task ranges above represent related task groups. Every individual task must still be tracked separately in `task-board.md`.

Do not execute all tasks in a phase blindly if a specific task has unresolved dependencies.

---

# 6. Documentation Quality Gates

Each task must pass the following applicable checks before it can be marked `DONE`.

## Gate A: Evidence

- Implementation files have been inspected.
- Important claims have traceable evidence.
- Assumptions are labeled.
- No functionality has been invented.

## Gate B: Completeness

- All task-specific deliverables exist.
- Mandatory topics are covered.
- Cross-module dependencies have been investigated.
- Error paths are included where relevant.

## Gate C: Technical Accuracy

- File paths and symbols are verified.
- Data flow matches actual execution.
- Security and reliability claims are appropriately qualified.
- Source references are accurate.

## Gate D: Documentation Integrity

- Markdown structure is valid.
- Internal links are checked when applicable.
- Shared explanations are cross-referenced.
- Secrets are not disclosed.

## Gate E: Change Safety

- Application source code has not been modified.
- No production mutation or destructive operation was performed.
- Any validation commands and their effects are recorded.

If a gate fails, return the task to `IN_PROGRESS` or `REVIEW`, document the issue, and resolve it before declaring completion.

---

# 7. Handling Blockers and Partial Completion

If a task cannot be completed:

1. Record it in `blockers.md`.
2. Explain what is missing and why it matters.
3. Identify dependent tasks affected by the blocker.
4. Continue independent tasks where safe.
5. Mark incomplete coverage honestly.
6. Record the exact next action required to resume.

Do not block the entire project because one external API or service is unavailable if its local implementation can still be analyzed.

Do not silently skip difficult modules.

---

# 8. Final Deliverables

The final documentation repository must include:

1. System overview and architecture.
2. Module dependency and execution lifecycle documentation.
3. Page, feature, component, and route documentation.
4. Data flow, database, validation, and consistency documentation.
5. API, backend, and external integration references.
6. Authentication, authorization, and security documentation.
7. Detailed error handling, retries, logging, and failure recovery.
8. Concurrency, idempotency, and data integrity analysis.
9. Development, configuration, testing, deployment, and troubleshooting guides.
10. Technical debt and reliability audit.
11. Task board, coverage matrix, blockers, and progress log.
12. Final documentation validation and handover report.

The root `docs/README.md` must act as the primary entry point, linking to the relevant documents by topic.

The project tracker must remain useful even if execution is interrupted and resumed in another session.

## Final Definition of Done

The project is complete only when:

- All applicable tasks have been verified as `DONE`.
- All inapplicable tasks have documented reasons.
- All discovered routes, modules, workflows, and relevant infrastructure have recorded coverage.
- Important normal and failure execution paths are documented.
- Critical security and data-integrity boundaries are explained.
- Documentation references and internal links have been validated to the extent reported.
- Remaining uncertainties and blockers are explicitly listed.
- The task board accurately reflects actual completion.
- Application source code remains unchanged.

Begin with DOC-001. Build the task tracker and repository inventory before generating detailed documentation. Continue through the dependency graph, updating progress and verification evidence as work advances. Do not claim full completion until DOC-082 passes its acceptance criteria.

## Vault links

- [[README|Vault index and Obsidian formatting guide]]
- Related: [[Prompts/Codebase-Audit-Technical-Documentation|Codebase audit and technical documentation prompt]]
