import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bricolage_Grotesque, Work_Sans } from "next/font/google";
import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/date";
import { PrintButton } from "@/components/PrintButton";
import "./sheet.css";

export const dynamic = "force-dynamic";

const heading = Bricolage_Grotesque({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-signin-heading" });
const body = Work_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-signin-body" });

const ROWS_PER_PAGE = 26;
// Empty lines always left at the end for people who didn't RSVP.
const WALK_IN_LINES = 6;

// The tree logo, shown once the file is in /public (see README).
const LOGO = "sign-in-logo.png";
const hasLogo = () => fs.existsSync(path.join(process.cwd(), "public", LOGO));

type Line = { firstName: string; lastName: string; email: string; phone: string } | null;

// (949) 555-0123 for a US number; anything else prints as it was typed.
function printPhone(phone: string | null): string {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : phone.trim();
}

// A long email steps down in size so it prints whole instead of being cut off.
const emailSize = (email: string) => (email.length > 28 ? "signin-tiny" : email.length > 23 ? "signin-small" : undefined);

// The paper sign-in sheet for an event, with the RSVPs' names, emails and
// phone numbers filled in, and blank lines for walk-ins.
export default async function SignInSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blank?: string }>;
}) {
  const { id } = await params;
  const blank = (await searchParams).blank === "1";
  const event = await prisma.event.findUnique({
    where: { id },
    include: { guests: { where: { walkIn: false }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] } },
  });
  if (!event) notFound();

  const filled: Line[] = blank
    ? []
    : event.guests.map((g) => ({
        firstName: g.firstName,
        lastName: g.lastName,
        email: g.email?.trim() ?? "",
        phone: printPhone(g.phone),
      }));
  const pageCount = Math.max(1, Math.ceil((filled.length + (blank ? 0 : WALK_IN_LINES)) / ROWS_PER_PAGE));
  const lines: Line[] = [...filled, ...Array<Line>(pageCount * ROWS_PER_PAGE - filled.length).fill(null)];
  const pages = Array.from({ length: pageCount }, (_, p) => lines.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE));
  const logo = hasLogo();

  return (
    <div className={`${heading.variable} ${body.variable} flex flex-col gap-5 print:block`}>
      <div className="mx-auto flex w-full max-w-[8.5in] flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href={`/events/${event.id}`} className="link text-sm">
            ← {event.name}
          </Link>
          <p className="muted mt-1 text-xs">
            {blank
              ? "A blank sheet."
              : `${filled.length} RSVP${filled.length === 1 ? "" : "s"} filled in, with blank lines for walk-ins.`}{" "}
            In the print window, turn on &ldquo;Background graphics&rdquo; so the colors print.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/events/${event.id}/sign-in${blank ? "" : "?blank=1"}`} className="btn-secondary">
            {blank ? "Fill in the RSVPs" : "Blank sheet"}
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        {pages.map((rows, p) => (
          <div key={p} className="signin-paper">
            <div className="signin-page">
              <div className="signin-brand">
                <div className="signin-brand-left">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {logo && <img src={`/${LOGO}`} alt="" className="signin-logo" />}
                  <div>
                    <div className="signin-brand-name">Chris Frasca</div>
                    <div className="signin-brand-sub">Insurance Services</div>
                  </div>
                </div>
                <div className="signin-date">
                  Date <span className="signin-date-line">{blank ? " " : formatDateOnly(event.date)}</span>
                </div>
              </div>

              <h1 className="signin-title">Welcome! Optional sign-in sheet</h1>
              <p className="signin-note">Sharing your contact information is optional. Please print clearly.</p>

              <div className="signin-table-wrap">
                <table className="signin-table">
                  <colgroup>
                    <col style={{ width: "4.4%" }} />
                    <col style={{ width: "18.2%" }} />
                    <col style={{ width: "19.9%" }} />
                    <col style={{ width: "29.2%" }} />
                    <col style={{ width: "17.7%" }} />
                    <col style={{ width: "10.6%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>First name</th>
                      <th>Last name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Attended?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((line, i) => (
                      <tr key={i}>
                        <td className="signin-num">{p * ROWS_PER_PAGE + i + 1}</td>
                        <td>{line?.firstName}</td>
                        <td>{line?.lastName}</td>
                        <td className={line ? emailSize(line.email) : undefined}>{line?.email}</td>
                        <td>{line?.phone}</td>
                        <td className="signin-check">
                          <span className="signin-box" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="signin-footer">
                <span>Chris Frasca Insurance Services{pageCount > 1 ? ` · Page ${p + 1} of ${pageCount}` : ""}</span>
                <span>chrisfrascainsurance.com · 949-259-6744</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
