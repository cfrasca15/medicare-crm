import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Two contact pages next to each other (e.g. husband and wife). Each side is
// the normal contact page, so everything on it works and saves as usual.
export default async function SideBySidePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;
  if (!a || !b) notFound();

  const contacts = await prisma.contact.findMany({
    where: { id: { in: [a, b] } },
    select: { id: true, firstName: true, lastName: true },
  });
  const left = contacts.find((c) => c.id === a);
  const right = contacts.find((c) => c.id === b);
  if (!left || !right) notFound();

  return (
    <div className="-m-8 flex h-[calc(100%+4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm dark:border-slate-800">
        <span className="font-medium">
          {left.firstName} {left.lastName} &amp; {right.firstName} {right.lastName}
        </span>
        <div className="flex items-center gap-4">
          <Link href={`/side-by-side?a=${b}&b=${a}`} className="link">
            Swap sides
          </Link>
          <Link href={`/contacts/${a}`} className="link">
            Close
          </Link>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800">
        {[left, right].map((c) => (
          <iframe
            key={c.id}
            src={`/contacts/${c.id}`}
            title={`${c.firstName} ${c.lastName}`}
            className="h-full w-full border-0"
          />
        ))}
      </div>
    </div>
  );
}
