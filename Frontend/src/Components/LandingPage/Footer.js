"use client"

import React from 'react'
import { motion } from 'motion/react'
import { FaInstagram, FaLinkedin } from 'react-icons/fa'
import { FaXTwitter } from 'react-icons/fa6'

const Footer = () => {
  return (
    <footer className='bg-black border-t border-gray-800 py-5 xl:py-10 px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 font-questrial' style={{ fontFamily: 'Questrial, sans-serif' }}>
      <div className='max-w-[1920px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8 xl:gap-16 text-center md:text-left'>
        {/* Contact Us Section */}
        <motion.div
          className='space-y-2 xl:space-y-4'
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h3 className='text-base sm:text-lg xl:text-3xl font-bold text-green-300'>Contact Us</h3>
          <a 
            href="mailto:team@gradus-zenith.tech" 
            className='text-xs sm:text-sm xl:text-xl text-white hover:text-green-300 transition-colors duration-300 block'
          >
            team@gradus-zenith.tech
          </a>
        </motion.div>

        {/* Phone Section */}
        <motion.div
          className='space-y-2 xl:space-y-4'
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <h3 className='text-base sm:text-lg xl:text-3xl font-bold text-green-300'>Phone</h3>
          <a 
            href="tel:+919021882342" 
            className='text-xs sm:text-sm xl:text-xl text-white hover:text-green-300 transition-colors duration-300 block'
          >
            9021882342
          </a>
        </motion.div>

        {/* Follow Us Section */}
        <motion.div
          className='space-y-2 xl:space-y-4'
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <h3 className='text-base sm:text-lg xl:text-3xl font-bold text-green-300'>Follow Us</h3>
          <div className='flex gap-3 xl:gap-8 justify-center md:justify-start'>
            <a 
              href="https://www.instagram.com/gradus_zenith?igsh=aTg1NW41OWltaTcx" 
              target="_blank"
              rel="noopener noreferrer"
              className='text-white hover:text-green-300 transition-colors duration-300'
              aria-label="Instagram"
            >
              <FaInstagram className='w-5 h-5 xl:w-9 xl:h-9' />
            </a>
            <a 
              href="https://www.linkedin.com/company/gradus-zenith/" 
              target="_blank"
              rel="noopener noreferrer"
              className='text-white hover:text-green-300 transition-colors duration-300'
              aria-label="LinkedIn"
            >
              <FaLinkedin className='w-5 h-5 xl:w-9 xl:h-9' />
            </a>
            <a 
              href="https://x.com/Gradus_Zenith" 
              target="_blank"
              rel="noopener noreferrer"
              className='text-white hover:text-green-300 transition-colors duration-300'
              aria-label="X (Twitter)"
            >
              <FaXTwitter className='w-5 h-5 xl:w-9 xl:h-9' />
            </a>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}

export default Footer