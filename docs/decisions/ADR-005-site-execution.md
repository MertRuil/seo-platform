# ADR-005: Safe Site Mutation, Optimistic Concurrency & Rollback

## Status
Accepted

## Context
Autonomous modifications to live production websites introduce significant risks: concurrent edits could cause stale overwrites, network timeouts could lead to partial states, and incorrect tags could damage search indexing. The platform requires a failsafe mutation protocol.

## Decision
We establish a mandatory **5-Step Safe Mutation Protocol**:
1. **Optimistic Concurrency Check:** Before initiating a write, the target page's current live state is fetched and its content hash is verified against `expected_hash_before`. If a discrepancy is detected, execution aborts immediately.
2. **Pre-Write Backup:** The pre-change live snapshot is persisted to S3/MinIO.
3. **Connector Execution:** The change is applied through the appropriate connector (`WordPressConnector`, `GitBasedConnector` PR, or HMAC-signed webhook).
4. **Post-Write Live Validation:** The page is instantly re-crawled to verify HTTP 200 and confirm the target mutation is present.
5. **Automated Atomic Rollback:** If post-validation fails, a 5xx error occurs, or unexpected regressions are detected, the system immediately reverts the change using the backup snapshot.

## Consequences
### Positive
- Zero risk of silent out-of-band overwrite bugs.
- Instant, deterministic recovery in the event of CMS or network failures.
- Complete audit trail of all site alterations.

### Negative
- Extra network roundtrips for pre-check and post-crawl validation.
