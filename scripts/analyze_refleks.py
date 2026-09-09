import sys
import os
import asyncio
import json

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Reconfigure stdout/stderr for Windows UTF-8 compatibility
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from selectolax.parser import HTMLParser
from services.crawler.safe_client import SafeHttpClient

async def main():
    client = SafeHttpClient()
    resp = await client.fetch("https://refleksterapievi.com/")
    parser = HTMLParser(resp.text)
    
    # 1. JSON-LD Schemas
    scripts = parser.css('script[type="application/ld+json"]')
    print(f"JSON-LD Schema script count: {len(scripts)}")
    for s in scripts:
        print("Schema JSON Content:", s.text())

    # 2. Images & Alt Text
    imgs = parser.css('img')
    print(f"Total images: {len(imgs)}")
    missing_alt = [img.attributes.get('src') for img in imgs if not img.attributes.get('alt')]
    print(f"Images missing alt text: {len(missing_alt)}")
    for src in missing_alt[:5]:
        print(f"  Missing alt image: {src}")

    # 3. All Links
    links = parser.css('a')
    print(f"Total anchor links: {len(links)}")
    hrefs = set(a.attributes.get('href') for a in links if a.attributes.get('href'))
    print("Links on site:")
    for h in sorted(hrefs):
        print(f"  {h}")

    # 4. OpenGraph & Meta
    og_title = parser.css_first('meta[property="og:title"]')
    og_desc = parser.css_first('meta[property="og:description"]')
    og_img = parser.css_first('meta[property="og:image"]')
    print(f"OG Title: {og_title.attributes.get('content') if og_title else 'YOK (Eksik)'}")
    print(f"OG Description: {og_desc.attributes.get('content') if og_desc else 'YOK (Eksik)'}")
    print(f"OG Image: {og_img.attributes.get('content') if og_img else 'YOK (Eksik)'}")

    # 5. Technology / CMS signatures
    text_lower = resp.text.lower()
    if "wp-content" in text_lower:
        print("CMS: WordPress")
    elif "wix" in text_lower:
        print("CMS: Wix")
    elif "squarespace" in text_lower:
        print("CMS: Squarespace")
    elif "shopify" in text_lower:
        print("CMS: Shopify")
    else:
        print("CMS: Özel Kodlama / Statik HTML / JAMstack")

    # 6. Page text sample
    body = parser.css_first("body")
    text = body.text(separator=" ", strip=True) if body else ""
    print(f"Body text length: {len(text)} characters")
    print(f"Word count approx: {len(text.split())} words")

if __name__ == "__main__":
    asyncio.run(main())
