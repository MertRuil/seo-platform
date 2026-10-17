import assert from "node:assert/strict";
import { NextRequest } from "next/server";

async function run() {
  const env = process.env as Record<string, string | undefined>;
  env.NODE_ENV = "production";
  delete env.ALLOW_LOCAL_DEMO;
  env.BACKEND_API_URL = "https://backend.example.invalid/api/v1";
  const { tryBackendProxy } = await import("./src/lib/backend-proxy");
  const { isLocalAuthEnabled } = await import("./src/lib/auth-users");
  assert.equal(isLocalAuthEnabled(), false);
  let captured: {url:string; init:RequestInit} | undefined;
  const original = global.fetch;
  try {
    global.fetch = async (url, init) => {
      captured = {url:String(url), init:init!};
      return new Response(JSON.stringify({ok:true}), {headers:{"Content-Type":"application/json"}});
    };
    const req = new NextRequest("https://web.example.invalid/api/v1/knowledge/stats", {headers:{cookie:"seo_platform_token=local-test-token"}});
    const response = await tryBackendProxy(req,"/knowledge/stats");
    assert.equal(response?.status,200);
    assert.equal(captured?.url,"https://backend.example.invalid/api/v1/knowledge/stats");
    assert.equal((captured!.init.headers as Record<string,string>).Authorization,"Bearer local-test-token");
    assert.equal((captured!.init.headers as Record<string,string>).cookie,undefined);
    assert.equal(captured!.init.redirect,"manual");
    global.fetch = async () => new Response(null,{status:302,headers:{location:"https://web.example.invalid/integrations","set-cookie":"calpeo_google_state=state; HttpOnly; SameSite=Lax; Path=/"}});
    const redirect = await tryBackendProxy(req,"/integrations/google/callback");
    assert.equal(redirect?.status,302);
    assert.equal(redirect?.headers.get("location"),"https://web.example.invalid/integrations");
    assert.match(redirect!.headers.get("set-cookie")!,/^calpeo_google_state=/);
    global.fetch = async () => { throw new TypeError("offline"); };
    assert.equal((await tryBackendProxy(req,"/organizations"))?.status,502);
    const catchAll = await import("./src/app/api/v1/[...path]/route");
    assert.equal((await catchAll.GET(req,{params:Promise.resolve({path:["..","secret"]})})).status,400);
    const logout = await import("./src/app/api/v1/auth/logout/route");
    assert.match((await logout.POST()).headers.get("set-cookie")!,/Max-Age=0/i);
  } finally { global.fetch = original; }
  console.log("PASS: production proxy, cookie auth, OAuth redirects, fail-closed behavior and logout");
}
run().catch((error)=>{console.error(error);process.exitCode=1;});
