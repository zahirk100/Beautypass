/** @type {import('next').NextConfig} */
const nextConfig = {
  // The marketing landing page is a static file in public/
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/index.html" }] };
  },
  // Salon photos are resized in the browser first; this leaves room for one photo per request
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
};

export default nextConfig;
