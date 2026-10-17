import { NextRequest, NextResponse } from "next/server";
import { serverlessStore } from "@/lib/serverless-store";
import { tryBackendProxy } from "@/lib/backend-proxy";
import { guardStoreUser } from "@/lib/store-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const proxied = await tryBackendProxy(req, "/organizations");
  if (proxied) return proxied;

  // Yerel depo: yalnızca oturumdaki kullanıcının çalışma alanları döner.
  const user = guardStoreUser(req);
  if (user instanceof NextResponse) return user;
  serverlessStore.getOrCreateDefaultOrg(user.id);
  return NextResponse.json(serverlessStore.getOrganizationsForUser(user.id));
}

export async function POST(req: NextRequest) {
  const proxied = await tryBackendProxy(req, "/organizations");
  if (proxied) return proxied;

  const user = guardStoreUser(req);
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => ({}));
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ detail: "Organizasyon adı zorunludur" }, { status: 400 });
  }

  const org = serverlessStore.createOrganization(
    {
      name: body.name.slice(0, 100),
      slug: body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    },
    user.id
  );
  return NextResponse.json(org, { status: 201 });
}
