import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Nav } from "@/components/Nav";
import { aepSeason } from "@/lib/aep";
import { DatePaste } from "@/components/DatePaste";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Medicare CRM",
  description: "CRM for Medicare health insurance brokers",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // A new number each time the server redraws the page (after any save),
  // which tells the menu to recount. A layout only ever renders on the
  // server, once per request, so the "must be pure" rule has nothing to guard.
  // eslint-disable-next-line react-hooks/purity
  const stamp = Date.now();
  // The menu's Business group stays the way it was left (see Nav).
  const businessOpen = (await cookies()).get("nav-business")?.value === "open";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full h-full flex flex-col md:flex-row">
        <Nav stamp={stamp} aepActive={aepSeason().active} businessOpen={businessOpen} />
        <DatePaste />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:h-full md:p-8">{children}</main>
      </body>
    </html>
  );
}
