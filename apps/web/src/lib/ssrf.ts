import dns from "dns/promises";
import net from "net";
import http from "http";
import https from "https";

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
  const cleanIp = ip.replace(/^\[|\]$/g, "").trim().toLowerCase();

  // Belirtilmemiş adres (:: veya 0.0.0.0)
  if (cleanIp === "::" || cleanIp === "0:0:0:0:0:0:0:0" || cleanIp === "0.0.0.0") {
    return true;
  }

  // IPv4-mapped IPv6 adresleri (örn. ::ffff:169.254.169.254 veya ::ffff:127.0.0.1)
  const mappedDottedMatch = cleanIp.match(/^(?:::ffff:|0:0:0:0:0:ffff:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mappedDottedMatch) {
    return isBlockedIp(mappedDottedMatch[1]);
  }

  // Hex formatındaki IPv4-mapped IPv6 adresleri (örn. ::ffff:7f00:0001)
  const mappedHexMatch = cleanIp.match(/^(?:::ffff:|0:0:0:0:0:ffff:)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (mappedHexMatch) {
    const h1 = parseInt(mappedHexMatch[1], 16);
    const h2 = parseInt(mappedHexMatch[2], 16);
    const b0 = Math.floor(h1 / 256);
    const b1 = h1 % 256;
    const b2 = Math.floor(h2 / 256);
    const b3 = h2 % 256;
    return isBlockedIp(`${b0}.${b1}.${b2}.${b3}`);
  }

  if (cleanIp.startsWith("::ffff:") || cleanIp.startsWith("64:ff9b::")) {
    return true;
  }

  if (!net.isIP(cleanIp)) {
    return true;
  }

  // IPv4 denetimleri
  if (net.isIPv4(cleanIp)) {
    const parts = cleanIp.split(".").map(Number);
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
  // Loopback ::1
  if (cleanIp === "::1" || cleanIp === "0:0:0:0:0:0:0:1") return true;
  // IPv6 Unique Local Unicast (RFC 4193: fc00::/7)
  if (cleanIp.startsWith("fc") || cleanIp.startsWith("fd")) return true;
  // IPv6 Link-Local Unicast (RFC 4291: fe80::/10)
  if (cleanIp.startsWith("fe8") || cleanIp.startsWith("fe9") || cleanIp.startsWith("fea") || cleanIp.startsWith("feb")) return true;

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
  const cleanHost = hostname.replace(/^\[|\]$/g, "");
  if (!cleanHost) {
    throw new SSRFSecurityError("URL geçerli bir ana makine (hostname) adı içermelidir.");
  }

  // Yasaklı host adları
  if (
    BLOCKED_HOSTNAMES.has(cleanHost) ||
    cleanHost.endsWith(".localhost") ||
    cleanHost.endsWith(".local") ||
    cleanHost.endsWith(".internal")
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

  // Hostname doğrudan IP ise (saf IP veya IPv4-mapped IPv6)
  if (net.isIP(cleanHost) || cleanHost.startsWith("::ffff:") || cleanHost === "::") {
    if (isBlockedIp(cleanHost)) {
      throw new SSRFSecurityError(
        `Güvenlik kuralı (SSRF): '${hostname}' özel/yerel veya bulut metadata IP adresidir. Tarama engellendi.`
      );
    }
    return urlObj;
  }

  // DNS Çözümleme ve DNS Rebinding Koruması
  try {
    const lookupResults = await dns.lookup(cleanHost, { all: true });
    if (!lookupResults || lookupResults.length === 0) {
      throw new SSRFSecurityError(`'${cleanHost}' alan adı için DNS IP adresi bulunamadı.`);
    }

    for (const record of lookupResults) {
      if (isBlockedIp(record.address)) {
        throw new SSRFSecurityError(
          `Güvenlik kuralı (SSRF): '${cleanHost}' alan adı korumalı/yerel IP adresine (${record.address}) çözümlendi. Erişim engellendi.`
        );
      }
    }
  } catch (err: any) {
    if (err instanceof SSRFSecurityError) throw err;
    throw new SSRFSecurityError(`DNS çözümleme başarısız: ${err.message}`);
  }

  return urlObj;
}

export interface SafeFetchResult {
  statusCode: number;
  headers: Record<string, string>;
  text: string;
  finalUrl: string;
}

/**
 * SSRF ve DNS Rebinding korumalı güvenli HTTP istemcisi.
 * Otomatik yönlendirmeleri (redirect) takip etmez; her yönlendirme adımını
 * önceden doğrular ve soket bağlantısını yerel korumalı IP'lere kapatır.
 */
export async function safeAuditFetch(
  targetUrl: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRedirects?: number;
  } = {}
): Promise<SafeFetchResult> {
  const maxHops = options.maxRedirects ?? 5;
  const timeoutMs = options.timeoutMs ?? 10000;
  let currentUrl = targetUrl;
  let hops = 0;

  while (hops <= maxHops) {
    const urlObj = await validateSafeAuditUrl(currentUrl);
    const cleanHost = urlObj.hostname.replace(/^\[|\]$/g, "");

    const res = await new Promise<{
      statusCode: number;
      headers: Record<string, string>;
      body: string;
      location?: string;
    }>((resolve, reject) => {
      const isHttps = urlObj.protocol === "https:";
      const mod = isHttps ? https : http;
      const agent = new mod.Agent({
        lookup: async (
          lookupHost: string,
          lookupOpts: any,
          cb: (err: any, address?: any, family?: any) => void
        ) => {
          try {
            const clean = lookupHost.replace(/^\[|\]$/g, "");
            if (net.isIP(clean)) {
              if (isBlockedIp(clean)) {
                return cb(
                  new SSRFSecurityError(
                    `SSRF engellendi: '${lookupHost}' korumalı/özel IP adresidir.`
                  )
                );
              }
              return cb(null, clean, net.isIP(clean));
            }

            const records = await dns.lookup(clean, { all: true });
            if (!records || records.length === 0) {
              return cb(
                new SSRFSecurityError(
                  `'${lookupHost}' alan adı için DNS IP adresi bulunamadı.`
                )
              );
            }

            for (const r of records) {
              if (isBlockedIp(r.address)) {
                return cb(
                  new SSRFSecurityError(
                    `DNS Rebinding / SSRF engellendi: '${lookupHost}' korumalı IP adresine (${r.address}) çözümlendi.`
                  )
                );
              }
            }

            // IPv4 adreslerini önce dene (IPv6 yönlendirme sorunlarını önlemek için)
            const sorted = [...records].sort((a, b) => a.family - b.family);
            cb(null, sorted[0].address, sorted[0].family);
          } catch (e) {
            cb(e);
          }
        },
      });

      const reqHeaders = {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(options.headers || {}),
      };

      const req = mod.request(
        urlObj,
        { agent, headers: reqHeaders, timeout: timeoutMs },
        (response) => {
          const statusCode = response.statusCode || 200;
          const respHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(response.headers)) {
            if (v) respHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : v;
          }

          const location = respHeaders["location"];
          let data = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            data += chunk;
            if (data.length > 10 * 1024 * 1024) {
              // 10MB limit
              response.destroy();
              resolve({ statusCode, headers: respHeaders, body: data, location });
            }
          });
          response.on("end", () =>
            resolve({ statusCode, headers: respHeaders, body: data, location })
          );
        }
      );

      req.on("timeout", () => {
        req.destroy(new Error(`İstek zaman aşımına uğradı (${timeoutMs}ms)`));
      });
      req.on("error", (err) => reject(err));
      req.end();
    });

    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.location) {
      const nextUrl = new URL(res.location, currentUrl).toString();
      // Validate redirect destination BEFORE making next request
      await validateSafeAuditUrl(nextUrl);
      currentUrl = nextUrl;
      hops++;
      continue;
    }

    return {
      statusCode: res.statusCode,
      headers: res.headers,
      text: res.body,
      finalUrl: currentUrl,
    };
  }

  throw new SSRFSecurityError(
    `Maksimum yönlendirme sınırı aşıldı (${maxHops} yönlendirme).`
  );
}
