"use client"

import React from 'react'
import { motion } from 'motion/react'
import Link from 'next/link'
import Image from 'next/image'

const Outro = () => {
  return (
    <div className='min-h-screen bg-black flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-24 py-20 font-questrial' style={{ fontFamily: 'Questrial, sans-serif' }}>
      <div className='w-full max-w-[1920px] mx-auto grid lg:grid-cols-2 gap-6 lg:gap-10 xl:gap-20 items-center mb-10 xl:mb-20'>
        {/* Left Side - Text Content */}
        <div className='space-y-3 xl:space-y-8'>
          {/* Main Heading */}
          <motion.h2
            className='text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-7xl font-bold text-white leading-tight'
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            Learn in a way that adapts to you
          </motion.h2>

          {/* Green Text Paragraphs */}
          <motion.div
            className='space-y-2 xl:space-y-5 text-sm sm:text-base md:text-lg xl:text-4xl text-green-300 leading-relaxed'
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <p>Gradus learns how you learn.</p>
            <p>With every video, quiz, and revision, your learning experience becomes more personalized.</p>
            <p>You're not following a system.</p>
            <p className='font-bold'>The system follows you.</p>
          </motion.div>
        </div>

        {/* Right Side - Illustration */}
        <motion.div
          className='flex items-center justify-center'
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <div className='w-full max-w-2xl xl:max-w-3xl aspect-square flex items-center justify-center'>
            <Image
              src="/Wave.png"
              alt="Bird with books illustration"
              width={900}
              height={900}
              className='w-full h-full object-contain'
            />
          </div>
        </motion.div>
      </div>

      {/* Start Learning Button */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        viewport={{ once: true }}
      >
        <Link href="/auth/login">
          <button className='bg-green-300 text-black text-sm sm:text-base xl:text-2xl font-bold px-5 py-2.5 xl:px-14 xl:py-5 rounded-full hover:bg-green-400 transition-all duration-300 shadow-2xl hover:scale-105'>
            Start Learning
          </button>
        </Link>
      </motion.div>
    </div>
  )
}

export default Outro
