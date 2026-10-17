import { NextRequest, NextResponse } from "next/server";
import { tryBackendProxy } from "@/lib/backend-proxy";
import { guardStoreUser } from "@/lib/store-auth";
import { authStore } from "@/lib/auth-users";

export async function GET(req: NextRequest) {
  const backend = await tryBackendProxy(req, "/auth/me");
  if (backend) return backend;
  const user = guardStoreUser(req);
  if (user instanceof NextResponse) return user;
  const profile = authStore.findUserByEmail(user.email);
  if (!profile || profile.id !== user.id) return NextResponse.json({ detail: "Oturum geçersiz" }, { status: 401 });
  return NextResponse.json({ id: profile.id, email: profile.email, full_name: profile.fullName, is_active: true, is_platform_admin: profile.isAdmin }, { headers: { "Cache-Control": "no-store" } });
}
