/** @type {import('next').NextConfig} */
const nextConfig = {
  // The marketing landing page is a static file in public/
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/index.html" }] };
  },
};

export default nextConfig;
