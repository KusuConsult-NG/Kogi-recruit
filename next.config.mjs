/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ['bcryptjs', 'pdfkit', 'exceljs', 'nodemailer'],
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
};
export default nextConfig;
