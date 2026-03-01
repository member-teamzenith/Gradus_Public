import React from 'react'
import { CheckCircle, Sparkles, Waves } from 'lucide-react'
import Image from 'next/image'

const CongratsPopUp = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-darkBlueGray rounded-2xl p-8 max-w-lg mx-4 relative overflow-hidden border border-green-500/20">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-400/5"></div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="relative z-10 text-center">
          {/* Wave image with floating elements */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-32 h-32 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500/40 animate-pulse">
                <Image
                  src="/Wave.png"
                  alt="Learning Wave"
                  width={80}
                  height={80}
                  className="rounded-full"
                />
              </div>
              <CheckCircle className="w-6 h-6 text-green-400 absolute -top-2 -right-2 animate-bounce" />
              <Sparkles className="w-5 h-5 text-yellow-400 absolute -bottom-1 -left-1 animate-pulse" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-white mb-4">
            🌊 Welcome to the Learning Wave!
          </h2>

          {/* Message */}
          <p className="text-gray-300 text-lg mb-4 leading-relaxed">
            Your profile is now complete! You&apos;re ready to ride the wave of knowledge and unlock your full potential.
          </p>

          {/* Additional motivational text */}
          <p className="text-green-400 text-sm mb-6 font-medium">
            ✨ Every great journey begins with a single step. Let&apos;s make yours extraordinary! ✨
          </p>

          {/* Action button */}
          <button
            onClick={onClose}
            className="w-full bg-green-400 hover:bg-green-500 text-black font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-green-400/40 transition-all duration-300 flex items-center justify-center cursor-pointer"
          >
            <Waves className="w-5 h-5 mr-2" />
            Ride the Learning Wave!
          </button>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-2 left-2 w-4 h-4 bg-green-500/30 rounded-full animate-ping"></div>
        <div className="absolute bottom-4 right-4 w-3 h-3 bg-green-400/40 rounded-full animate-pulse"></div>
        <div className="absolute top-1/2 left-2 w-2 h-2 bg-green-300/50 rounded-full animate-bounce"></div>
        
        {/* Spinning ring around the wave */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-2 border-green-500/20 rounded-full animate-spin" style={{ animationDuration: '8s' }}></div>
      </div>
    </div>
  )
}

export default CongratsPopUp