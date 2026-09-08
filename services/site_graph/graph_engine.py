import networkx as nx
from typing import List, Dict, Any, Set, Tuple

class SiteGraphEngine:
    def __init__(self):
        self.graph = nx.DiGraph()

    def build_graph(self, pages: List[Dict[str, Any]], links: List[Dict[str, Any]]):
        """Builds directed graph from crawled pages and hyperlinks."""
        self.graph.clear()
        for page in pages:
            url = page.get("url")
            if url:
                self.graph.add_node(url, title=page.get("title", ""), status_code=page.get("status_code", 200))

        for link in links:
            source = link.get("source_url")
            target = link.get("target_url")
            if source and target and link.get("is_internal", True):
                if not self.graph.has_node(source):
                    self.graph.add_node(source)
                if not self.graph.has_node(target):
                    self.graph.add_node(target)
                self.graph.add_edge(
                    source,
                    target,
                    anchor_text=link.get("anchor_text", ""),
                    rel=link.get("rel", "")
                )

    @staticmethod
    def _calculate_pagerank(graph: nx.DiGraph, alpha: float = 0.85, max_iter: int = 100, tol: float = 1e-6) -> Dict[str, float]:
        """Pure-Python power iteration implementation of Google PageRank algorithm without external heavy scipy dependency."""
        nodes = list(graph.nodes)
        n = len(nodes)
        if n == 0:
            return {}
        pr = {node: 1.0 / n for node in nodes}
        out_degrees = dict(graph.out_degree())

        for _ in range(max_iter):
            prev_pr = dict(pr)
            dangling_sum = sum(prev_pr[node] for node in nodes if out_degrees[node] == 0)
            dangling_contrib = alpha * (dangling_sum / n)
            base_score = (1.0 - alpha) / n + dangling_contrib
            diff = 0.0

            for node in nodes:
                incoming_sum = sum(
                    prev_pr[pred] / out_degrees[pred]
                    for pred in graph.predecessors(node)
                    if out_degrees[pred] > 0
                )
                pr[node] = base_score + alpha * incoming_sum
                diff += abs(pr[node] - prev_pr[node])

            if diff < tol:
                break

        return pr

    def compute_metrics(self, root_url: str) -> Dict[str, Any]:
        """Computes internal PageRank, click depths, in-degree, out-degree, and orphan detection."""
        if len(self.graph.nodes) == 0:
            return {
                "pagerank": {},
                "depths": {},
                "in_degrees": {},
                "out_degrees": {},
                "orphan_pages": [],
                "dead_ends": []
            }

        # 1. PageRank calculation
        pr = self._calculate_pagerank(self.graph, alpha=0.85)

        # 2. Shortest path (click depth) from root_url
        depths: Dict[str, int] = {}
        if self.graph.has_node(root_url):
            try:
                paths = nx.single_source_shortest_path_length(self.graph, root_url)
                depths = paths
            except Exception:
                depths = {root_url: 0}

        # 3. Degrees and Orphan pages
        in_degrees = dict(self.graph.in_degree())
        out_degrees = dict(self.graph.out_degree())

        orphan_pages = [
            node for node, in_deg in in_degrees.items()
            if in_deg == 0 and node != root_url
        ]

        dead_ends = [
            node for node, out_deg in out_degrees.items()
            if out_deg == 0
        ]

        return {
            "pagerank": pr,
            "depths": depths,
            "in_degrees": in_degrees,
            "out_degrees": out_degrees,
            "orphan_pages": orphan_pages,
            "dead_ends": dead_ends,
            "total_nodes": len(self.graph.nodes),
            "total_edges": len(self.graph.edges)
        }

    def find_internal_link_opportunities(self, root_url: str, min_hub_pr_percentile: float = 0.7) -> List[Dict[str, Any]]:
        """Identifies high PageRank hub pages that can link to orphan or weak deep pages."""
        metrics = self.compute_metrics(root_url)
        pr = metrics["pagerank"]
        if not pr:
            return []

        sorted_by_pr = sorted(pr.items(), key=lambda x: x[1], reverse=True)
        hub_cutoff_idx = max(1, int(len(sorted_by_pr) * (1.0 - min_hub_pr_percentile)))
        hubs = [url for url, _ in sorted_by_pr[:hub_cutoff_idx]]

        opportunities: List[Dict[str, Any]] = []
        for orphan in metrics["orphan_pages"]:
            for hub in hubs:
                if hub != orphan and not self.graph.has_edge(hub, orphan):
                    opportunities.append({
                        "source_hub": hub,
                        "target_orphan": orphan,
                        "source_pr": pr.get(hub, 0.0),
                        "recommendation": f"Add an internal link from authoritative hub '{hub}' to orphan page '{orphan}'."
                    })
                    break  # One suggestion per orphan is enough

        return opportunities
