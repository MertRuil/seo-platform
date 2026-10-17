/**
 * Girişsiz denetimde analiz edilen adres, kayıttan sonra ilk proje olarak eklenir.
 * Kullanıcı aynı URL'yi ikinci kez yazmak zorunda kalmaz.
 */
const KEY = "calpeo_pending_site";

export function setPendingSite(url: string): void {
  try {
    localStorage.setItem(KEY, url);
  } catch {
    /* yok say */
  }
}

export function readPendingSite(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingSite(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* yok say */
  }
}
