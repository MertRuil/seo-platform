import type { ChangeSetItem } from "@/lib/demo";

/**
 * Sandbox değişiklik setleri: arka uçta liste ucu olmadığı için tarayıcıda tutulur.
 * ponytail: localStorage; GET /change-sets ucu gelince bu modül api.ts çağrısına döner.
 */
const KEY = "seo_platform_changesets";
const KEY_ACTIVE = "seo_platform_active_changeset_id";
const LEGACY_KEY = "dentleon_changesets";
const LEGACY_ACTIVE = "dentleon_active_changeset_id";

export function readChangeSets(): ChangeSetItem[] {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as ChangeSetItem[]) : [];
  } catch {
    return [];
  }
}

export function writeChangeSets(list: ChangeSetItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* depolama kapalı */
  }
}

export function readActiveId(): string | null {
  try {
    return localStorage.getItem(KEY_ACTIVE) || localStorage.getItem(LEGACY_ACTIVE);
  } catch {
    return null;
  }
}

export function addChangeSet(set: ChangeSetItem) {
  const list = readChangeSets().filter((s) => !(set.sorunId && s.sorunId === set.sorunId));
  writeChangeSets([set, ...list]);
  try {
    localStorage.setItem(KEY_ACTIVE, set.id);
  } catch {
    /* depolama kapalı */
  }
}

export function newChangeSetId(prefix = "CS"): string {
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}
