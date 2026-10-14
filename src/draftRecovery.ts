import type { PageDocument } from "./model";
export type LocalDraft = {
  document: PageDocument;
  base: PageDocument;
  version: number;
  updated: number;
};
export function draftKey(
  scope: string,
  store: string,
  page: string,
  session: Storage = sessionStorage,
) {
  let tab = session.getItem("fp-draft-tab");
  if (!tab) {
    tab = crypto.randomUUID();
    session.setItem("fp-draft-tab", tab);
  }
  return `fp-recovery:${scope}:${store}:${page}:${tab}`;
}
export const DRAFT_TTL = 14 * 24 * 60 * 60 * 1000;
const draftPrefix = (scope: string, store: string, page: string) =>
  `fp-recovery:${scope}:${store}:${page}:`;
// Recovery copies are written per tab (two open tabs never overwrite each
// other) but found per user/store/page, so closing a tab and opening the page
// in a new one still offers the newest unsaved copy. Copies older than the
// TTL are removed while looking.
export function findDrafts(
  scope: string,
  store: string,
  page: string,
  storage: Storage = localStorage,
  now = Date.now(),
): { key: string; draft: LocalDraft }[] {
  const prefix = draftPrefix(scope, store, page);
  const found: { key: string; draft: LocalDraft }[] = [];
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith("fp-recovery:")) keys.push(key);
  }
  for (const key of keys) {
    const draft = readDraft(key, storage);
    if (!draft || now - draft.updated > DRAFT_TTL) {
      storage.removeItem(key);
      continue;
    }
    if (key.startsWith(prefix)) found.push({ key, draft });
  }
  return found.sort((a, b) => b.draft.updated - a.draft.updated);
}
export function readDraft(
  key: string,
  storage: Storage = localStorage,
): LocalDraft | null {
  try {
    const v = JSON.parse(storage.getItem(key) || "null");
    return v?.document?.schemaVersion === 1 &&
      v?.base?.schemaVersion === 1 &&
      Number.isInteger(v.version) &&
      v.updated
      ? v
      : null;
  } catch {
    return null;
  }
}
export function writeDraft(
  key: string,
  draft: LocalDraft,
  storage: Storage = localStorage,
) {
  try {
    storage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
export type MergeConflict = { path: string; local: unknown; remote: unknown };
export type MergeChoices = Record<string, "local" | "remote">;
export function mergeDocuments(
  base: PageDocument,
  local: PageDocument,
  remote: PageDocument,
  choices: MergeChoices = {},
) {
  const conflicts: MergeConflict[] = [];
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  const object = (a: unknown): a is Record<string, unknown> =>
    !!a && typeof a === "object" && !Array.isArray(a);
  const conflict = (path: string, left: unknown, right: unknown) => {
    conflicts.push({ path, local: left, remote: right });
    return structuredClone(choices[path] === "local" ? left : right);
  };
  const merge = (
    old: unknown,
    left: unknown,
    right: unknown,
    path: string,
  ): unknown => {
    if (same(left, old)) return structuredClone(right);
    if (same(right, old) || same(left, right)) return structuredClone(left);
    if (object(old) && object(left) && object(right)) {
      const result: Record<string, unknown> = {};
      for (const k of new Set([
        ...Object.keys(old),
        ...Object.keys(left),
        ...Object.keys(right),
      ])) {
        const value = merge(old[k], left[k], right[k], `${path}.${k}`);
        if (value !== undefined) result[k] = value;
      }
      return result;
    }
    if (
      Array.isArray(old) &&
      Array.isArray(left) &&
      Array.isArray(right) &&
      [...old, ...left, ...right].every(
        (v) => object(v) && typeof v.id === "string",
      )
    ) {
      const byId = (a: Record<string, unknown>[]) =>
        new Map(a.map((v) => [String(v.id), v]));
      const a = byId(old),
        b = byId(left),
        c = byId(right);
      const shared = old
        .map((v) => String(v.id))
        .filter((id) => b.has(id) && c.has(id));
      const localOrder = left.map((v) => String(v.id)),
        remoteOrder = right.map((v) => String(v.id));
      const changed = (ids: string[]) =>
        !same(
          ids.filter((id) => shared.includes(id)),
          shared,
        );
      let order = remoteOrder;
      if (changed(localOrder) && !changed(remoteOrder)) order = localOrder;
      else if (
        changed(localOrder) &&
        changed(remoteOrder) &&
        !same(localOrder, remoteOrder)
      )
        order = conflict(path + ".order", localOrder, remoteOrder) as string[];
      const ids = [...new Set([...order, ...remoteOrder, ...localOrder])];
      return ids
        .map((id) => merge(a.get(id), b.get(id), c.get(id), `${path}[${id}]`))
        .filter((v) => v !== undefined);
    }
    return conflict(path, left, right);
  };
  return {
    document: merge(base, local, remote, "sayfa") as PageDocument,
    conflicts,
  };
}
export function downloadDocument(document: PageDocument, suffix = "taslak") {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }),
  );
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `${document.name.replace(/[^\p{L}\p{N}-]/gu, "-")}-${suffix}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
