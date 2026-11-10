"use client";

import { useEffect } from "react";
import { parsePastedDate } from "@/lib/parsePastedDate";

// Lets every date box in the app take a pasted date ("03/15/1950",
// "March 15, 1950", ...). Browsers' own date boxes ignore most pastes.
export function DatePaste() {
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || el.type !== "date") return;
      const value = parsePastedDate(e.clipboardData?.getData("text") ?? "");
      if (!value) return;
      e.preventDefault();
      // Through the native setter, so React-controlled boxes see it too.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    document.addEventListener("paste", onPaste, true);
    return () => document.removeEventListener("paste", onPaste, true);
  }, []);
  return null;
}
