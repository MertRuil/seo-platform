import re
from typing import List, Optional, Dict
from urllib.parse import urlparse

class RobotsRule:
    def __init__(self, pattern: str, is_allow: bool):
        self.raw_pattern = pattern
        self.is_allow = is_allow
        # Convert robots wildcard (* and $) to regex
        # Escape regex special characters except * and $
        escaped = re.escape(pattern).replace(r"\*", ".*")
        if escaped.endswith(r"\$"):
            escaped = escaped[:-2] + "$"
        else:
            escaped = "^" + escaped
        self.regex = re.compile(escaped)

    def matches(self, path: str) -> bool:
        return bool(self.regex.search(path))

class RobotsParser:
    def __init__(self, content: str = ""):
        self.raw_content = content
        self.sitemaps: List[str] = []
        self.crawl_delay: Optional[float] = None
        # Groupings by normalized agent (lowercase)
        self.agent_rules: Dict[str, List[RobotsRule]] = {}
        self._parse(content)

    def _parse(self, content: str):
        current_agents: List[str] = []

        for line in content.splitlines():
            clean_line = line.strip()
            # Strip comments
            if "#" in clean_line:
                clean_line = clean_line.split("#", 1)[0].strip()
            if not clean_line:
                continue

            if ":" not in clean_line:
                continue

            key, value = clean_line.split(":", 1)
            key = key.strip().lower()
            value = value.strip()

            if key == "user-agent":
                agent = value.lower()
                current_agents.append(agent)
                if agent not in self.agent_rules:
                    self.agent_rules[agent] = []

            elif key == "sitemap":
                if value and value not in self.sitemaps:
                    self.sitemaps.append(value)

            elif key == "crawl-delay":
                try:
                    self.crawl_delay = float(value)
                except ValueError:
                    pass

            elif key in ("disallow", "allow"):
                is_allow = (key == "allow")
                pattern = value if value else "/" if not is_allow else ""
                rule = RobotsRule(pattern, is_allow=is_allow)
                for agent in current_agents:
                    self.agent_rules[agent].append(rule)

    def is_allowed(self, url: str, user_agent: str = "Googlebot") -> bool:
        """
        Determines if a URL is allowed for a user agent.
        Matches agent-specific rules first, falls back to '*'.
        Longest matching pattern wins according to RFC 9309.
        """
        parsed = urlparse(url)
        path = parsed.path
        if parsed.query:
            path += f"?{parsed.query}"
        if not path:
            path = "/"

        agent_key = user_agent.lower()
        rules = self.agent_rules.get(agent_key)
        if not rules:
            # Fallback to wildcard '*'
            rules = self.agent_rules.get("*", [])

        if not rules:
            return True

        matching_rules = [r for r in rules if r.matches(path)]
        if not matching_rules:
            return True

        # Rule with longest pattern takes precedence
        matching_rules.sort(key=lambda r: len(r.raw_pattern), reverse=True)
        return matching_rules[0].is_allow
