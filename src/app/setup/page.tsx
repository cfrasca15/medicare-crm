import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SetupForm } from "@/components/SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const existingUser = await prisma.user.findFirst();
  if (existingUser) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full items-center justify-center">
      <SetupForm />
    </div>
  );
}
