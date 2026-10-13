/** FukPages logo tile used in the login screen, dashboard and editor. */
export function BrandMark({ size = 31 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }}>
      <img src="/brand/fukpages-mark.png" alt="" draggable={false} />
    </span>
  );
}
