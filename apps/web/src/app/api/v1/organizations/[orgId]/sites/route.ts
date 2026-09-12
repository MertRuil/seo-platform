import { NextRequest, NextResponse } from "next/server";
import { serverlessStore } from "@/lib/serverless-store";
import { tryBackendProxy } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  const proxied = await tryBackendProxy(req, `/organizations/${params.orgId}/sites`);
  if (proxied) return proxied;

  const sites = serverlessStore.getSites(params.orgId);
  return NextResponse.json(sites);
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const proxied = await tryBackendProxy(req, `/organizations/${params.orgId}/sites`);
  if (proxied) return proxied;

  const body = await req.json().catch(() => ({}));
  if (!body.primary_url) {
    return NextResponse.json({ detail: "Web sitesi adresi (primary_url) zorunludur" }, { status: 400 });
  }

  try {
    const site = serverlessStore.createSite(params.orgId, {
      name: body.name,
      primary_url: body.primary_url,
      site_type: body.site_type,
      execution_mode: body.execution_mode,
    });
    return NextResponse.json(site, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || "Site eklenirken hata oluştu" }, { status: 400 });
  }
}
