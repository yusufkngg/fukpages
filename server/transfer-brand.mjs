export function freezeBrandDocument(document, brand) {
  const values = (device) => {
    const out = {};
    for (const [k, v] of Object.entries(brand.colors)) out["--brand-" + k] = v;
    for (const [k, v] of Object.entries(brand.fonts))
      out["--font-" + k] =
        k === "fallback" ? v : `${v.split(",")[0]}, ${brand.fonts.fallback}`;
    for (const [k, v] of Object.entries(brand.typography))
      out["--type-" + k] =
        String(
          device === "mobile" && /^(h[1-6]|body|small|link)$/.test(k)
            ? Math.round(v * brand.typography.mobileScale)
            : v,
        ) + (/Weight$|LineHeight$/.test(k) ? "" : "px");
    return {
      ...out,
      "--brand-radius": brand.layout.radius + "px",
      "--brand-shadow": brand.layout.shadow,
      "--brand-container": brand.layout.container + "px",
      "--brand-section-space": brand.layout.sectionSpace + "px",
      "--heading-line-height": String(
        brand.typography.headingLineHeight || 1.15,
      ),
      "--body-line-height": String(brand.typography.bodyLineHeight || 1.6),
    };
  };
  const resolve = (styles, device) =>
    Object.fromEntries(
      Object.entries(styles).map(([k, v]) => [
        k,
        typeof v === "string"
          ? v.replace(
              /var\((--[\w-]+)\)/g,
              (match, key) => values(device)[key] || match,
            )
          : v,
      ]),
    );
  const defaults = (n) => {
    const inherited = {
      fontFamily: "var(--font-body)",
      color: "var(--brand-text)",
    };
    if (n.props.globalDetached) return inherited;
    if (n.kind === "heading")
      return {
        ...inherited,
        fontFamily: "var(--font-heading)",
        fontWeight: `var(--type-${n.props.tag || "h2"}Weight)`,
        lineHeight: "var(--heading-line-height)",
        fontSize: `var(--type-${n.props.tag || "h2"})`,
      };
    if (n.kind === "text") {
      const role = ["small", "link"].includes(n.props.globalStyle)
        ? n.props.globalStyle
        : "body";
      return {
        ...inherited,
        fontWeight: `var(--type-${role}Weight)`,
        lineHeight: "var(--body-line-height)",
        fontSize: `var(--type-${role})`,
      };
    }
    if (n.kind === "button") {
      const variant = n.props.buttonVariant || "primary";
      return {
        ...inherited,
        fontFamily: "var(--font-button)",
        backgroundColor:
          variant === "outline"
            ? "transparent"
            : `var(--brand-${variant === "secondary" ? "secondary" : "primary"})`,
        color:
          variant === "primary"
            ? "var(--brand-background)"
            : "var(--brand-text)",
        borderRadius: "var(--brand-radius)",
        ...(variant === "outline"
          ? {
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--brand-primary)",
            }
          : {}),
      };
    }
    if (n.kind === "section")
      return {
        ...inherited,
        width: "100%",
        marginLeft: "auto",
        marginRight: "auto",
        backgroundColor: "var(--brand-background)",
      };
    return inherited;
  };
  const copy = structuredClone(document);
  const walk = (nodes) =>
    nodes.forEach((n) => {
      if (n.kind === "section" && !n.props.globalDetached)
        n.props.sectionContentWidth = String(brand.layout.container);
      const desktop = { ...defaults(n), ...n.styles.desktop };
      n.styles = {
        desktop: resolve(desktop, "desktop"),
        tablet: resolve({ ...desktop, ...n.styles.tablet }, "tablet"),
        mobile: resolve(
          { ...desktop, ...n.styles.tablet, ...n.styles.mobile },
          "mobile",
        ),
      };
      n.props.globalDetached = true;
      for (const state of ["hoverStyles", "focusStyles"])
        if (n.props[state])
          n.props[state] = JSON.stringify(
            resolve(JSON.parse(n.props[state]), "desktop"),
          );
      walk(n.children);
    });
  walk(copy.nodes);
  return copy;
}
