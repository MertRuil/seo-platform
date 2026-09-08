from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode, urljoin
from typing import Optional, Set

TRACKING_QUERY_PARAMS: Set[str] = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "mc_eid",
    "_ga",
    "_gl",
    "yclid",
    "dclid",
    "msclkid",
}

DISALLOWED_SCHEMES: Set[str] = {
    "mailto",
    "tel",
    "javascript",
    "data",
    "ftp",
    "file",
}

class UrlNormalizer:
    @staticmethod
    def is_crawlable_scheme(url: str) -> bool:
        """Returns False if URL uses non-crawlable schemes like mailto, tel, javascript."""
        scheme = url.split(":", 1)[0].lower() if ":" in url else ""
        return scheme not in DISALLOWED_SCHEMES

    @staticmethod
    def resolve_relative_url(base_url: str, link: str) -> Optional[str]:
        """Resolves relative link against a base URL, returning clean string or None."""
        if not link or link.strip().startswith("#"):
            return None
        clean_link = link.strip()
        if not UrlNormalizer.is_crawlable_scheme(clean_link):
            return None
        try:
            return urljoin(base_url, clean_link)
        except Exception:
            return None

    @staticmethod
    def normalize(url: str) -> str:
        """
        Applies standard deterministic URL normalization:
        1. Scheme & host to lowercase.
        2. Remove default ports (:80, :443).
        3. Remove fragments (#section).
        4. Remove analytics/marketing tracking parameters (utm_*, gclid, fbclid).
        5. Alphabetically sort remaining query parameters.
        6. Clean duplicate slashes in path (preserving protocol).
        """
        parsed = urlparse(url.strip())
        scheme = parsed.scheme.lower()
        if not scheme:
            parsed = urlparse(f"https://{url.strip()}")
            scheme = "https"
        if scheme not in ("http", "https") or not parsed.hostname:
            raise ValueError("Only absolute HTTP/HTTPS URLs with a hostname are supported")
        if parsed.username or parsed.password:
            raise ValueError("URL credentials are not permitted")

        host = parsed.hostname.lower().rstrip(".")
        host_display = f"[{host}]" if ":" in host else host
        port = parsed.port
        netloc = host_display if port is None or (scheme, port) in (("http", 80), ("https", 443)) else f"{host_display}:{port}"

        # Normalize path: remove duplicate slashes except at root
        path = parsed.path
        if not path:
            path = "/"
        else:
            # Replace multiple slashes with single slash
            while "//" in path:
                path = path.replace("//", "/")

        # Parse and sanitize query parameters
        query_items = parse_qsl(parsed.query, keep_blank_values=True)
        filtered_query = [
            (k, v) for (k, v) in query_items
            if k.lower() not in TRACKING_QUERY_PARAMS
        ]
        # Sort query keys alphabetically
        filtered_query.sort(key=lambda item: item[0])
        clean_query = urlencode(filtered_query)

        # Reconstruct URL without fragment
        normalized = urlunparse((scheme, netloc, path, "", clean_query, ""))
        return normalized
