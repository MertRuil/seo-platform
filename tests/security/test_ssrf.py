import pytest
from services.security.ssrf import is_ip_blocked, validate_safe_url, SSRFSecurityException

def test_blocked_private_and_metadata_ips():
    assert is_ip_blocked("127.0.0.1") is True
    assert is_ip_blocked("127.0.0.2") is True
    assert is_ip_blocked("10.0.0.1") is True
    assert is_ip_blocked("172.16.0.1") is True
    assert is_ip_blocked("192.168.1.1") is True
    assert is_ip_blocked("169.254.169.254") is True
    assert is_ip_blocked("100.64.0.1") is True
    assert is_ip_blocked("::1") is True
    assert is_ip_blocked("fe80::1") is True

def test_public_ips_allowed():
    assert is_ip_blocked("8.8.8.8") is False
    assert is_ip_blocked("1.1.1.1") is False
    assert is_ip_blocked("142.250.190.46") is False  # Google IP

def test_validate_safe_url_blocks_localhost():
    with pytest.raises(SSRFSecurityException) as exc:
        validate_safe_url("http://localhost:8000/admin")
    assert "blocked hostname" in str(exc.value)

def test_validate_safe_url_blocks_loopback_ip():
    with pytest.raises(SSRFSecurityException) as exc:
        validate_safe_url("http://127.0.0.1:5432")
    assert "Direct IP access" in str(exc.value)

def test_validate_safe_url_blocks_metadata_ip():
    with pytest.raises(SSRFSecurityException) as exc:
        validate_safe_url("http://169.254.169.254/latest/meta-data/")
    assert "Direct IP access" in str(exc.value)

def test_validate_safe_url_blocks_invalid_schemes():
    with pytest.raises(SSRFSecurityException) as exc:
        validate_safe_url("file:///etc/passwd")
    assert "only HTTP and HTTPS" in str(exc.value)

    with pytest.raises(SSRFSecurityException) as exc:
        validate_safe_url("gopher://127.0.0.1:6379")
    assert "only HTTP and HTTPS" in str(exc.value)
