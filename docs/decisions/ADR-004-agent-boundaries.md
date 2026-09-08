# ADR-004: Specialist Agent Isolation & Prompt Injection Defense

## Status
Accepted

## Context
Crawling arbitrary third-party websites exposes the AI reasoning system to indirect prompt injection attacks embedded in web page text (e.g., hidden comments commanding the assistant to delete databases, modify permissions, or approve malicious redirects). Furthermore, monolithic LLM prompts attempting to handle technical diagnostics, content copywriting, and schema generation in a single call suffer from hallucination and extreme token waste.

## Decision
1. **Air-Gapped Tool Isolation:** LLM agents are strictly prohibited from possessing direct database write permissions or site execution tools. Agents produce purely advisory, strongly-typed Pydantic `Recommendation` data models.
2. **Untrusted Data Demarcation:** All crawled web content is wrapped in rigid `<UNTRUSTED_PAGE_CONTENT>` tags with explicit system instructions forbidding command execution from within that block.
3. **Orchestrator Pattern:** An `AI Orchestrator` invokes specialist agents (Technical, Content, InternalLink, StructuredData, Strategy) on-demand only when relevant deterministic issues exist, preventing indiscriminate token usage.

## Consequences
### Positive
- Prompt injection attempts cannot escape into destructive code execution.
- Lower token costs and faster inference times.
- Granular temperature control per task (e.g., 0.0 for structured data vs 0.4 for content strategy).

### Negative
- Multi-step orchestration requires careful state management in the backend worker.
