"use client"

import Image from 'next/image';

export default function Maintenance() {
    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-gray-900 to-black p-5">
            {/* Glassmorphism Card with Green Gradient */}
            <div className="relative bg-gradient-to-br from-green-400/20 via-emerald-500/10 to-teal-400/20 backdrop-blur-lg rounded-3xl px-10 py-16 max-w-2xl w-full shadow-2xl text-center border border-green-300/30 overflow-hidden">
                {/* Gradient overlay for extra depth */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-green-300/5 to-transparent"></div>

                {/* Logo at top left */}
                <div className="absolute top-3 left-4 z-20">
                    <Image
                        src="/Gradus.png"
                        alt="Gradus Logo"
                        width={120}
                        height={40}
                        priority
                        className="object-contain drop-shadow-lg"
                    />
                </div>

                <div className="relative z-10">
                    <div className="mb-8 flex justify-center">
                        <Image
                            src="/Working.png"
                            alt="Under Maintenance"
                            width={200}
                            height={200}
                            priority
                            className="object-contain drop-shadow-2xl"
                        />
                    </div>

                    <h1 className="text-5xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
                        🚧 We&apos;re Under Maintenance
                    </h1>

                    <p className="text-xl text-gray-200 mb-8 leading-relaxed">
                        We&apos;re currently updating our platform to serve you better.
                        We&apos;ll be back online shortly!
                    </p>

                    <div className="flex justify-center gap-3 mt-10">
                        <div className="w-3 h-3 rounded-full bg-green-300 shadow-lg shadow-green-300/50 animate-pulse"></div>
                        <div className="w-3 h-3 rounded-full bg-green-400 shadow-lg shadow-green-400/50 animate-pulse delay-200"></div>
                        <div className="w-3 h-3 rounded-full bg-green-300 shadow-lg shadow-green-300/50 animate-pulse delay-400"></div>
                    </div>

                    <p className="text-base text-gray-300 mt-8">
                        Thank you for your patience! 💚
                    </p>
                </div>
            </div>

            <style jsx>{`
        .delay-200 {
          animation-delay: 0.2s;
        }
        .delay-400 {
          animation-delay: 0.4s;
        }
      `}</style>
        </div>
    );
}