/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Cloud Run 배포를 위한 standalone 출력
  output: 'standalone',
}

export default nextConfig
