/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
  },
  // Optimize CSS and minify it in production
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Configure CSS optimization
  optimizeCss: true,
  experimental: {
    optimizeCss: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:5000/api/:path*', // Proxy to Flask backend using 127.0.0.1 instead of localhost
      },
    ]
  },
}

module.exports = nextConfig 