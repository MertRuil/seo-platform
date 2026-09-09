import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
from datetime import datetime

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

    @staticmethod
    def parse_xml(content: str) -> SitemapParseResult:
        result = SitemapParseResult()
        clean_content = content.strip()
        if not clean_content:
            result.is_valid = False
            result.error_message = "Empty sitemap content"
        # Reject XML containing DOCTYPE or ENTITY definitions to eliminate XML Entity Expansion (Billion Laughs / XXE DoS)
        upper = clean_content[:2048].upper()
        if "<!DOCTYPE" in upper or "<!ENTITY" in upper:
            result.is_valid = False
            result.error_message = "Security policy violation: XML with DTD or ENTITY declarations is not permitted"
            return result

        try:
            root = ET.fromstring(clean_content)
        except ET.ParseError as e:
            result.is_valid = False
            result.error_message = f"XML parse error: {str(e)}"
            return result

        # Strip XML namespace if present
        tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag

        if tag == "sitemapindex":
            result.is_index = True
            for child in root:
                child_tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                if child_tag == "sitemap":
                    for prop in child:
                        prop_tag = prop.tag.split("}")[-1] if "}" in prop.tag else prop.tag
                        if prop_tag == "loc" and prop.text:
                            result.sitemap_indices.append(prop.text.strip())

        elif tag == "urlset":
            result.is_index = False
            count = 0
            for child in root:
                if count >= SitemapParser.MAX_URLS:
                    break
                child_tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                if child_tag == "url":
                    loc, lastmod, changefreq, priority = None, None, None, None
                    for prop in child:
                        prop_tag = prop.tag.split("}")[-1] if "}" in prop.tag else prop.tag
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
                        result.urls.append(SitemapUrl(loc, lastmod, changefreq, priority))
                        count += 1
        else:
            result.is_valid = False
            result.error_message = f"Unrecognized root element: <{tag}>"

        return result
