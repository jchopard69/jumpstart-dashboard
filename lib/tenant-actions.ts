"use server";

import { cookies } from "next/headers";

const TENANT_COOKIE = "active_tenant_id";

export async function setActiveTenant(tenantId: string) {
  const cookieStore = cookies();
  cookieStore.set(TENANT_COOKIE, tenantId, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365
  });
}
