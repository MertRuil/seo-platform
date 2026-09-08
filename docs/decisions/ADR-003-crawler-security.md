# ADR-003: Strict SSRF Defense & Socket Pinning for Web Crawling

## Status
Accepted

## Context
The crawler fetches arbitrary user-supplied target domains and follows external HTTP redirects. Without strict network-layer isolation, this exposes internal container networks, local database/Redis ports, and cloud instance metadata endpoints (`169.254.169.254`) to Server-Side Request Forgery (SSRF) and DNS rebinding attacks.

## Decision
We enforce a custom `SafeHttpClient` network wrapper:
1. Every destination domain is explicitly resolved via DNS before socket creation.
2. All resolved IP addresses are checked against a comprehensive private/loopback/cloud-metadata subnet blacklist.
3. Socket connections are pinned directly to the pre-validated IP address, passing the target host via SNI and HTTP `Host` header.
4. Automatic HTTP client redirect following is disabled; redirects are inspected hop-by-hop with full DNS re-validation per hop.
5. Response streams are capped at 10 MB with bounded decompression to eliminate zip/decompression bombs.

## Consequences
### Positive
- Immune to classic SSRF, link-local metadata exfiltration, and time-of-check-time-of-use (TOCTOU) DNS rebinding attacks.
- Guaranteed isolation of internal infrastructure.

### Negative
- Custom socket pinning introduces minor DNS resolution overhead per uncached host.
