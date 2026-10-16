"use client";

import { useEffect, useRef, useState } from "react";

// Shows its children only while a field in the same form (e.g. a radio
// group) has the given value; for a checkbox, its value while ticked ("on").
// Hidden fields aren't submitted.
export function ShowWhen({
  field,
  value,
  initial = "",
  children,
}: {
  field: string;
  value: string;
  initial?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState(initial);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const read = () => {
      const el = form.elements.namedItem(field);
      if (el instanceof HTMLInputElement && el.type === "checkbox") setCurrent(el.checked ? el.value : "");
      else setCurrent(el && "value" in el ? String(el.value) : "");
    };
    const onReset = () => setTimeout(read, 0);
    form.addEventListener("change", read);
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("change", read);
      form.removeEventListener("reset", onReset);
    };
  }, [field]);

  return (
    <>
      <span ref={ref} hidden />
      {current === value ? children : null}
    </>
  );
}
