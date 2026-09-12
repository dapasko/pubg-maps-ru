import type { NextConfig } from 'next';

// GitHub Pages serves this project beneath the repository name rather than
// at the domain root. Keeping it configurable also leaves local previews at /.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  assetPrefix: basePath || undefined,
};

export default nextConfig;
