import xml.etree.ElementTree as ET
import gzip
from typing import List, Dict, Any, Optional, Union
from urllib.parse import urljoin

class SitemapUrl:
    def __init__(self, loc: str, lastmod: Optional[str] = None, changefreq: Optional[str] = None, priority: Optional[float] = None):
        self.loc = loc
        self.lastmod = lastmod
        self.changefreq = changefreq
        self.priority = priority

class SitemapParseResult:
    def __init__(self):
        self.is_valid: bool = True
        self.is_index: bool = False
        self.urls: List[SitemapUrl] = []
        self.sitemap_indices: List[str] = []
        self.error_message: Optional[str] = None

class SitemapParser:
    MAX_URLS = 50000
    MAX_CONTENT_SIZE = 10 * 1024 * 1024  # 10 MB

    @staticmethod
    def parse_xml(content: Union[str, bytes], base_url: Optional[str] = None) -> SitemapParseResult:
        result = SitemapParseResult()

        if content is None:
            result.is_valid = False
            result.error_message = "Empty sitemap content"
            return result

        if len(content) > SitemapParser.MAX_CONTENT_SIZE:
            result.is_valid = False
            result.error_message = "Security policy violation: Sitemap XML size exceeds maximum limit of 10MB"
            return result

        # Decompress gzip if input is bytes or contains gzip magic header
        if isinstance(content, bytes):

            if content.startswith(b"\x1f\x8b"):
                try:
                    content = gzip.decompress(content)
                except Exception as e:
                    result.is_valid = False
                    result.error_message = f"Gzip decompression error: {str(e)}"
                    return result

            try:
                clean_content = content.decode("utf-8")
            except UnicodeDecodeError:
                clean_content = content.decode("iso-8859-1", errors="replace")
        else:
            clean_content = content

        # Check for raw string containing gzip stream
        if clean_content.startswith("\x1f\x8b"):
            try:
                decompressed = gzip.decompress(clean_content.encode("latin1"))
                clean_content = decompressed.decode("utf-8", errors="replace")
            except Exception:
                pass

        # Strip UTF-8 BOM if present
        if clean_content.startswith("\ufeff"):
            clean_content = clean_content[1:]

        clean_content = clean_content.strip()

        if len(clean_content) > SitemapParser.MAX_CONTENT_SIZE:
            result.is_valid = False
            result.error_message = "Security policy violation: Sitemap XML size exceeds maximum limit of 10MB"
            return result

        if not clean_content:
            result.is_valid = False
            result.error_message = "Empty sitemap content"
            return result

        # Reject XML containing DOCTYPE or ENTITY definitions across entire document (XXE protection)
        upper = clean_content.upper()
        if "<!DOCTYPE" in upper or "<!ENTITY" in upper:
            result.is_valid = False
            result.error_message = "Security policy violation: XML with DTD or ENTITY declarations is not permitted"
            return result

        # Attempt XML parsing
        try:
            root = ET.fromstring(clean_content)
        except ET.ParseError as e:
            # Check if it's a plain text sitemap (list of URLs, one per line)
            lines = [l.strip() for l in clean_content.splitlines() if l.strip() and not l.strip().startswith("#")]
            valid_urls = [l for l in lines if l.startswith("http://") or l.startswith("https://")]
            if lines and len(valid_urls) == len(lines):
                result.is_valid = True
                result.is_index = False
                for u in lines[:SitemapParser.MAX_URLS]:
                    full_u = urljoin(base_url, u) if base_url else u
                    result.urls.append(SitemapUrl(full_u))
                return result

            result.is_valid = False
            result.error_message = f"XML parse error: {str(e)}"
            return result

        # Strip XML namespace if present
        tag = root.tag.split("}")[-1].lower() if "}" in root.tag else root.tag.lower()

        if tag == "sitemapindex":
            result.is_index = True
            for child in root:
                child_tag = child.tag.split("}")[-1].lower() if "}" in child.tag else child.tag.lower()
                if child_tag == "sitemap":
                    for prop in child:
                        prop_tag = prop.tag.split("}")[-1].lower() if "}" in prop.tag else prop.tag.lower()
                        if prop_tag == "loc" and prop.text:
                            loc = prop.text.strip()
                            if loc:
                                full_loc = urljoin(base_url, loc) if base_url else loc
                                result.sitemap_indices.append(full_loc)

        elif tag == "urlset":
            result.is_index = False
            count = 0
            for child in root:
                if count >= SitemapParser.MAX_URLS:
                    break
                child_tag = child.tag.split("}")[-1].lower() if "}" in child.tag else child.tag.lower()
                if child_tag == "url":
                    loc, lastmod, changefreq, priority = None, None, None, None
                    for prop in child:
                        prop_tag = prop.tag.split("}")[-1].lower() if "}" in prop.tag else prop.tag.lower()
                        text = prop.text.strip() if prop.text else None
                        if prop_tag == "loc":
                            loc = text
                        elif prop_tag == "lastmod":
                            lastmod = text
                        elif prop_tag == "changefreq":
                            changefreq = text
                        elif prop_tag == "priority":
                            try:
                                priority = float(text) if text else None
                            except ValueError:
                                pass

                    if loc:
                        full_loc = urljoin(base_url, loc) if base_url else loc
                        result.urls.append(SitemapUrl(full_loc, lastmod, changefreq, priority))
                        count += 1

        elif tag in ("rss", "feed"):
            # RSS 2.0 or Atom 1.0 feed used as sitemap
            result.is_index = False
            count = 0
            for elem in root.iter():
                if count >= SitemapParser.MAX_URLS:
                    break
                elem_tag = elem.tag.split("}")[-1].lower() if "}" in elem.tag else elem.tag.lower()
                if elem_tag in ("item", "entry"):
                    loc = None
                    for prop in elem:
                        ptag = prop.tag.split("}")[-1].lower() if "}" in prop.tag else prop.tag.lower()
                        if ptag == "link":
                            loc = prop.attrib.get("href") or (prop.text.strip() if prop.text else None)
                            if loc:
                                break
                    if loc:
                        full_loc = urljoin(base_url, loc) if base_url else loc
                        result.urls.append(SitemapUrl(full_loc))
                        count += 1
        else:
            result.is_valid = False
            result.error_message = f"Unrecognized root element: <{tag}>"

        return result
