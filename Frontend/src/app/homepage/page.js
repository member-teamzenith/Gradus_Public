'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import FirstPage from '@/Components/LandingPage/FirstPage'
import LandingNavbar from '@/Components/LandingPage/Navbar'
import FeedbackPage from '@/Components/LandingPage/FeedbackPage'
import HowToUse from '@/Components/LandingPage/HowToUse'
import UserBase from '@/Components/LandingPage/UserBase'
import Outro from '@/Components/LandingPage/Outro'
import Footer from '@/Components/LandingPage/Footer'
import ScrollToTop from '@/Components/LandingPage/ScrollToTop'

const page = () => {
  const router = useRouter()
  const user = useSelector((state) => state?.user?.user)

  // Redirect logged-in users to /home/welcome
  useEffect(() => {
    if (user) {
      router.push('/home/welcome')
    }
  }, [user, router])

  return (
    <div>
        <LandingNavbar/>
        <FirstPage/>
        <FeedbackPage/>
        <HowToUse/>
        <UserBase/>
        <Outro/>
        <Footer/>
        <ScrollToTop/>
    </div>
  )
}

export default page