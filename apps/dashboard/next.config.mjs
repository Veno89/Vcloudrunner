/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['127.0.0.1.nip.io', 'localhost:3001']
    }
  }
};

export default nextConfig;
