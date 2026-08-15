"use server";

import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
} from "@/lib/auth";
import { redirect } from "next/navigation";

export async function setupAccount(formData: FormData) {
  const existingUser = await prisma.user.findFirst();
  if (existingUser) {
    throw new Error("An account already exists. Go to /login instead.");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (password !== confirmPassword) {
    throw new Error("Passwords don't match.");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash },
  });

  await setSessionCookie(user.id);
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password.");
  }

  await setSessionCookie(user.id);
}

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}
