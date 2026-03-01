"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";

const MobileDetector = ({ children }) => {
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent || "";

    // Mobile detection
    const isMobile = /android.*mobile|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent
    );

    // Tablet detection
    const isTablet =
      /ipad|android(?!.*mobile)|tablet|kindle|silk|playbook|bb10/i.test(
        userAgent
      ) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPad on iPadOS

    // Block if mobile or tablet
    setIsBlocked(isMobile || isTablet);
  }, []);

  if (isBlocked) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50 p-4">
        <div className="bg-darkBlueGray rounded-2xl p-8 max-w-lg mx-4 text-center relative overflow-hidden border border-green-500/20">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-400/5"></div>
          <div className="relative z-10">
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="w-40 h-40 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500/40 animate-pulse">
                  <Image
                    src="/Working.png"
                    alt="Working on it"
                    width={120}
                    height={120}
                    className="rounded-full"
                  />
                </div>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-6">
              📱 Tablet/Mobile Detected
            </h2>
            <div className="text-gray-300 text-lg mb-8 leading-relaxed">
              <p className="mb-4">
                This application is optimized for{" "}
                <strong className="text-green-400">
                  laptops and desktop computers
                </strong>{" "}
                only.
              </p>
              <p className="text-sm text-gray-400">
                Please use a laptop or desktop computer for the best experience.
                Tablets and mobile devices are not supported.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default MobileDetector;
