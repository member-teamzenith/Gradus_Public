import { withNextVideo } from "next-video/process";
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  compiler: {
    styledComponents: true,
  },
  images: {
    domains: ['i.ytimg.com', 'img.youtube.com', 'api.dicebear.com'],
  },
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || "https://gradus-backend.onrender.com",
    NEXT_PUBLIC_PYTHON_URL: process.env.NEXT_PUBLIC_PYTHON_URL || "http://localhost:8000",
    NEXT_PUBLIC_CHATBOT_URL: process.env.NEXT_PUBLIC_CHATBOT_URL || "http://localhost:8500",
    NEXT_PUBLIC_EXTENSION_ID: process.env.NEXT_PUBLIC_EXTENSION_ID,
  }
};

export default withNextVideo(nextConfig);