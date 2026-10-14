/**
 * One selection model for the canvas, the layer tree and the keyboard:
 * a primary element (shown in the inspector) plus the selected set.
 * Plain click replaces, Shift adds, Ctrl/Cmd toggles.
 */
export type SelectMode = "replace" | "add" | "toggle";
export interface SelectionState {
  primary: string | null;
  ids: string[];
}

export const modeFor = (event: {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}): SelectMode =>
  event.ctrlKey || event.metaKey
    ? "toggle"
    : event.shiftKey
      ? "add"
      : "replace";

export function applySelection(
  state: SelectionState,
  id: string,
  mode: SelectMode | boolean = "replace",
): SelectionState {
  const resolved: SelectMode =
    mode === true ? "toggle" : mode === false ? "replace" : mode;
  // The set always contains the primary element.
  const base = state.primary
    ? [...new Set([...state.ids, state.primary])]
    : state.ids;
  if (resolved === "replace") return { primary: id, ids: [id] };
  if (resolved === "add")
    return { primary: id, ids: base.includes(id) ? base : [...base, id] };
  if (!base.includes(id)) return { primary: id, ids: [...base, id] };
  const ids = base.filter((v) => v !== id);
  return { primary: ids.at(-1) ?? null, ids };
}
