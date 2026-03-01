"use client"

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'

const FeedbackPage = () => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)

  const feedbacks = [
    {
      id: 1,
      name: "Deepk",
      role: "IIT Madras",
      feedback: "Gradus is still early, but the direction is spot on. Even now, it feels far more learning oriented than how I used to study from videos",
      rating: 5
    },
    {
      id: 2,
      name: "Shantanu",
      role: "NU-San Jose",
      feedback: "Having AI assistant right inside the video made a huge difference. I could ask question the moment something didn't make sense , without losing focus.",
      rating: 5
    },
    {
      id: 3,
      name: "Nilanshu",
      role: "VJTI-Mumbai",
      feedback: "I used to keep jumping between videos and never finish anything. Gradus helped me break out of that and follow a proper learning path.",
      rating: 5
    },
    {
      id: 4,
      name: "Trishit",
      role: "PICT-Pune",
      feedback: "I've tried learning from videos before,but I never stayed consistent. Gradus made it easier to come back and continue.",
      rating: 5
    },
    {
      id: 5,
      name: "Shital",
      role: "The U",
      feedback: "I wasn't expecting it to feel this persnonal. The recommendations matched my level way better than I thought they would.",
      rating: 5
    },
    {
      id: 6,
      name: "Yashasvi",
      role: "Cummins-Pune",
      feedback: "What I liked most was that it didn't overwhelm me. It just showed me what to watch next and helped me understand it better.",
      rating: 5
    },
    {
      id: 7,
      name: "Surbhi",
      role: "DKET-Kolhapur",
      feedback: "It feels less like watching videos and more like folowing a learning flow. That alone make a big difference for me.",
      rating: 5
    },
    {
      id: 8,
      name: "Krisha",
      role: "JEE-Bakliwal",
      feedback: "I usually forgot where I learned something. With Gradus,I could go back and find the exact part of the video again.",
      rating: 5
    },
    {
      id: 9,
      name: "Kedar",
      role: "VIT-Pune",
      feedback: "The quizzes actually helped me figure out what I didn't undestand instead of just testing random facts.",
      rating: 5
    }
  ]

  const getVisibleCards = () => {
    const prevIndex = (currentIndex - 1 + feedbacks.length) % feedbacks.length
    const nextIndex = (currentIndex + 1) % feedbacks.length
    return [prevIndex, currentIndex, nextIndex]
  }

  const nextSlide = () => {
    setDirection(1)
    setCurrentIndex((prev) => (prev + 1) % feedbacks.length)
  }

  const prevSlide = () => {
    setDirection(-1)
    setCurrentIndex((prev) => (prev - 1 + feedbacks.length) % feedbacks.length)
  }

  // Auto-rotate carousel every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide()
    }, 3000)

    return () => clearInterval(interval)
  }, [currentIndex])

  return (
    <div className='min-h-[60vh] bg-black flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-24 py-12 xl:py-16 2xl:py-20 font-questrial' style={{ fontFamily: 'Questrial, sans-serif' }}>
      {/* Title */}
      <motion.h2 
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className='text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-7xl font-bold text-center mb-5 lg:mb-8 xl:mb-16'
      >
        <span className='text-green-300'>Real Feedback.</span>{' '}
        <span className='text-white'>Real Learning</span>
      </motion.h2>

      {/* Carousel Container */}
      <div className='w-full max-w-[1920px] relative px-12 sm:px-16 md:px-20 xl:px-24'>
        <div className='overflow-hidden relative'>
          <div className='flex items-center justify-center gap-4'>
            {getVisibleCards().map((index, position) => {
              const isCenter = position === 1
              return (
                <motion.div
                  key={feedbacks[index].id}
                  layout
                  animate={{ 
                    opacity: isCenter ? 1 : 0.3, 
                    scale: isCenter ? 1 : 0.85,
                  }}
                  transition={{ 
                    duration: 0.8, 
                    ease: [0.4, 0.0, 0.2, 1],
                    layout: { duration: 0.8 }
                  }}
                  className={`${
                    isCenter ? 'w-full max-w-[1920px] h-28 sm:h-32 md:h-40 xl:h-64' : 'w-full max-w-6xl h-24 sm:h-28 md:h-32 xl:h-56 hidden lg:block'
                  } bg-green-300 border-2 border-green-400 rounded-3xl p-2 sm:p-4 md:p-5 xl:p-10 shadow-2xl flex flex-col justify-between`}
                  style={{ 
                    pointerEvents: isCenter ? 'auto' : 'none',
                    filter: isCenter ? 'none' : 'blur(2px)'
                  }}
                >
                {/* Feedback Text */}
                <p className={`text-black ${isCenter ? 'text-[10px] sm:text-xs md:text-sm xl:text-xl' : 'text-[9px] sm:text-[10px] md:text-xs xl:text-lg'} text-center mb-1 leading-snug flex-grow flex items-center justify-center`}>
                  "{feedbacks[index].feedback}"
                </p>

                {/* User Info */}
                <div className='text-right'>
                  <p className={`text-black font-bold ${isCenter ? 'text-[10px] sm:text-xs md:text-sm xl:text-xl' : 'text-[9px] sm:text-[10px] md:text-xs xl:text-lg'}`}>
                    {feedbacks[index].name}, {feedbacks[index].role}
                  </p>
                </div>
              </motion.div>
            )
          })}
          </div>
        </div>
      </div>

      {/* Learners from leading universities */}
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
        className='mt-16 sm:mt-20 md:mt-24 xl:mt-28 2xl:mt-32 w-full max-w-[1920px]'
      >
        <h3 className='text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-semibold text-white text-center mb-8 sm:mb-10 md:mb-12 xl:mb-16 2xl:mb-20'>
          Learners from leading universities
        </h3>
        
        {/* University Circles */}
        <div className='flex items-center justify-center gap-6 sm:gap-8 md:gap-10 lg:gap-12 xl:gap-14 2xl:gap-16 flex-wrap px-4'>
          {[
            { name: 'VIT', src: '/vit.png' },
            { name: 'COEP', src: '/COEP.jpg' },
            { name: 'NU', src: '/NU.png' },
            { name: 'UTA', src: '/Uta.png' },
            { name: 'IIT Madras', src: '/IITM.jpg' },
            { name: 'IIIT Nagpur', src: '/IIITN.png' },
            { name: 'VJTI', src: '/VJTI.jpg' }
          ].map((university, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, ease: "easeOut", delay: index * 0.1 }}
              className='w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 xl:w-44 xl:h-44 2xl:w-52 2xl:h-52 rounded-full bg-white border-2 xl:border-3 2xl:border-4 border-green-300 flex items-center justify-center shadow-lg overflow-hidden p-2 xl:p-3 2xl:p-4'
            >
              <Image 
                src={university.src} 
                alt={university.name}
                width={112}
                height={112}
                className='w-full h-full object-contain'
              />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export default FeedbackPage