import json
from typing import Dict, Any, List, Optional, Tuple

class SchemaGenerator:
    """
    Automated JSON-LD Schema Generator & Rich Snippet Validator.
    Generates strictly formatted, Google Search Central compliant structured data
    ready for direct injection via SafeSiteExecutor or CDN edge workers.
    """

    @staticmethod
    def generate_faq_schema(qa_pairs: List[Dict[str, str]]) -> Dict[str, Any]:
        """Generates Google-compliant FAQPage JSON-LD."""
        main_entity = []
        for pair in qa_pairs:
            q = pair.get("question", "").strip()
            a = pair.get("answer", "").strip()
            if q and a:
                main_entity.append({
                    "@type": "Question",
                    "name": q,
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": a
                    }
                })

        return {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": main_entity
        }

    @staticmethod
    def generate_article_schema(
        headline: str,
        author_name: str,
        publisher_name: str,
        date_published: str,
        date_modified: Optional[str] = None,
        image_url: Optional[str] = None,
        publisher_logo_url: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generates Google-compliant Article JSON-LD."""
        schema: Dict[str, Any] = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": headline[:110],
            "author": {
                "@type": "Person",
                "name": author_name
            },
            "publisher": {
                "@type": "Organization",
                "name": publisher_name
            },
            "datePublished": date_published,
            "dateModified": date_modified or date_published
        }

        if image_url:
            schema["image"] = image_url
        if publisher_logo_url:
            schema["publisher"]["logo"] = {
                "@type": "ImageObject",
                "url": publisher_logo_url
            }
        if description:
            schema["description"] = description

        return schema

    @staticmethod
    def generate_breadcrumb_schema(items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generates BreadcrumbList JSON-LD."""
        elements = []
        for idx, item in enumerate(items):
            elements.append({
                "@type": "ListItem",
                "position": idx + 1,
                "name": item.get("name", f"Step {idx+1}"),
                "item": item.get("url", "")
            })

        return {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": elements
        }

    @staticmethod
    def generate_local_business_schema(
        name: str,
        telephone: str,
        street_address: str,
        address_locality: Optional[str] = None,
        postal_code: str = "",
        address_country: Optional[str] = None,
        url: Optional[str] = None,
        image_url: Optional[str] = None,
        price_range: str = "$$",
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        locality: Optional[str] = None,
        country: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generates LocalBusiness JSON-LD."""
        loc = address_locality or locality or ""
        ctry = address_country or country or ""
        schema: Dict[str, Any] = {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": name,
            "telephone": telephone,
            "priceRange": price_range,
            "address": {
                "@type": "PostalAddress",
                "streetAddress": street_address,
                "addressLocality": loc,
                "postalCode": postal_code,
                "addressCountry": ctry
            }
        }
        if url:
            schema["url"] = url
        if image_url:
            schema["image"] = image_url
        if latitude is not None and longitude is not None:
            schema["geo"] = {
                "@type": "GeoCoordinates",
                "latitude": latitude,
                "longitude": longitude
            }
        return schema

    @staticmethod
    def generate_product_schema(
        name: str,
        price: float,
        price_currency: str = "USD",
        sku: Optional[str] = None,
        description: Optional[str] = None,
        availability: str = "https://schema.org/InStock",
        rating_value: Optional[float] = None,
        review_count: Optional[int] = None,
        currency: Optional[str] = None,
        url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generates Product JSON-LD with Offer and AggregateRating."""
        curr = currency or price_currency
        schema: Dict[str, Any] = {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": name,
            "offers": {
                "@type": "Offer",
                "price": price,
                "priceCurrency": curr,
                "availability": availability
            }
        }
        if url:
            schema["url"] = url
        if sku:
            schema["sku"] = sku
        if description:
            schema["description"] = description
        if rating_value is not None and review_count:
            schema["aggregateRating"] = {
                "@type": "AggregateRating",
                "ratingValue": str(rating_value),
                "reviewCount": str(review_count)
            }
        return schema

    @classmethod
    def validate_schema(cls, schema: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validates JSON-LD dictionary against Google Search Central requirements.
        Returns (is_valid: bool, errors: List[str]).
        """
        errors = []
        if schema.get("@context") != "https://schema.org":
            errors.append("Invalid or missing @context: must be 'https://schema.org'")

        stype = schema.get("@type")
        if not stype:
            errors.append("Missing @type declaration")
            return False, errors

        if stype == "FAQPage":
            entities = schema.get("mainEntity", [])
            if not entities or not isinstance(entities, list):
                errors.append("FAQPage must contain a non-empty 'mainEntity' list of questions")
            else:
                for idx, e in enumerate(entities):
                    if e.get("@type") != "Question" or not e.get("name"):
                        errors.append(f"FAQ item #{idx+1} missing Question name")
                    ans = e.get("acceptedAnswer", {})
                    if ans.get("@type") != "Answer" or not ans.get("text"):
                        errors.append(f"FAQ item #{idx+1} missing acceptedAnswer text")

        elif stype == "Article":
            if not schema.get("headline"):
                errors.append("Article missing required 'headline'")
            if not schema.get("author"):
                errors.append("Article missing required 'author'")
            if not schema.get("publisher"):
                errors.append("Article missing required 'publisher'")
            if not schema.get("datePublished"):
                errors.append("Article missing required 'datePublished'")

        elif stype == "BreadcrumbList":
            elements = schema.get("itemListElement", [])
            if not elements:
                errors.append("BreadcrumbList requires at least one 'itemListElement'")

        elif stype == "LocalBusiness":
            if not schema.get("name"):
                errors.append("LocalBusiness missing required 'name'")
            if not schema.get("address"):
                errors.append("LocalBusiness missing required 'address'")

        elif stype == "Product":
            if not schema.get("name"):
                errors.append("Product missing required 'name'")
            if not schema.get("offers"):
                errors.append("Product missing required 'offers'")

        is_valid = len(errors) == 0
        return is_valid, errors

    @classmethod
    def to_script_tag(cls, schema: Dict[str, Any], pretty: bool = True) -> str:
        """Serializes dictionary to an injection-ready HTML script tag."""
        indent = 2 if pretty else None
        json_str = json.dumps(schema, ensure_ascii=False, indent=indent)
        return f'<script type="application/ld+json">\n{json_str}\n</script>'

    @classmethod
    def validate_google_guidelines(cls, schema: Dict[str, Any]) -> Dict[str, Any]:
        is_valid, errors = cls.validate_schema(schema)
        return {"valid": is_valid, "errors": errors}

    @classmethod
    def generate_script_tag(cls, schema: Dict[str, Any], pretty: bool = True) -> str:
        return cls.to_script_tag(schema, pretty=pretty)

