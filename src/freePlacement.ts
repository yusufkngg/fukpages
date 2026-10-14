import { effectiveStyle, type Block, type Device, type Styles } from "./model";
import { normalizeStyles } from "./styleValues";
export const cssNumber = (value: number) => Math.round(value * 100) / 100;
export function freeHeight(
  node: Block | undefined | null,
  device: Device,
): number | null {
  if (!node) return null;
  try {
    const value = JSON.parse(String(node.props.freeLayout || "{}"))[device];
    return typeof value === "number" && Number.isFinite(value)
      ? Math.max(100, Math.min(5000, value))
      : null;
  } catch {
    return null;
  }
}
export function placedStyle(
  node: Block,
  device: Device,
  parentFree = false,
): Styles {
  const iconDefaults: Styles =
    node.kind === "icon"
      ? { display: "inline-flex", width: "fit-content", lineHeight: 1 }
      : {};
  const style = { ...iconDefaults, ...effectiveStyle(node, device) } as Styles;
  if (parentFree)
    return {
      ...style,
      position: "absolute",
      marginTop: 0,
      marginLeft: 0,
      marginBottom: 0,
      marginRight: 0,
    };
  if (!node.props.freePlaced) return style;
  const result: Styles = {};
  for (const d of [
    "desktop",
    ...(device !== "desktop" ? ["tablet"] : []),
    ...(device === "mobile" ? ["mobile"] : []),
  ] as Device[])
    Object.assign(result, flowStyle(node, d));
  return { ...iconDefaults, ...normalizeStyles(result) };
}
const geometryKeys = [
  "position",
  "left",
  "top",
  "right",
  "bottom",
  "width",
  "height",
];
function flowStyle(node: Block, device: Device): Styles {
  const style = { ...node.styles[device] };
  try {
    const original = JSON.parse(String(node.props.freeFlowStyles || "{}"))[
      device
    ];
    if (original)
      for (const key of geometryKeys) {
        delete style[key];
        if (original[key] !== undefined) style[key] = original[key];
      }
  } catch {}
  return style;
}
export function setFreeLayout(
  node: Block,
  device: Device,
  enabled: boolean,
  geometry: Record<
    string,
    { left: number; top: number; width: number; height: number }
  > = {},
): Block {
  let modes: Partial<Record<Device, number>> = {};
  try {
    modes = JSON.parse(String(node.props.freeLayout || "{}"));
  } catch {}
  if (!enabled) {
    delete modes[device];
    return {
      ...node,
      props: { ...node.props, freeLayout: JSON.stringify(modes) },
      children: node.children.map((child) => {
        if (!child.props.freePlaced) return child;
        const style = flowStyle(child, device);
        let original: Partial<Record<Device, Styles>> = {};
        try {
          original = JSON.parse(String(child.props.freeFlowStyles || "{}"));
        } catch {}
        delete original[device];
        return {
          ...child,
          props: {
            ...child.props,
            freePlaced: Object.keys(original).length > 0,
            freeFlowStyles: JSON.stringify(original),
          },
          styles: { ...child.styles, [device]: style },
        };
      }),
    };
  }
  if (freeHeight(node, device)) return node;
  let height = 320;
  const children = node.children.map((child, index) => {
    const box = geometry[child.id] || {
      left: 5,
      top: index * 90,
      width: 40,
      height: 70,
    };
    height = Math.max(height, box.top + box.height + 32);
    let flow: Partial<Record<Device, Styles>> = {};
    try {
      flow = JSON.parse(String(child.props.freeFlowStyles || "{}"));
    } catch {}
    if (!flow[device]) flow[device] = { ...child.styles[device] };
    return {
      ...child,
      props: {
        ...child.props,
        freePlaced: true,
        freeFlowStyles: JSON.stringify(flow),
      },
      styles: {
        ...child.styles,
        [device]: {
          ...child.styles[device],
          position: "absolute",
          left: cssNumber(box.left) + "%",
          top: cssNumber(box.top) + "px",
          width: cssNumber(box.width) + "%",
          height: cssNumber(box.height) + "px",
        },
      },
    };
  });
  modes[device] = Math.min(5000, height);
  return {
    ...node,
    props: { ...node.props, freeLayout: JSON.stringify(modes) },
    children,
  };
}

/**
 * A fixed pixel width never pushes a block past its container: 404 px text
 * in a 350 px mobile column renders 350 px wide instead of overflowing.
 */
export function fitWidth<T extends Record<string, unknown>>(
  style: T,
  parentFree = false,
): T {
  const width = style.width;
  if (parentFree || typeof width !== "string") return style;
  return /^\d+(\.\d+)?px$/.test(width)
    ? { ...style, width: `min(${width}, 100%)` }
    : style;
}
