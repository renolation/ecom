import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // typedRoutes is deliberately off: routes come from the `nav_items` table and every
  // href is built at runtime, so compile-time route literals cannot be checked.
}

export default nextConfig
