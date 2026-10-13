import { createBlock, type Block, type Device } from "./model.ts";
export function setColumnCount(
  node: Block,
  count: number,
  device: Device,
): Block {
  count = Math.max(1, Math.min(6, Math.round(count)));
  if (!["row", "section"].includes(node.kind)) return node;
  if (node.kind === "section") {
    const row = node.children.find((n) => n.kind === "row");
    if (row)
      return {
        ...node,
        children: node.children.map((n) =>
          n.id === row.id ? setColumnCount(n, count, device) : n,
        ),
      };
    const layout = createBlock("row");
    layout.children = node.children;
    return { ...node, children: [setColumnCount(layout, count, device)] };
  }
  const columns = node.children.filter((n) => n.kind === "column");
  const loose = node.children.filter((n) => n.kind !== "column");
  if (!columns.length) {
    const first = createBlock("column");
    first.children = loose;
    columns.push(first);
  } else if (loose.length)
    columns[0] = {
      ...columns[0],
      children: [...columns[0].children, ...loose],
    };
  while (columns.length < count) columns.push(createBlock("column"));
  if (columns.length > count) {
    columns[count - 1] = {
      ...columns[count - 1],
      children: [
        ...columns[count - 1].children,
        ...columns.slice(count).flatMap((n) => n.children),
      ],
    };
    columns.splice(count);
  }
  return {
    ...node,
    styles: {
      ...node.styles,
      [device]: {
        ...node.styles[device],
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
      },
    },
    children: columns.map((column) => ({
      ...column,
      styles: {
        ...column.styles,
        [device]: {
          ...column.styles[device],
          width: 100 / count + "%",
          flexBasis: 100 / count + "%",
        },
      },
    })),
  };
}
