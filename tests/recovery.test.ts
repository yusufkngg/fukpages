import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALIVE_FOR,
  DRAFT_TTL,
  markTabAlive,
  markTabClosed,
  draftKey,
  findDrafts,
  mergeDocuments,
  writeDraft,
} from "../src/draftRecovery";
import { starterDocument } from "../src/model";
import { validateDocument } from "../server/index.mjs";

test("three-way recovery preserves independent edits, new nodes and deletions without overwriting a remote text conflict", () => {
  const base = starterDocument(),
    local = structuredClone(base),
    remote = structuredClone(base);
  local.name = "Local name";
  remote.nodes[0].name = "Remote section name";
  const merged = mergeDocuments(base, local, remote);
  assert.equal(merged.conflicts.length, 0);
  assert.equal(merged.document.name, local.name);
  assert.equal(merged.document.nodes[0].name, remote.nodes[0].name);
  local.nodes[0].name = "Conflicting local section";
  const unresolved = mergeDocuments(base, local, remote);
  assert.equal(unresolved.conflicts.length, 1);
  const resolved = mergeDocuments(base, local, remote, {
    [unresolved.conflicts[0].path]: "local",
  });
  assert.equal(resolved.document.nodes[0].name, local.nodes[0].name);
  local.nodes.splice(1, 1);
  remote.nodes[1].name = "Remote changed deleted section";
  const deletion = mergeDocuments(base, local, remote);
  assert.ok(deletion.conflicts.some((c) => c.local === undefined));
  assert.doesNotThrow(() => validateDocument(deletion.document));
});

test("recovery recognizes incompatible node reordering and allows an explicit choice while preserving new nodes", () => {
  const base = starterDocument(),
    local = structuredClone(base),
    remote = structuredClone(base);
  local.nodes.reverse();
  remote.nodes.push(remote.nodes.shift()!);
  const unresolved = mergeDocuments(base, local, remote);
  assert.ok(unresolved.conflicts.some((c) => c.path.endsWith(".order")));
  const choices = Object.fromEntries(
    unresolved.conflicts.map((c) => [c.path, "local" as const]),
  );
  assert.deepEqual(
    mergeDocuments(base, local, remote, choices).document.nodes.map(
      (n) => n.id,
    ),
    local.nodes.map((n) => n.id),
  );
});

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

test("F7: a closed tab's unsaved copy is found from a new tab, newest first, and stale copies expire", () => {
  const local = new MemoryStorage();
  const oldTab = new MemoryStorage(),
    newTab = new MemoryStorage();
  const base = starterDocument();
  const edited = structuredClone(base);
  edited.name = "Unsaved in closed tab";
  const now = Date.now();
  const oldKey = draftKey("owner", "s1", "p1", oldTab);
  writeDraft(
    oldKey,
    { document: edited, base, version: 3, updated: now - 5000 },
    local,
  );
  // A copy for another page, and an expired copy, in the same browser.
  writeDraft(
    draftKey("owner", "s1", "p2", oldTab),
    { document: edited, base, version: 1, updated: now },
    local,
  );
  writeDraft(
    "fp-recovery:owner:s1:p1:expired",
    { document: edited, base, version: 1, updated: now - DRAFT_TTL - 1 },
    local,
  );
  const newKey = draftKey("owner", "s1", "p1", newTab);
  assert.notEqual(newKey, oldKey);
  const found = findDrafts("owner", "s1", "p1", local, now);
  assert.equal(found.length, 1);
  assert.equal(found[0].key, oldKey);
  assert.equal(found[0].draft.document.name, "Unsaved in closed tab");
  assert.equal(local.getItem("fp-recovery:owner:s1:p1:expired"), null);
  // Another user's scope is never offered.
  assert.equal(findDrafts("editor-2", "s1", "p1", local, now).length, 0);
  const newer = structuredClone(edited);
  newer.name = "Newer copy";
  writeDraft(
    newKey,
    { document: newer, base, version: 3, updated: now },
    local,
  );
  assert.equal(
    findDrafts("owner", "s1", "p1", local, now)[0].draft.document.name,
    "Newer copy",
  );
});
