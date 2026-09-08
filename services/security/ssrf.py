import ipaddress
import socket
from urllib.parse import urlparse
from typing import List, Tuple

class SSRFSecurityException(Exception):
    """Raised when a URL attempts to access private, loopback, or cloud metadata networks."""
    pass

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
    # IPv6 Loopback
    ipaddress.ip_network("::1/128"),
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
        ip = ipaddress.ip_address(ip_str)
        for network in BLOCKED_NETWORKS:
            if ip in network:
                return True
        return False
    except ValueError:
        return True

def resolve_domain_ips(hostname: str) -> List[str]:
    """Resolves all IPv4 and IPv6 addresses for a given hostname."""
    try:
        addr_info = socket.getaddrinfo(hostname, None)
        ips = list({info[4][0] for info in addr_info})
        return ips
    except socket.gaierror as e:
        raise SSRFSecurityException(f"DNS resolution failed for hostname '{hostname}': {str(e)}")

def validate_safe_url(url: str) -> Tuple[str, str, List[str]]:
    """
    Validates that a URL is strictly HTTP/HTTPS and does not resolve to any blocked IP.
    Returns (scheme, hostname, resolved_ips).
    Raises SSRFSecurityException if unsafe.
    """
    parsed = urlparse(url)
    if parsed.scheme.lower() not in ("http", "https"):
        raise SSRFSecurityException(f"Invalid scheme '{parsed.scheme}': only HTTP and HTTPS are permitted")

    hostname = parsed.hostname
    if not hostname:
        raise SSRFSecurityException("URL must contain a valid hostname")

    hostname_lower = hostname.lower().strip(".")
    if hostname_lower in BLOCKED_HOSTNAMES:
        raise SSRFSecurityException(f"Access to blocked hostname '{hostname}' is denied")

    # If hostname is an IP literal
    try:
        ipaddress.ip_address(hostname_lower)
        if is_ip_blocked(hostname_lower):
            raise SSRFSecurityException(f"Direct IP access to private/metadata IP '{hostname_lower}' is blocked")
        return parsed.scheme.lower(), hostname_lower, [hostname_lower]
    except ValueError:
        pass

    # Resolve hostname via DNS
    resolved_ips = resolve_domain_ips(hostname_lower)
    if not resolved_ips:
        raise SSRFSecurityException(f"No IP addresses resolved for hostname '{hostname_lower}'")

    for ip in resolved_ips:
        if is_ip_blocked(ip):
            raise SSRFSecurityException(
                f"SSRF violation: Hostname '{hostname_lower}' resolved to blocked private/metadata IP '{ip}'"
            )

    return parsed.scheme.lower(), hostname_lower, resolved_ips
