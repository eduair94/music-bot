import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // Tree-shake barrel imports so a single icon does not pull the whole pack.
    optimizePackageImports: ['react-icons', 'react-icons/fa', 'lucide-react'],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  // Set the workspace root to this directory
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
