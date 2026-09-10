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

    if record.connector_type == "GENERIC_WEBHOOK":
        return GenericWebhookConnector(record.base_url or "", credentials.get("secret_key", ""))
    if record.connector_type == "WORDPRESS_REST":
        return WordPressConnector(
            record.base_url or "",
            credentials.get("username", ""),
            credentials.get("app_password", "")
        )
    if record.connector_type == "GIT_PR":
        return GitBasedConnector(
            credentials.get("repo_full_name", ""),
            credentials.get("access_token", ""),
            credentials.get("default_branch", "main")
        )
    if record.connector_type == "CLOUDFLARE_WORKER":
        return CloudflareWorkerConnector(
            zone_id=credentials.get("zone_id", ""),
            api_token=credentials.get("api_token", ""),
            account_id=credentials.get("account_id"),
            kv_namespace_id=credentials.get("kv_namespace_id"),
            base_url=record.base_url or ""
        )
    raise ValueError(f"Unsupported connector type: {record.connector_type}")
