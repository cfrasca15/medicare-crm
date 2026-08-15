import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  const existingUser = await prisma.user.findFirst();
  if (!existingUser) {
    redirect("/setup");
  }

  return (
    <div className="flex min-h-full items-center justify-center">
      <LoginForm />
    </div>
  );
}
