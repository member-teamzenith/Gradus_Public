
"use client"

import React from 'react'
import { motion } from 'motion/react'

const UserBase = () => {
  return (
    <div className='min-h-screen bg-black flex items-center px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-24 py-20 font-questrial' style={{ fontFamily: 'Questrial, sans-serif' }}>
      <div className='w-full max-w-[1920px] mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 xl:gap-20 2xl:gap-24 items-center'>
        {/* Left Side - Text Content */}
        <div className='space-y-5 xl:space-y-10'>
          {/* Main Heading */}
          <motion.h2
            className='text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-7xl font-bold text-white leading-tight'
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            Who Gradus is for
          </motion.h2>

          {/* Subtitle */}
          <motion.p
            className='text-sm sm:text-base md:text-lg xl:text-4xl text-green-300 leading-relaxed'
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            Designed to support different learning goals — without forcing everyone into the same path.
          </motion.p>

          {/* Free Access Card */}
          <motion.div
            className='bg-white rounded-3xl p-4 sm:p-6 xl:p-12 shadow-2xl'
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <h3 className='text-base sm:text-lg xl:text-3xl font-bold text-black mb-2 xl:mb-6'>
              Free during early access
            </h3>
            <p className='text-xs sm:text-sm xl:text-xl text-black leading-relaxed'>
              Gradus is free to use for the next 6 months while we continue improving with real learners.
            </p>
          </motion.div>
        </div>

        {/* Right Side - User Type Cards */}
        <div className='space-y-4 xl:space-y-8'>
          {/* Students Card */}
          <motion.div
            className='bg-green-300 rounded-3xl p-4 sm:p-6 xl:p-12 shadow-2xl'
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <div className='flex items-center gap-2 xl:gap-4 mb-2 xl:mb-6'>
              <span className='text-xl xl:text-4xl'>🎓</span>
              <h3 className='text-base sm:text-lg xl:text-3xl font-bold text-black'>
                Students
              </h3>
            </div>
            <p className='text-xs sm:text-sm xl:text-xl text-black leading-relaxed'>
              Understand concepts deeply, prepare for exams with confidence, and revise without stress.
            </p>
            <p className='text-xs sm:text-sm xl:text-xl text-black leading-relaxed mt-2 xl:mt-5'>
              Gradus helps you stay organized, test your understanding, and focus on what actually matters — so learning feels structured, not overwhelming.
            </p>
          </motion.div>

          {/* Self-learners Card */}
          <motion.div
            className='bg-green-300 rounded-3xl p-4 sm:p-6 xl:p-12 shadow-2xl'
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            viewport={{ once: true }}
          >
            <div className='flex items-center gap-2 xl:gap-4 mb-2 xl:mb-6'>
              <span className='text-xl xl:text-4xl'>🚀</span>
              <h3 className='text-base sm:text-lg xl:text-3xl font-bold text-black'>
                Self-learners
              </h3>
            </div>
            <p className='text-xs sm:text-sm xl:text-xl text-black leading-relaxed'>
              Learn new skills without getting lost in endless tutorials.
            </p>
            <p className='text-xs sm:text-sm xl:text-xl text-black leading-relaxed mt-2 xl:mt-5'>
              Gradus turns scattered videos into guided learning flows, helping you stay focused, track progress, and build real understanding over time.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default UserBase