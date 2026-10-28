import type { NextConfig } from "next";

// Security headers (OWASP A05): applied to every route.
// CSP notes: Next.js requires inline bootstrap/hydration scripts, so
// script-src keeps 'unsafe-inline'; everything else is locked to 'self'
// (blob:/data: only where the PDF/image pipeline needs it).
// Framing: the app is shown inside the z.ai preview iframe, so
// frame-ancestors whitelists the preview hosts instead of 'none'.
// X-Frame-Options is omitted on purpose (no multi-origin support;
// frame-ancestors below governs framing in all modern browsers).
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "media-src 'self' blob:",
      "font-src 'self' data:",
      "connect-src 'self' blob:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self' https://*.z.ai https://z.ai https://*.space-z.ai http://localhost:* https://localhost:*",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // pdfjs-dist ships a worker + node build that must stay outside the bundler
  serverExternalPackages: ["pdfjs-dist"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
