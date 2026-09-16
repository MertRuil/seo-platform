/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  // Docker imaji .next/standalone bekliyor. Vercel kendi ciktisini urettigi
  // icin bu yalnizca Dockerfile.web'de (DOCKER_BUILD=1) acilir.
  output: process.env.DOCKER_BUILD ? "standalone" : undefined,
  // Proje kurallari .agents/rules altinda; Next'in AGENTS.md/CLAUDE.md uretmesi kapali
  agentRules: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
