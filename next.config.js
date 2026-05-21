/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // 保持严格模式,帮助发现潜在问题
  swcMinify: false, // 禁用SWC压缩，避免二进制加载问题
}

module.exports = nextConfig
