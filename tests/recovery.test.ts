import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeDocuments } from "../src/draftRecovery";
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
