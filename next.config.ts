import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@meavo/navigation"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Keep Cyrillic-capable fonts available to serverless PDF routes.
  outputFileTracingIncludes: {
    "/api/admin/panels-pdf": ["./src/lib/fonts/**/*"],
    "/api/stefan/panels-pdf": ["./src/lib/fonts/**/*"],
    "/api/cron/kaz-panel-slack": ["./src/lib/fonts/**/*"],
    "/api/cron/var-panel-slack": ["./src/lib/fonts/**/*"],
    "/api/cron/kaz-weekly-standard": ["./src/lib/fonts/**/*"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
