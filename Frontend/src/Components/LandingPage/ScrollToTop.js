"use client"

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { FaArrowUp } from 'react-icons/fa'

const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.3 }}
          onClick={scrollToTop}
          className='fixed top-20 right-8 xl:top-24 xl:right-10 2xl:top-28 2xl:right-12 z-50 w-14 h-14 xl:w-16 xl:h-16 2xl:w-20 2xl:h-20 rounded-full bg-green-300 text-black flex items-center justify-center shadow-2xl hover:bg-green-400 transition-all duration-300 hover:scale-110'
          aria-label="Scroll to top"
        >
          <FaArrowUp className='w-6 h-6 xl:w-7 xl:h-7 2xl:w-9 2xl:h-9' />
        </motion.button>
      )}
    </AnimatePresence>
  )
}

export default ScrollToTop
