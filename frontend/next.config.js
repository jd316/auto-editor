/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
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