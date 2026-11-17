"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { logout } from "@/lib/actions/auth";
import { QuickSearch } from "@/components/QuickSearch";
import type { NavCounts } from "@/lib/navCounts";

// Simple 20px line icons (stroke paths on a 24px grid).
const ICONS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  users: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19v-1a4 4 0 0 0-3-3.87M15.5 3.13a3.5 3.5 0 0 1 0 6.75",
  check: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  cake: "M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M12 12V8M12 5.5a1.5 1.5 0 0 0 1.5-1.5c0-1-1.5-2.5-1.5-2.5S10.5 3 10.5 4A1.5 1.5 0 0 0 12 5.5M5 16c2 1.5 4 1.5 7 0s5-1.5 7 0",
  calendar: "M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  briefcase: "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M4 6h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1M3 12h18",
  mail: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1M3 7l9 6 9-6",
  gear: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  chevron: "M9 6l6 6-6 6",
  logout: "M15 17l5-5-5-5M20 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
  dollar: "M12 2v20M17 6.5c0-1.9-2.2-3.5-5-3.5S7 4.6 7 6.5 9.2 9.6 12 10s5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5",
  lifebuoy: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6L6 18",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 12h.01",
  pin: "M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  bell:"M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
};

// The menu, top to bottom: the places you go, the lists of things waiting on
// you, then the reports. Settings and Log out sit in the bottom row.
// `also` lights a link up on pages that belong to it but live at another address.
type NavLink = { href: string; label: string; icon: string; also?: string[] };
// `folds`: the group's heading opens and closes it.
type NavSection = { title?: string; folds?: boolean; links: NavLink[] };

const AEP_LINK: NavLink = { href: "/aep", label: "AEP Worklist", icon: "list" };

// The AEP Worklist leads "To do" from Oct 1 to Dec 7, when it's the thing to
// be working on, and is filed under Business for the rest of the year.
const sections = (aepActive: boolean): NavSection[] => [
  {
    links: [
      { href: "/", label: "Dashboard", icon: "home" },
      { href: "/contacts", label: "Contacts", icon: "users" },
      { href: "/calendar", label: "Calendar", icon: "calendar", also: ["/book"] },
      { href: "/events", label: "Events", icon: "pin" },
    ],
  },
  {
    title: "To do",
    links: [
      ...(aepActive ? [AEP_LINK] : []),
      { href: "/tasks", label: "Tasks", icon: "check" },
      { href: "/inbox", label: "Needs a Reply", icon: "mail" },
      { href: "/service", label: "Service Requests", icon: "lifebuoy" },
      { href: "/alerts", label: "Change Alerts", icon: "bell" },
    ],
  },
  {
    title: "Business",
    folds: true,
    links: [
      { href: "/enrollments", label: "Enrollments", icon: "chart" },
      { href: "/commissions", label: "Commissions", icon: "dollar" },
      { href: "/book-of-business", label: "Book of Business", icon: "briefcase" },
      { href: "/lead-sources", label: "Lead Sources", icon: "target" },
      { href: "/birthdays", label: "Birthdays", icon: "cake" },
      ...(aepActive ? [] : [AEP_LINK]),
    ],
  },
];

// Whether the Business group is open is kept in a cookie, so the server
// draws the menu the way it was left (no jump when the page loads).
const BUSINESS_COOKIE = "nav-business";

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d={ICONS[name]} />
    </svg>
  );
}

const HIDE_NAV_PATHS = ["/login", "/setup"];

// True when this page is shown inside another page (the side-by-side view),
// which already has its own menu.
const subscribeNoop = () => () => {};
const isFramed = () => window.self !== window.top;

// `stamp` changes whenever the server redraws the page after a save, which is
// the cue to count again (a task just got ticked off, say).
export function Nav({
  stamp,
  aepActive,
  businessOpen: businessOpenAtLoad,
}: {
  stamp: number;
  aepActive: boolean;
  businessOpen: boolean;
}) {
  const pathname = usePathname();
  const framed = useSyncExternalStore(subscribeNoop, isFramed, () => false);
  // Phones and narrow windows: the menu slides in from the ☰ button.
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<NavCounts>({});
  const [businessOpen, setBusinessOpen] = useState(businessOpenAtLoad);
  const lastStamp = useRef(stamp);

  const hidden = framed || HIDE_NAV_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Counts next to the "To do" links: fetched on each page change, after each
  // save, and on coming back to the window (after replying in Gmail, say).
  useEffect(() => {
    if (hidden) return;
    const ctrl = new AbortController();
    const load = async (saved = false) => {
      try {
        const res = await fetch(`/api/nav-counts${saved ? "?fresh=1" : ""}`, { signal: ctrl.signal });
        if (res.ok && res.headers.get("content-type")?.includes("json")) setCounts(await res.json());
      } catch {
        // left the page, or offline: keep the counts already showing
      }
    };
    load(lastStamp.current !== stamp);
    lastStamp.current = stamp;
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      ctrl.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname, stamp, hidden]);

  if (hidden) return null;

  // Whole path segments only, so "/book" isn't lit up on "/book-of-business".
  const under = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const isActive = (link: { href: string; also?: string[] }) =>
    under(link.href) || (link.also ?? []).some(under);
  const settingsActive = under("/settings");

  const toggleBusiness = () => {
    const next = !businessOpen;
    setBusinessOpen(next);
    document.cookie = `${BUSINESS_COOKIE}=${next ? "open" : "closed"}; path=/; max-age=31536000; samesite=lax`;
  };

  const brand = (
    <span className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm">
        CF
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Medicare CRM</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">Chris Frasca Insurance</span>
      </span>
    </span>
  );

  return (
    <>
      {/* Top bar with the menu button, on narrow screens only. */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 md:hidden print:hidden dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Icon name="menu" />
        </button>
        {brand}
      </div>
      {open && (
        <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-slate-900/40 md:hidden" />
      )}
    <nav
      className={`fixed inset-y-0 left-0 z-40 flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4 shadow-xl transition-transform md:static md:w-60 md:translate-x-0 md:shadow-none print:hidden dark:border-slate-800 dark:bg-slate-900 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="mb-5 flex items-center justify-between gap-2 px-2">
        {brand}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"
        >
          <Icon name="close" />
        </button>
      </div>
      <QuickSearch />
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {sections(aepActive).map((section, i) => {
          const folded = section.folds && !businessOpen;
          // Folded away, the group still shows the page you're on.
          const links = folded ? section.links.filter(isActive) : section.links;
          return (
          <div key={section.title ?? i} className="flex flex-col gap-0.5">
            {section.title && !section.folds && (
              <div className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                {section.title}
              </div>
            )}
            {section.folds && (
              <button
                type="button"
                onClick={toggleBusiness}
                aria-expanded={!folded}
                className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                {section.title}
                <span className={`transition-transform ${folded ? "" : "rotate-90"}`}>
                  <Icon name="chevron" size={14} />
                </span>
              </button>
            )}
            {links.map((link) => {
              const active = isActive(link);
              const badge = counts[link.href];
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className={active ? "text-indigo-600 dark:text-indigo-300" : "text-slate-400"}>
                    <Icon name={link.icon} />
                  </span>
                  {link.label}
                  {badge && (
                    <span
                      title={badge.title}
                      className={`ml-auto rounded-full px-1.5 text-xs leading-5 font-medium tabular-nums ${
                        badge.alert
                          ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {badge.text}
                      <span className="sr-only">: {badge.title}</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-1 border-t border-slate-200 pt-3 dark:border-slate-800">
        <Link
          href="/settings"
          onClick={() => setOpen(false)}
          aria-current={settingsActive ? "page" : undefined}
          className={`flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            settingsActive
              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <span className={settingsActive ? "text-indigo-600 dark:text-indigo-300" : "text-slate-400"}>
            <Icon name="gear" />
          </span>
          Settings
        </Link>
        {/* One stray click here shouldn't sign you out. */}
        <form
          action={logout}
          onSubmit={(e) => {
            if (!confirm("Log out of the CRM?")) e.preventDefault();
          }}
        >
          <button
            type="submit"
            aria-label="Log out"
            title="Log out"
            className="flex cursor-pointer items-center rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <Icon name="logout" />
          </button>
        </form>
      </div>
    </nav>
    </>
  );
}
