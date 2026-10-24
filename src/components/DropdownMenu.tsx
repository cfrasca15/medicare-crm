"use client";

import { useEffect, useRef } from "react";

// A button that opens a small menu underneath; closes on an outside click or
// Escape. Children are the menu items (use the .menu-item class).
export function DropdownMenu({
  label,
  children,
  align = "right",
  buttonClassName = "btn-secondary",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  buttonClassName?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary className={`${buttonClassName} list-none [&::-webkit-details-marker]:hidden`}>{label}</summary>
      <div
        className={`surface absolute z-30 mt-2 min-w-52 p-1.5 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
      >
        {children}
      </div>
    </details>
  );
}
