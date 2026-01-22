/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Vercel에서는 standalone 출력을 사용하지 않음
  // Cloud Run 배포 시에만 필요하면 환경 변수로 제어
  ...(process.env.CLOUD_RUN_DEPLOY === 'true' && { output: 'standalone' }),
}

export default nextConfig
