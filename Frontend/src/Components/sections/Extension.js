"use client"


import React from 'react'
import { useState, useEffect, useRef } from "react";
import {motion, useInView} from 'motion/react'
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/Firebase';
import { fetchUserDetails } from '@/services/userServices';

const Extension = () => {

    const [blur, setBlur] = useState(false);
    const [strike, setStrike] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [userDetails, setUserDetails] = useState(null);
    const router = useRouter();
    const profileRef = useRef(null);
    
    // Refs for scroll animations
    const launchGuideRef = useRef(null);
    const isInView = useInView(launchGuideRef, { once: true, margin: "-100px" });
    
    // State for back to top button
    const [showBackToTop, setShowBackToTop] = useState(false);

    useEffect(() => {
        // Trigger blur and strike at the same time, but later
        const blurTimer = setTimeout(() => {
          setBlur(true);
        }, 3500); // blur starts after Random Learning appears
        
        const strikeTimer = setTimeout(() => {
          setStrike(true);
        }, 3500); // strike happens at the same time as blur
        return () => {
          clearTimeout(blurTimer);
          clearTimeout(strikeTimer);
        };
    }, []);

    // Scroll listener for back to top button
    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY;
            const windowHeight = window.innerHeight;
            // Show button when scrolled past the first page (approximately 50% of viewport height)
            setShowBackToTop(scrollPosition > windowHeight * 0.5);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Auth state handling: verify email first, then onboarding status
    useEffect(() => {
        const handleAuth = async (user) => {
            if (!user) {
                setUserDetails(null);
                return;
            }

            // Refresh user to get latest verification status
            try { await user.reload(); } catch (_) {}

            if (!user.emailVerified) {
                const email = user.email || "";
                router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
                setUserDetails(null);
                return;
            }

            // Verified → check onboarding completion
            try {
                const result = await fetchUserDetails(user.uid);
                const data = result?.data || result;
                setUserDetails(data);
                const personalFlag = (data?.personalDetailsAdded !== undefined)
                    ? data?.personalDetailsAdded
                    : data?.data?.personalDetailsAdded;
                    if (!personalFlag) {
                        router.push("/auth/onBoarding/personal-details?from=extension");
                    return;
                }
                // All set → go to home/search
                router.push('/home/welcome');
            } catch (error) {
                // If user record not found or other errors, remain on Extension page
                // and clear any stale user details
                setUserDetails(null);
                return;
            }
        };

        const unsubscribe = auth.onAuthStateChanged(handleAuth);
        return () => unsubscribe();
    }, [router]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };

        if (isProfileOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isProfileOpen]);

    const handleProfile = () => {
        router.push('/dashboard/profile');
    };

    const handleLogout = async () => {
        try {
            await auth.signOut();
            router.push("/homepage");
        } catch (error) {
            console.error("Error logging out:", error.message);
        }
    };

    // Function to scroll to top
    const scrollToTop = () => {
        // Try modern smooth scrolling first
        if ('scrollBehavior' in document.documentElement.style) {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        } else {
            // Fallback for older browsers
            const scrollStep = -window.scrollY / (500 / 15);
            const scrollInterval = setInterval(() => {
                if (window.scrollY !== 0) {
                    window.scrollBy(0, scrollStep);
                } else {
                    clearInterval(scrollInterval);
                }
            }, 15);
        }
    };

    // Function to scroll to Launch Guide section
    const scrollToLaunchGuide = () => {
        if (launchGuideRef.current) {
            launchGuideRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    };

    // Derive render-time flags for navbar
    const personalFlagRender = (userDetails?.personalDetailsAdded !== undefined)
        ? userDetails?.personalDetailsAdded
        : userDetails?.data?.personalDetailsAdded;
    const profilePhoto = userDetails?.photo || userDetails?.data?.photo || null;
    const profileName = userDetails?.name || userDetails?.data?.name || "";
    const initials = (profileName || 'U')
        .split(' ')
        .map((s) => s && s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();
    const canShowProfile = Boolean(userDetails && personalFlagRender);


  return (
    <div className='bg-[#100C08] font-questrial' style={{ fontFamily: 'Questrial, sans-serif' }}>
        <style jsx global>{`
            /* Hide scrollbar for the entire page */
            html, body {
                scrollbar-width: none; /* Firefox */
                -ms-overflow-style: none; /* Internet Explorer 10+ */
            }
            html::-webkit-scrollbar, body::-webkit-scrollbar {
                display: none; /* WebKit */
            }
        `}</style>
        <nav className='border-b-2 pb-2 border-green-300 fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 md:px-8 lg:px-12 py-3 sm:py-4'>
            <img 
            className='w-24 h-6 sm:w-28 sm:h-7 md:w-32 md:h-8 lg:w-36 lg:h-9 xl:w-40 xl:h-10 object-cover'
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
                                width={40} 
                                height={40} 
                                className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full border-2 border-green-300 hover:border-green-400 transition-colors duration-200" 
                            />
                        ) : (
                            <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full border-2 border-green-300 bg-gray-700 text-white flex items-center justify-center font-semibold">
                                {initials}
                            </div>
                        )}
                    </div>
                    
                    {/* Profile Dropdown */}
                    {isProfileOpen && canShowProfile && (
                        <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-gray-800 border border-green-300 rounded-lg shadow-xl z-50">
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
                    <button className='bg-green-300 text-black px-3 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-2.5 rounded-full font-semibold cursor-pointer hover:bg-green-400 transition-colors duration-200 text-xs sm:text-sm md:text-base'>
                        Login
                    </button>
                </Link>
            )}
        </nav>

        <div className='flex flex-col lg:flex-row justify-between h-auto lg:h-[40rem] w-full lg:w-[90%] mt-16 lg:mt-20 mx-auto lg:ml-20 pt-8 lg:pt-16 px-4 sm:px-6 md:px-8 lg:px-0'>
            {/* Text Content - Above on mobile, left on desktop */}
            <div className='mt-4 lg:mt-10 lg:ml-10 text-center lg:text-left'>
                <div className='text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl mb-3 lg:mb-5'>
                    <motion.span
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.5 }}
                        className="inline-block mr-2 text-green-300"
                    >Sync</motion.span>
                    <motion.span
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.7 }}
                        className="inline-block mr-2"
                    >by</motion.span>
                    <motion.span
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.9 }}
                        className="inline-block text-green-300"
                    >Gradus</motion.span>
                </div>
                <motion.p 
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: "easeOut" ,delay: 1.5}}
                    className='text-2xl sm:text-3xl md:text-4xl lg:text-5xl mb-3 lg:mb-5'>From
                </motion.p>
                <motion.div 
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: "easeOut", delay: 2 }}
                    className='text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl mb-3 lg:mb-5 relative inline-block'>
                    <motion.span 
                        animate={{ filter: blur ? "blur(3px)" : "blur(0px)" }}
                        transition={{ filter: { duration: 1.2, delay: 0, ease: "easeInOut" } }}
                    >Random Learning</motion.span>
                    <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: strike ? 1 : 0 }}
                        transition={{ duration: 1.2, delay: 0, ease: "easeInOut" }}
                        className="absolute top-1/2 left-0 w-full h-1 bg-red-500 origin-left rounded-full"
                        style={{ transform: 'translateY(-50%)' }}
                    />
                </motion.div>
                <div className='text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl mb-3 lg:mb-5'>
                    <motion.span
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 4.1 }}
                        className="inline-block mr-2"
                    >To</motion.span>
                    <motion.span
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 4.3 }}
                        className="inline-block mr-2"
                    >  Real</motion.span>
                    <motion.span
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 4.5 }}
                        className="inline-block"
                    >  Progress</motion.span>
                </div>
                <div className='flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start'>
                    <motion.a 
                        href={'https://chromewebstore.google.com/detail/gradus/bokpgjjcigbcpbbnilnajknlhgficppk?utm_source=item-share-cb'}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 5.1 }}
                        className='bg-green-300 text-black px-4 py-2 rounded-full font-semibold cursor-pointer text-sm sm:text-base'
                        aria-label='Add Gradus Extension from Chrome Web Store'
                    >Add Extension</motion.a>
                    <motion.button 
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 5.6 }}
                        onClick={scrollToLaunchGuide}
                        className='bg-green-300 text-black px-4 py-2 rounded-full font-semibold cursor-pointer hover:bg-green-400 transition-colors duration-200 text-sm sm:text-base'
                    >How To Use</motion.button>
                </div>
            </div>

            {/* Image - Below on mobile, right on desktop */}
            <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: "easeOut", delay: 1.5 }}
                className='mt-6 lg:mt-0 lg:mr-10 lg:relative lg:right-10 lg:bottom-20 lg:scale-120 flex justify-center lg:justify-end'>
                <img src='Joy.png' alt='Joy' className='w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-auto lg:h-auto max-w-full' />
            </motion.div>
        </div>



        <div className='min-h-[75rem] bg-[#100C08]' ref={launchGuideRef}>
            <div className='pt-12 sm:pt-16 lg:pt-20 px-4 sm:px-6 md:px-8 lg:px-20 lg:ml-10'>
                <div className='text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-8 sm:mb-12 lg:mb-18 text-center lg:text-left'>
                    <motion.span
                        initial={{ opacity: 0, y: 25 }}
                        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 25 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0 }}
                        className="inline-block mr-2"
                    >Launch</motion.span>
                    <motion.span
                        initial={{ opacity: 0, y: 25 }}
                        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 25 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                        className="inline-block text-green-300"
                    >Guide</motion.span>
                </div>
                <div className='grid grid-rows-3 gap-6 sm:gap-8'>
                    {/* First Guide Item */}
                    <motion.div 
                        className='min-h-[16rem] sm:min-h-[18rem] lg:min-h-[20rem] rounded-lg flex flex-col lg:flex-row items-center p-4 sm:p-6'
                        initial={{ opacity: 0, y: 50 }}
                        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.8 }}
                    >
                        {/* Image - Above on mobile, left on desktop */}
                        <motion.div 
                            className='flex-1 flex justify-center mb-4 lg:mb-0 lg:mr-6'
                            initial={{ opacity: 0, x: -100 }}
                            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -100 }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 1.0 }}
                        >
                            <img src='Launch_Guide_01.png' alt='Welcome' className='max-w-full max-h-48 sm:max-h-56 lg:max-h-full object-contain rounded-lg'/>
                        </motion.div>
                        {/* Text - Below on mobile, right on desktop */}
                        <motion.div 
                            className='flex-1 text-center lg:text-left'
                            initial={{ opacity: 0, x: 100 }}
                            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 100 }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 1.2 }}
                        >
                            <p className='text-xl sm:text-2xl lg:text-3xl font-semibold mb-2 sm:mb-4'>Activate The <span className='text-green-300'>Extension</span></p>
                            <p className='text-sm sm:text-base lg:text-xl'>Click the &quot;Add Extension&quot; button to install the Gradus extension in your browser.</p>
                        </motion.div>
                    </motion.div>

                    {/* Second Guide Item */}
                    <motion.div 
                        className='min-h-[16rem] sm:min-h-[18rem] lg:min-h-[20rem] rounded-lg flex flex-col lg:flex-row items-center p-4 sm:p-6'
                        initial={{ opacity: 0, y: 50 }}
                        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 1.6 }}
                    >
                        {/* Image - Above on mobile, right on desktop */}
                        <motion.div 
                            className='flex-1 flex justify-center mb-4 lg:mb-0 lg:ml-6 order-2 lg:order-1'
                            initial={{ opacity: 0, x: 100 }}
                            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 100 }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 2.0 }}
                        >
                            <img src='Launch_Guide_02.png' alt='Install Extension' className='max-w-full max-h-48 sm:max-h-56 lg:max-h-full object-contain rounded-lg'/>
                        </motion.div>
                        {/* Text - Below on mobile, left on desktop */}
                        <motion.div 
                            className='flex-1 text-center lg:text-left order-1 lg:order-2 lg:ml-10'
                            initial={{ opacity: 0, x: -100 }}
                            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -100 }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 1.8 }}
                        >
                            <p className='text-xl sm:text-2xl lg:text-3xl font-semibold mb-2 sm:mb-4'><span className='text-green-300'>Optimize</span> Your learning</p>
                            <p className='text-sm sm:text-base lg:text-xl'>with summaries, smart chat, and more.</p>
                        </motion.div>
                    </motion.div>

                    {/* Third Guide Item */}
                    <motion.div 
                        className='min-h-[16rem] sm:min-h-[18rem] lg:min-h-[20rem] rounded-lg flex flex-col lg:flex-row items-center p-4 sm:p-6'
                        initial={{ opacity: 0, y: 50 }}
                        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 2.4 }}
                    >
                        {/* Image - Above on mobile, left on desktop */}
                        <motion.div 
                            className='flex-1 flex justify-center mb-4 lg:mb-0 lg:mr-6'
                            initial={{ opacity: 0, x: -100 }}
                            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -100 }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 2.6 }}
                        >
                            <img src='Launch_Guide_03.png' alt='Use Extension' className='max-w-full max-h-48 sm:max-h-56 lg:max-h-full object-contain rounded-lg'/>
                        </motion.div>
                        {/* Text - Below on mobile, right on desktop */}
                        <motion.div 
                            className='flex-1 text-center lg:text-left'
                            initial={{ opacity: 0, x: 100 }}
                            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 100 }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 2.8 }}
                        >
                            <p className='text-xl sm:text-2xl lg:text-3xl font-semibold mb-2 sm:mb-4'>Measure Your <span className='text-green-300'>Growth</span></p>
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        </div>

        <div className="bg-gray-700 h-auto flex flex-col sm:flex-row sm:justify-around sm:items-center text-base sm:text-lg md:text-xl px-4 py-3 space-y-3 sm:space-y-0">
  {/* Contact Email */}
  <p className="text-center sm:text-left">
    <span className="text-green-300">Contact Us: </span>
    buzz@gradus-zenith.tech
  </p>

  {/* Phone */}
  <p className="text-center sm:text-left">
    <span className="text-green-300">Phone: </span>
    9021882342
  </p>

  {/* Social Links */}
  <div className="flex justify-center sm:justify-start items-center">
    <p className="text-green-300 mr-2">Follow Us:</p>
    <Link
      className="ml-2 text-white hover:text-green-300 transition-colors duration-200"
      href="https://www.instagram.com/zenith_t3ch?igsh=aTg1NW41OWltaTcx"
      target="_blank"
      rel="noopener noreferrer"
    >
      <i className="fa-brands fa-instagram"></i>
    </Link>
    <Link
      className="ml-3 text-white hover:text-green-300 transition-colors duration-200"
      href="https://www.linkedin.com/company/gradus-zenith/"
      target="_blank"
      rel="noopener noreferrer"
    >
      <i className="fa-brands fa-linkedin"></i>
    </Link>
    <Link
      className="ml-3 text-white hover:text-green-300 transition-colors duration-200"
      href="https://x.com/Gradus_Zenith"
      target="_blank"
      rel="noopener noreferrer"
    >
      <i className="fa-brands fa-x-twitter"></i>
    </Link>
  </div>
</div>


        {/* Back to Top Button */}
        {showBackToTop && (
            <motion.button
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                onClick={scrollToTop}
                className="fixed bottom-8 right-8 w-14 h-14 bg-green-300 hover:bg-green-400 text-black rounded-full shadow-lg flex items-center justify-center z-50 transition-colors duration-200 cursor-pointer"
                aria-label="Back to top"
            >
                <i className="fas fa-arrow-up text-xl"></i>
            </motion.button>
        )}
        
    </div>
  )
}

export default Extension