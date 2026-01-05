/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverComponentsExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/app/api/export/pdf/route": ["./node_modules/@sparticuz/chromium/**"],
    "app/api/export/pdf/route.ts": ["./node_modules/@sparticuz/chromium/**"]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb"
    }
  }
};

export default nextConfig;
