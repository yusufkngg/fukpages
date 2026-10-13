export function catalogDocumentUses(document, asset, catalog, targets = []) {
  if (asset.type !== "image") return false;
  const products = new Set(),
    collections = new Set();
  const dynamic = targets.length
    ? targets
    : document.type === "product"
      ? [catalog.products[0]?.id]
      : document.type === "collection"
        ? [catalog.collections[0]?.id]
        : [];
  const walk = (nodes) =>
    nodes.forEach((n) => {
      if (n.props.productId && n.props.resourceBinding !== "page")
        products.add(n.props.productId);
      else if (
        document.type === "product" &&
        [
          "productField",
          "productGallery",
          "variantPicker",
          "quantity",
          "addToCart",
          "stickyCart",
        ].includes(n.kind)
      )
        dynamic.forEach((id) => products.add(id));
      for (const id of String(n.props.productIds || "")
        .split(",")
        .filter(Boolean))
        products.add(id.trim());
      if (n.kind === "collectionGrid") {
        if (n.props.collectionId && n.props.resourceBinding !== "page")
          collections.add(n.props.collectionId);
        else if (document.type === "collection")
          dynamic.forEach((id) => collections.add(id));
      }
      walk(n.children || []);
    });
  walk(document.nodes || []);
  for (const collection of catalog.collections)
    if (collections.has(collection.id))
      collection.productIds.forEach((id) => products.add(id));
  return (
    catalog.products
      .filter((p) => products.has(p.id))
      .some((p) =>
        [...p.images, ...p.variants.map((v) => v.image)].some((url) =>
          String(url || "").startsWith(`/api/assets/${asset.id}/`),
        ),
      ) ||
    catalog.collections.some(
      (c) =>
        collections.has(c.id) &&
        String(c.image || "").startsWith(`/api/assets/${asset.id}/`),
    )
  );
}
