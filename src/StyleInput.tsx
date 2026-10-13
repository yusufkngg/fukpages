import { useEffect, useRef, useState } from "react";
// Keep a typing buffer so adding px doesn't interrupt typing 10, 1.5 or 10%.
export function StyleInput({
  value,
  onChange,
  label,
  placeholder = "auto",
}: {
  value: string | number | undefined;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(String(value ?? ""));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(value ?? ""));
  }, [value]);
  return (
    <input
      aria-label={label}
      value={draft}
      placeholder={placeholder}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange(event.target.value);
      }}
      onBlur={() => {
        focused.current = false;
        setDraft(String(value ?? ""));
      }}
    />
  );
}
