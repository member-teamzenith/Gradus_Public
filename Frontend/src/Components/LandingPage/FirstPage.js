"use client"

import React from 'react'
import Image from 'next/image'
import { motion } from 'motion/react'

const FirstPage = () => {
  const scrollToNext = () => {
    const howToUseSection = document.getElementById('how-to-use');
    if (howToUseSection) {
      howToUseSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  return (
    <div className='relative min-h-screen bg-black flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-24 py-20 font-questrial' style={{ fontFamily: 'Questrial, sans-serif' }}>
      <div className='max-w-[1920px] w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16 2xl:gap-24 items-center'>
        {/* Left Side - Text Content */}
        <div className='space-y-6 lg:space-y-8'>
          <motion.h1 
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className='text-green-300 text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-9xl font-bold'
          >
            Gradus
          </motion.h1>
          
          <motion.h2 
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.8 }}
            className='text-green-300 text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-6xl font-semibold whitespace-nowrap'
          >
            Turn Videos into real learning
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 1.2 }}
            className='text-white text-xs sm:text-sm md:text-base lg:text-lg xl:text-3xl leading-relaxed'
          >
            Gradus Transforms unstructured educational videos into guided interactive learning experience - personalizes around how you learn
          </motion.p>
        </div>

        {/* Right Side - Image */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.8 }}
          className='flex justify-center lg:justify-end'
        >
          <div className='relative w-full max-w-md lg:max-w-lg xl:max-w-xl'>
            <Image 
              src='/landingPage.png' 
              alt='Gradus Learning Platform' 
              width={800}
              height={800}
              className='w-full h-auto object-contain'
              priority
            />
          </div>
        </motion.div>
      </div>

      {/* See How Button */}
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 1.6 }}
        className='absolute bottom-8 left-1/2 transform -translate-x-1/2'
      >
        <button
          onClick={scrollToNext}
          className='bg-green-300 text-black px-3 py-1.5 rounded-full font-semibold cursor-pointer hover:bg-green-400 transition-colors duration-200 text-xs sm:text-xs md:text-sm xl:text-xl xl:px-8 xl:py-4'
        >
          See How
        </button>
      </motion.div>
    </div>
  )
}

export default FirstPage