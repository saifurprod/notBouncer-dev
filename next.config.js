/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Zoom's in-client browser requires these security headers when serving
  // pages embedded via Home URL.
  async headers() {
    return [
      {
        source: "/zoom-home",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://appssdk.zoom.us",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://appssdk.zoom.us https://*.zoom.us wss://*.zoom.us",
              "img-src 'self' data: https://*.zoom.us",
              "frame-ancestors https://*.zoom.us",
            ].join("; "),
          },
        ],
      },
      {
        source: "/api/sidebar/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, x-zoom-app-context" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
