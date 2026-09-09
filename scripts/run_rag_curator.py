import asyncio
import argparse
import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Reconfigure stdout/stderr for Windows UTF-8 compatibility
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from services.rag.hybrid_store import HybridKnowledgeStore
from services.rag.curator_agent import AutonomousRAGCurator
from services.rag.seeds import SEED_DOCUMENTS
from services.rag.chunker import SemanticChunker

async def main():
    parser = argparse.ArgumentParser(description="Autonomous RAG Curator Agent (Multi-Day Continuous Operation)")
    parser.add_argument("--mode", choices=["simulate", "continuous"], default="simulate", help="Execution mode")
    parser.add_argument("--days", type=int, default=3, help="Number of days to simulate (default: 3)")
    parser.add_argument("--seed", action="store_true", help="Pre-load official seed documents before curation")
    parser.add_argument("--store-path", default="data/knowledge_store.json", help="Path to persisted store")
    parser.add_argument("--state-path", default="data/curator_state.json", help="Path to persistent state file")
    args = parser.parse_args()

    print("=" * 70)
    print("      AUTONOMOUS AI SEO PLATFORM - KNOWLEDGE CURATOR AGENT")
    print("=" * 70)
    print(f"Mode: {args.mode.upper()}")
    print(f"Target Operation Period: {args.days} Days")
    print(f"Knowledge Store Path: {args.store_path}")
    print(f"Curator State Path: {args.state_path}")
    print("-" * 70)

    store = HybridKnowledgeStore()
    if os.path.exists(args.store_path):
        print(f"[+] Loading existing knowledge store from {args.store_path}...")
        store.load_from_disk(args.store_path)
        stats = store.get_stats()
        print(f"[+] Loaded {stats['total_chunks']} chunks ({stats['verified_chunks']} verified, {stats['active_chunks']} active).")

    if args.seed:
        print("[+] Pre-loading official Level-1 SEO seeds...")
        initial_chunks = 0
        for doc in SEED_DOCUMENTS:
            chunks = SemanticChunker.chunk_markdown(doc["content"], doc["title"])
            for idx, c in enumerate(chunks):
                store.add_chunk(
                    chunk_id=f"{doc['id']}-init-{idx}",
                    document_title=doc["title"],
                    heading_path=c.heading_path,
                    content=c.content,
                    vector=[0.05] * 128,
                    status=doc["status"],
                    canonical_url=doc.get("canonical_url", ""),
                    authority_level=doc.get("authority_level", "LEVEL_1_OFFICIAL"),
                    verification_status="VERIFIED" if doc["status"] == "ACTIVE" else "DEPRECATED"
                )
                initial_chunks += 1
        print(f"[+] Seeded {initial_chunks} chunks into store.")

    curator = AutonomousRAGCurator(
        knowledge_store=store,
        state_file=args.state_path,
        store_file=args.store_path
    )

    if args.mode == "simulate":
        print(f"\n[+] Starting {args.days}-Day Autonomous Ingestion & Fact Verification Simulation...")
        result = await curator.simulate_multi_day_run(days=args.days)

        print("\n" + "=" * 70)
        print(f"      CURATION COMPLETED: {result['days_run']} DAYS PROCESSED")
        print("=" * 70)
        for s in result["daily_summaries"]:
            print(f"\n>> Day {s['day']}:")
            print(f"   Evaluated: {s['documents_evaluated']} documents")
            print(f"   Verified:  {s['verified']} (Ingested {s['chunks_ingested']} chunks)")
            print(f"   Rejected:  {s['rejected']} (Debunked myths / unverified claims)")
            m = s["metrics"]
            print(f"   Rate Limits: {m['requests_today']}/{m['daily_request_budget']} reqs ({m['request_quota_used_pct']}% daily budget)")
            print(f"   Tokens:      {m['tokens_today']}/{m['daily_token_budget']} ({m['token_quota_used_pct']}% token budget)")
            print(f"   Cache Hits:  {m['cache_hits']}")

        final_stats = result["store_stats"]
        print("\n" + "-" * 70)
        print("FINAL RAG KNOWLEDGE STORE STATUS:")
        print(f"  Total Chunks:            {final_stats['total_chunks']}")
        print(f"  Active Verified Chunks:  {final_stats['active_chunks']}")
        print(f"  Deprecated Chunks:       {final_stats['deprecated_chunks']}")
        print(f"  Level-1 Official Chunks: {final_stats['level_1_official_chunks']}")
        print(f"  Store Saved To:          {args.store_path}")
        print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
