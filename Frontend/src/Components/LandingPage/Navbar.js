"use client"

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSelector, useDispatch } from 'react-redux'

const LandingNavbar = () => {
  const router = useRouter()
  const dispatch = useDispatch()
  const profileRef = useRef(null)
  
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [canShowProfile, setCanShowProfile] = useState(false)
  const [profilePhoto, setProfilePhoto] = useState('')
  const [profileName, setProfileName] = useState('')
  const [initials, setInitials] = useState('')

  // Get user data from Redux store if available
  const user = useSelector((state) => state?.user?.user)

  // Redirect logged-in users to /home/welcome
  useEffect(() => {
    if (user) {
      router.push('/home/welcome')
    }
  }, [user, router])

  useEffect(() => {
    if (user) {
      setCanShowProfile(true)
      setProfilePhoto(user.profilePhoto || user.photoURL || '')
      setProfileName(user.displayName || user.name || '')
      
      // Generate initials
      const name = user.displayName || user.name || ''
      const nameParts = name.trim().split(' ')
      const userInitials = nameParts.length > 1 
        ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
        : name.substring(0, 2).toUpperCase()
      setInitials(userInitials)
    } else {
      setCanShowProfile(false)
    }
  }, [user])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleProfile = () => {
    router.push('/profile')
    setIsProfileOpen(false)
  }

  const handleLogout = async () => {
    try {
      // Add your logout logic here (e.g., clear Redux state, call logout API)
      // dispatch(logoutUser())
      router.push('/auth/login')
      setIsProfileOpen(false)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <div>
        <nav className='border-b-2 pb-2 border-green-300 fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-2 sm:py-2.5 xl:py-5'>
            <img 
            className='w-16 h-4 sm:w-20 sm:h-5 md:w-24 md:h-6 lg:w-28 lg:h-7 xl:w-40 xl:h-10 object-cover'
            src='/Gradus.png' alt='logo' />
            {canShowProfile ? (
                <div className="relative" ref={profileRef}>
                    <div 
                        className="cursor-pointer" 
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                    >
                        {profilePhoto ? (
                            <img 
                                src={profilePhoto} 
                                alt="Profile" 
                                width={48} 
                                height={48} 
                                className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 xl:w-11 xl:h-11 rounded-full border-2 border-green-300 hover:border-green-400 transition-colors duration-200" 
                            />
                        ) : (
                            <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 xl:w-11 xl:h-11 rounded-full border-2 border-green-300 bg-gray-700 text-white flex items-center justify-center font-semibold text-[10px] xl:text-base">
                                {initials}
                            </div>
                        )}
                    </div>
                    
                    {/* Profile Dropdown */}
                    {isProfileOpen && canShowProfile && (
                        <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 xl:w-80 bg-gray-800 border border-green-300 rounded-lg shadow-xl z-50">
                            <div className="p-4 border-b border-gray-700">
                                <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                        {profilePhoto ? (
                                            <img 
                                                src={profilePhoto} 
                                                alt="Profile" 
                                                width={40} 
                                                height={40} 
                                                className="w-10 h-10 rounded-full" 
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gray-700 text-white flex items-center justify-center font-semibold">
                                                {initials}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white font-medium text-sm sm:text-base truncate">
                                            {profileName || 'User'}
                                        </div>
                                        <div 
                                            className="text-green-300 text-xs sm:text-sm cursor-pointer hover:text-green-400 transition-colors duration-200"
                                            onClick={handleProfile}
                                        >
                                            View Your Profile
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-2">
                                <div 
                                    className="px-3 py-2 text-white text-sm sm:text-base font-medium cursor-pointer hover:bg-gray-700 rounded-md transition-colors duration-200"
                                    onClick={handleLogout}
                                >
                                    Log-out
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <Link href='/auth/login'>
                    <button className='bg-green-300 text-black px-2.5 py-1 sm:px-3 sm:py-1.5 md:px-3.5 md:py-1.5 xl:px-6 xl:py-3 rounded-full font-semibold cursor-pointer hover:bg-green-400 transition-colors duration-200 text-[10px] sm:text-xs md:text-xs xl:text-lg'>
                        Login
                    </button>
                </Link>
            )}
        </nav>
    </div>
  )
}

export default LandingNavbar