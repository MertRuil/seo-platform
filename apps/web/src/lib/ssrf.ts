import dns from "dns/promises";
import net from "net";

export class SSRFSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SSRFSecurityError";
  }
}

// Yasaklı host adları ve bulut metadata uç noktaları
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "instance-data",
  "169.254.169.254",
  "metadata",
]);

/**
 * Verilen IP adresinin özel ağ, loopback veya bulut metadata aralığında olup olmadığını kontrol eder.
 */
export function isBlockedIp(ip: string): boolean {
  if (!net.isIP(ip)) {
    return true;
  }

  // IPv4 denetimleri
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }
    const [b0, b1] = parts;

    // Loopback: 127.0.0.0/8
    if (b0 === 127) return true;
    // Current network / broadcast: 0.0.0.0/8
    if (b0 === 0) return true;
    // Broadcast: 255.255.255.255
    if (parts[0] === 255 && parts[1] === 255 && parts[2] === 255 && parts[3] === 255) return true;
    // RFC 1918 Private: 10.0.0.0/8
    if (b0 === 10) return true;
    // RFC 1918 Private: 172.16.0.0/12
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
    // RFC 1918 Private: 192.168.0.0/16
    if (b0 === 192 && b1 === 168) return true;
    // Link-Local & AWS/GCP/Azure Cloud Metadata: 169.254.0.0/16
    if (b0 === 169 && b1 === 254) return true;
    // Carrier-Grade NAT: 100.64.0.0/10
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

    return false;
  }

  // IPv6 denetimleri
  const lower = ip.toLowerCase();
  // Loopback ::1
  if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
  // Unspecified ::
  if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;
  // IPv6 Unique Local Unicast (RFC 4193: fc00::/7)
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  // IPv6 Link-Local Unicast (RFC 4291: fe80::/10)
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;

  return false;
}

/**
 * Hedef web adresini sıkı SSRF güvenlik kurallarına göre doğrular.
 * Yerel ağlara, loopback adreslerine ve bulut metadata uç noktalarına erişimi engeller.
 */
export async function validateSafeAuditUrl(rawUrl: string): Promise<URL> {
  let urlObj: URL;
  try {
    urlObj = new URL(rawUrl);
  } catch {
    throw new SSRFSecurityError("Geçersiz URL formatı.");
  }

  // Protokol denetimi
  if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
    throw new SSRFSecurityError(
      `Yalnızca HTTP ve HTTPS protokolleri desteklenir ('${urlObj.protocol}' engellendi).`
    );
  }

  // Kimlik bilgisi sızması önleme (user:pass@host)
  if (urlObj.username || urlObj.password) {
    throw new SSRFSecurityError("URL içinde kullanıcı adı veya şifre bulunamaz.");
  }

  const hostname = urlObj.hostname.toLowerCase().replace(/^\.+|\.+$/g, "");
  if (!hostname) {
    throw new SSRFSecurityError("URL geçerli bir ana makine (hostname) adı içermelidir.");
  }

  // Yasaklı host adları
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new SSRFSecurityError(
      `Güvenlik uyarısı (SSRF): '${hostname}' yerel/dahili ana makine adreslerine erişim engellendi.`
    );
  }

  // Standart web portları dışındaki port taramalarını engelle
  if (urlObj.port && !["80", "443", "8080", "8443"].includes(urlObj.port)) {
    throw new SSRFSecurityError(
      `Güvenlik uyarısı: Port taraması engellendi ('${urlObj.port}' portu izinli değil).`
    );
  }

  // Hostname doğrudan IP ise
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new SSRFSecurityError(
        `Güvenlik kuralı (SSRF): '${hostname}' özel/yerel veya bulut metadata IP adresidir. Tarama engellendi.`
      );
    }
    return urlObj;
  }

  // DNS Çözümleme ve DNS Rebinding Koruması
  try {
    const lookupResults = await dns.lookup(hostname, { all: true });
    if (!lookupResults || lookupResults.length === 0) {
      throw new SSRFSecurityError(`'${hostname}' alan adı için DNS IP adresi bulunamadı.`);
    }

    for (const record of lookupResults) {
      if (isBlockedIp(record.address)) {
        throw new SSRFSecurityError(
          `Güvenlik kuralı (SSRF): '${hostname}' alan adı korumalı/yerel IP adresine (${record.address}) çözümlendi. Erişim engellendi.`
        );
      }
    }
  } catch (err: any) {
    if (err instanceof SSRFSecurityError) throw err;
    throw new SSRFSecurityError(`DNS çözümleme başarısız: ${err.message}`);
  }

  return urlObj;
}
