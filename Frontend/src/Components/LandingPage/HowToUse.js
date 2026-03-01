"use client"

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const HowToUse = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const [showIndicator, setShowIndicator] = useState(false)
  const containerRef = useRef(null)

  const steps = [
    {
      number: 1,
      title: "Start with what you want to learn",
      description: [
        "You begin with a topic, subject, or even a single video.",
        "Gradus organizes learning around your goal - not around random recommendations.",
        "Whether you're revising a concept or exploring something new, you always know where to start."
      ],
      videoSrc: "/videos/HomeSearch.mp4"
    },
    {
      number: 2,
      title: "Learn actively, not passively",
      description: [
        "Videos open in an interactive learning mode designed for understanding.",
        "You get clear summaries,key points,and the ability to ask questions exactly when confusion hits.",
        "Learning happens while you watch - not after"
      ],
      videoSrc: "/videos/SummaryChatbot.mp4"
    },
    {
      number: 3,
      title: "Check your understanding as you go",
      description: [
        "Gradus helps you test what you've actually understood.",
        "Short quizzes reveal gaps early and prevent false confidence.",
        "You don't move forward guessing-you move forward knowing."
      ],
      videoSrc: "/videos/Quiz.mp4"
    },
    {
      number: 4,
      title: "Build structure automatically",
      description: [
        "As you learn,Gradus connects concepts and builds a structure path forward",
        "It recommends what to learn next based on your level,goals,and understanding",
        "Your learning stays guided-without feeling rigid."
      ],
      videoSrc: "/videos/Recommendations.mp4"
    },
    {
      number: 5,
      title: "Revise faster,remember longer",
      description: [
        "Everything you learn stays connected and easy to find",
        "Summaries,notes and watched videos are organized for instant access",
        "Just decide what you remember-Gradus takes you to the exact moment"
      ],
      videoSrc: "/videos/Revision.mp4"
    },
    {
      number: 6,
      title: "Track progress and stay consistent",
      description: [
        "Gradus shows your learning clearly over time",
        "Daily acctivity streaks , and insights helps you build momemtum without pressure",
        "Consistency stops being a struggle-it becomes visible"
      ],
      videoSrc: "/videos/Profile.mp4"
    }
  ]

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const containerHeight = rect.height
        
        // Show indicator only when section is in viewport
        if (rect.top < viewportHeight && rect.bottom > 0) {
          setShowIndicator(true)
        } else {
          setShowIndicator(false)
        }
        
        // Only start when section top is at or above viewport top (trigger earlier)
        if (rect.top > 250) {
          // Not yet fully in the section - stay at step 0
          setCurrentStep(0)
          return
        }
        
        if (rect.bottom < viewportHeight) {
          // Scrolled past the section - stay at last step
          setCurrentStep(steps.length - 1)
          return
        }
        
        // Calculate scroll progress within the section
        // Start counting from when section top reaches top of viewport
        const sectionScrolled = Math.abs(rect.top - 250)
        const scrollableHeight = containerHeight - viewportHeight
        const scrollProgress = Math.max(0, Math.min(1, sectionScrolled / scrollableHeight))
        
        // Calculate which step should be shown
        const stepIndex = Math.min(
          Math.floor(scrollProgress * steps.length),
          steps.length - 1
        )
        
        setCurrentStep(stepIndex)
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Initial check
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [steps.length])

  return (
    <div 
      id="how-to-use"
      ref={containerRef}
      className='min-h-[400vh] bg-black flex flex-col items-center px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-24 py-20 font-questrial' 
      style={{ fontFamily: 'Questrial, sans-serif' }}
    >
      {/* Sticky Container with Heading */}
      <div className='sticky top-20 w-full max-w-[1920px] flex flex-col items-center'>
        {/* Heading */}
        <motion.h2
          className='text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-7xl font-bold text-white text-center mb-10 xl:mb-20'
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          How Gradus works
        </motion.h2>

        {/* Step Content */}
        {/* Step Content */}
        <AnimatePresence mode='wait'>
          <motion.div
            key={currentStep}
            className='grid lg:grid-cols-2 gap-8 lg:gap-16 items-center'
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            {/* Text Content */}
            <div className='space-y-3 xl:space-y-8'>
              <div className='flex items-center gap-2 xl:gap-6'>
                <div className='w-10 h-10 xl:w-20 xl:h-20 rounded-full bg-green-300 flex items-center justify-center'>
                  <span className='text-base xl:text-4xl font-bold text-black'>{steps[currentStep].number}</span>
                </div>
                <h3 className='text-base sm:text-lg lg:text-xl xl:text-5xl font-bold text-white'>
                  {steps[currentStep].title}
                </h3>
              </div>
              
              <div className='space-y-2 xl:space-y-5'>
                {steps[currentStep].description.map((line, idx) => (
                  <p key={idx} className='text-xs sm:text-sm xl:text-xl text-gray-300 leading-relaxed'>
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {/* Video */}
            <div className='w-full aspect-video bg-gray-800 rounded-2xl overflow-hidden shadow-2xl'>
              <video 
                key={`video-${currentStep}`}
                src={steps[currentStep].videoSrc}
                loop
                autoPlay
                muted
                playsInline
                preload="metadata"
                className='w-full h-full object-cover'
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress Indicator */}
      {showIndicator && (
        <div className='fixed right-8 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-50'>
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                idx === currentStep 
                  ? 'bg-green-300 scale-125' 
                  : 'bg-gray-600 scale-100'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default HowToUse