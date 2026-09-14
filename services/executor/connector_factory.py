import json
import logging
from typing import Optional
from packages.shared.models import SiteConnector
from services.executor.base import SiteConnector as BaseSiteConnector
from services.executor.connectors.webhook import GenericWebhookConnector
from services.executor.connectors.wordpress import WordPressConnector
from services.executor.connectors.git import GitBasedConnector
from services.executor.connectors.cloudflare import CloudflareWorkerConnector
from services.security.crypto import decrypt_secret

logger = logging.getLogger("executor.connector_factory")

def build_connector_from_record(record: SiteConnector) -> BaseSiteConnector:
    """Builds and initializes the appropriate connector instance from an encrypted DB record."""
    try:
        credentials = json.loads(decrypt_secret(record.encrypted_credentials))
    except Exception as exc:
        logger.error(f"Connector {record.id} credentials could not be decrypted: {exc}")
        raise ValueError("Connector credentials could not be decrypted") from exc

    c_type = (record.connector_type or "").upper()
    if c_type in ("GENERIC_WEBHOOK", "WEBHOOK"):
        secret = credentials.get("secret_key") or credentials.get("secret", "")
        return GenericWebhookConnector(record.base_url or "", secret)
    if c_type in ("WORDPRESS_REST", "WORDPRESS"):
        return WordPressConnector(
            record.base_url or "",
            credentials.get("username", ""),
            credentials.get("app_password", "")
        )
    if c_type in ("GIT_PR", "GIT", "GITHUB"):
        return GitBasedConnector(
            credentials.get("repo_full_name", ""),
            credentials.get("access_token", ""),
            credentials.get("default_branch", "main")
        )
    if c_type in ("CLOUDFLARE_WORKER", "CLOUDFLARE"):
        return CloudflareWorkerConnector(
            zone_id=credentials.get("zone_id", ""),
            api_token=credentials.get("api_token", ""),
            account_id=credentials.get("account_id"),
            kv_namespace_id=credentials.get("kv_namespace_id"),
            base_url=record.base_url or ""
        )
    raise ValueError(f"Unsupported connector type: {record.connector_type}")
