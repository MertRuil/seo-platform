import { NextRequest, NextResponse } from "next/server";
import { serverlessStore } from "@/lib/serverless-store";
import { tryBackendProxy } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const proxied = await tryBackendProxy(req, "/organizations");
  if (proxied) return proxied;

  let orgs = serverlessStore.getOrganizations();
  if (orgs.length === 0) {
    orgs = [serverlessStore.getOrCreateDefaultOrg()];
  }
  return NextResponse.json(orgs);
}

export async function POST(req: NextRequest) {
  const proxied = await tryBackendProxy(req, "/organizations");
  if (proxied) return proxied;

  const body = await req.json().catch(() => ({}));
  if (!body.name) {
    return NextResponse.json({ detail: "Organizasyon adı zorunludur" }, { status: 400 });
  }

  const org = serverlessStore.createOrganization({
    name: body.name,
    slug: body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  });
  return NextResponse.json(org, { status: 201 });
}
