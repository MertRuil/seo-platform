import asyncio
import ipaddress
import socket
from urllib.parse import urlparse
from typing import List, Tuple

class SSRFSecurityException(Exception):
    """Raised when a URL attempts to access private, loopback, or cloud metadata networks."""
    pass

# Blacklisted IP subnets (IPv4 and IPv6)
# Blacklisted IP subnets (IPv4 and IPv6)
BLOCKED_NETWORKS = [
    # IPv4 Loopback
    ipaddress.ip_network("127.0.0.0/8"),
    # IPv4 RFC 1918 Private Networks
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    # IPv4 Link-Local & Cloud Metadata (AWS/GCP/Azure)
    ipaddress.ip_network("169.254.0.0/16"),
    # Carrier-grade NAT
    ipaddress.ip_network("100.64.0.0/10"),
    # Current network & Broadcast
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("255.255.255.255/32"),
    # IPv6 Unspecified Address (::)
    ipaddress.ip_network("::/128"),
    # IPv6 Loopback
    ipaddress.ip_network("::1/128"),
    # IPv6 IPv4-mapped (RFC 4291)
    ipaddress.ip_network("::ffff:0:0/96"),
    # IPv6 IPv4-IPv6 Translation (RFC 6052)
    ipaddress.ip_network("64:ff9b::/96"),
    # IPv6 Unique Local Unicast (RFC 4193)
    ipaddress.ip_network("fc00::/7"),
    # IPv6 Link-Local Unicast (RFC 4291)
    ipaddress.ip_network("fe80::/10"),
]

BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "metadata.google.internal",
    "instance-data",
}

def is_ip_blocked(ip_str: str) -> bool:
    """Checks if an IP address belongs to any blocked / private / metadata range."""
    try:
        clean_ip = ip_str.strip("[]")
        ip = ipaddress.ip_address(clean_ip)

        # Unpack and verify IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1, ::ffff:169.254.169.254)
        if isinstance(ip, ipaddress.IPv6Address):
            if ip.is_unspecified:
                return True
            if ip.ipv4_mapped is not None:
                mapped_ipv4 = ip.ipv4_mapped
                if (
                    mapped_ipv4.is_private
                    or mapped_ipv4.is_loopback
                    or mapped_ipv4.is_link_local
                    or mapped_ipv4.is_reserved
                    or mapped_ipv4.is_multicast
                ):
                    return True
                for network in BLOCKED_NETWORKS:
                    if network.version == 4 and mapped_ipv4 in network:
                        return True

            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
            ):
                return True

        if isinstance(ip, ipaddress.IPv4Address):
            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
            ):
                return True

        for network in BLOCKED_NETWORKS:
            if ip.version == network.version and ip in network:
                return True
        return False
    except ValueError:
        return True

def is_ip_literal(host: str) -> bool:
    """Returns True if the string is a valid IPv4 or IPv6 address literal."""
    try:
        clean = host.strip("[]")
        ipaddress.ip_address(clean)
        return True
    except ValueError:
        return False

def resolve_domain_ips(hostname: str) -> List[str]:
    """Synchronously resolves all IPv4 and IPv6 addresses for a given hostname."""
    try:
        clean_hostname = hostname.strip("[]")
        addr_info = socket.getaddrinfo(clean_hostname, None)
        ips = list({info[4][0] for info in addr_info})
        return ips
    except socket.gaierror as e:
        raise SSRFSecurityException(f"DNS resolution failed for hostname '{hostname}': {str(e)}")

async def async_resolve_domain_ips(hostname: str) -> List[str]:
    """Asynchronously resolves all IPv4 and IPv6 addresses for a hostname without blocking the event loop."""
    try:
        clean_hostname = hostname.strip("[]")
        loop = asyncio.get_running_loop()
        addr_info = await loop.getaddrinfo(clean_hostname, None)
        ips = list({info[4][0] for info in addr_info})
        return ips
    except socket.gaierror as e:
        raise SSRFSecurityException(f"DNS resolution failed for hostname '{hostname}': {str(e)}")

ALLOWED_WEB_PORTS = {80, 443, 8080, 8443}

def validate_safe_url(url: str) -> Tuple[str, str, List[str]]:
    """
    Validates that a URL is strictly HTTP/HTTPS and does not resolve to any blocked IP.
    Returns (scheme, hostname, resolved_ips).
    Raises SSRFSecurityException if unsafe.
    """
    parsed = urlparse(url)
    if parsed.scheme.lower() not in ("http", "https"):
        raise SSRFSecurityException(f"Invalid scheme '{parsed.scheme}': only HTTP and HTTPS are permitted")

    if parsed.username or parsed.password:
        raise SSRFSecurityException("URL credentials are not permitted")

    hostname = parsed.hostname
    if not hostname:
        raise SSRFSecurityException("URL must contain a valid hostname")

    clean_hostname = hostname.strip("[]").lower().strip(".")
    if (
        clean_hostname in BLOCKED_HOSTNAMES
        or clean_hostname.endswith(".localhost")
        or clean_hostname.endswith(".local")
        or clean_hostname.endswith(".internal")
    ):
        raise SSRFSecurityException(f"Access to blocked hostname '{hostname}' is denied")

    # If hostname is an IP literal (IPv4 or IPv6)
    try:
        ipaddress.ip_address(clean_hostname)
        if is_ip_blocked(clean_hostname):
            raise SSRFSecurityException(f"Direct IP access to private/metadata IP '{clean_hostname}' is blocked")
        if parsed.port and parsed.port not in ALLOWED_WEB_PORTS:
            raise SSRFSecurityException(f"Port '{parsed.port}' is not permitted for web crawling")
        return parsed.scheme.lower(), clean_hostname, [clean_hostname]
    except ValueError:
        pass

    # Restrict allowed ports for hostnames
    if parsed.port and parsed.port not in ALLOWED_WEB_PORTS:
        raise SSRFSecurityException(f"Port '{parsed.port}' is not permitted for web crawling")

    # Resolve hostname via DNS
    resolved_ips = resolve_domain_ips(clean_hostname)
    if not resolved_ips:
        raise SSRFSecurityException(f"No IP addresses resolved for hostname '{clean_hostname}'")

    for ip in resolved_ips:
        if is_ip_blocked(ip):
            raise SSRFSecurityException(
                f"SSRF violation: Hostname '{clean_hostname}' resolved to blocked private/metadata IP '{ip}'"
            )

    return parsed.scheme.lower(), clean_hostname, resolved_ips

