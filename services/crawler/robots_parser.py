import re
from typing import List, Optional, Dict
from urllib.parse import urlparse, unquote

class RobotsRule:
    def __init__(self, pattern: str, is_allow: bool):
        self.raw_pattern = pattern
        self.is_allow = is_allow
        # Convert robots wildcard (* and $) to regex
        # Pattern in RFC 9309 is always anchored to the beginning of the path
        escaped = re.escape(pattern).replace(r"\*", ".*")
        if escaped.endswith(r"\$"):
            regex_str = "^" + escaped[:-2] + "$"
        else:
            regex_str = "^" + escaped
        self.regex = re.compile(regex_str)

    def matches(self, path: str) -> bool:
        # Match against raw path and unquoted path
        if bool(self.regex.search(path)):
            return True
        unquoted = unquote(path)
        if unquoted != path:
            return bool(self.regex.search(unquoted))
        return False

class RobotsParser:
    def __init__(self, content: str = ""):
        self.raw_content = content
        self.sitemaps: List[str] = []
        self.crawl_delays: Dict[str, float] = {}
        # Groupings by normalized agent (lowercase)
        self.agent_rules: Dict[str, List[RobotsRule]] = {}
        self._parse(content)

    @property
    def crawl_delay(self) -> Optional[float]:
        # Backward compatibility property, prefers '*' or first available
        return self.crawl_delays.get("*") or next(iter(self.crawl_delays.values()), None)

    def _parse(self, content: str):
        current_agents: List[str] = []
        in_rule_block = False

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
                if in_rule_block:
                    # Previous record rule block has ended; start a new record group
                    current_agents = []
                    in_rule_block = False

                if agent:
                    current_agents.append(agent)
                    if agent not in self.agent_rules:
                        self.agent_rules[agent] = []

            elif key == "sitemap":
                if value and value not in self.sitemaps:
                    self.sitemaps.append(value)

            elif key == "crawl-delay":
                try:
                    delay_val = float(value)
                    for agent in current_agents:
                        self.crawl_delays[agent] = delay_val
                    in_rule_block = True
                except ValueError:
                    pass

            elif key in ("disallow", "allow"):
                is_allow = (key == "allow")
                in_rule_block = True

                # RFC 9309: An empty Disallow or Allow line has no effect (allows all)
                if not value:
                    continue

                rule = RobotsRule(value, is_allow=is_allow)
                for agent in current_agents:
                    self.agent_rules[agent].append(rule)

    def is_allowed(self, url: str, user_agent: str = "Googlebot") -> bool:
        """
        Determines if a URL is allowed for a user agent according to RFC 9309.
        Matches agent-specific rules first, falls back to '*'.
        Longest matching pattern wins according to RFC 9309.
        If allow and disallow rules have equal length, allow takes precedence.
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

        # Sort rules by:
        # 1. Length of raw pattern descending (longest match wins)
        # 2. Allow before Disallow (if lengths are equal, RFC 9309 mandates Allow wins)
        matching_rules.sort(key=lambda r: (len(r.raw_pattern), 1 if r.is_allow else 0), reverse=True)
        return matching_rules[0].is_allow
