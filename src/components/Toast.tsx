"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

// A short message in the bottom-right corner that fades away on its own
// (errors stay until closed), so results don't push the page around.
export function Toast({ message, error = false, onClose }: { message: string; error?: boolean; onClose: () => void }) {
  useEffect(() => {
    if (error) return;
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [message, error, onClose]);

  // Rendered at the page level so it stays visible even if its button
  // sits in a menu that has closed.
  return createPortal(
    <div
      role="status"
      className={`surface fixed right-6 bottom-6 z-50 flex max-w-md items-start gap-3 px-4 py-3 text-sm shadow-lg ${
        error ? "border-red-200 text-red-700 dark:border-red-900 dark:text-red-300" : ""
      }`}
    >
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onClose} aria-label="Close" className="muted cursor-pointer hover:text-slate-900">
        ✕
      </button>
    </div>,
    document.body
  );
}
