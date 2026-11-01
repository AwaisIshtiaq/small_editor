import type { NextConfig } from "next";

// Security headers (OWASP A05): applied to every route.
// CSP notes: Next.js requires inline bootstrap/hydration scripts, so
// script-src keeps 'unsafe-inline'; everything else is locked to 'self'
// (blob:/data: only where the PDF/image pipeline needs it).
// frame-ancestors is open ('*'): the sandbox preview is embedded by the
// chat platform UI whose origin we cannot enumerate from here (z.ai /
// chatglm.cn family). The app is a stateless client-side PDF tool demo
// with no authenticated actions, so clickjacking risk is negligible.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "media-src 'self' blob:",
      "font-src 'self' data:",
      "connect-src 'self' blob:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors *",
    ].join("; "),
  },
  // X-Frame-Options intentionally omitted: CSP frame-ancestors above is the
  // modern mechanism and DENY would also block the preview gateway iframe.
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
