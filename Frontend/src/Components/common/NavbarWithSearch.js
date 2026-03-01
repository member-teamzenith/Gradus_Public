"use client";

import React, { useState, useEffect, useRef } from "react";
import { auth } from "@/lib/Firebase";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { setSearchState } from "../../../store/HomeSlice";
import { clearUser, selectUser, selectUserDetails } from "../../../store/userSlice";
import { Search, Loader2 } from "lucide-react";
import { seedUserInReduxIfMissing } from "../../services/userServices";



const NavbarWithSearch = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const reduxUser = useSelector(selectUser);
  const reduxDetails = useSelector(selectUserDetails);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();
  const profileRef = useRef(null);

  // Derive display data from Redux user or details
  const pick = (obj, keys) => {
    if (!obj) return undefined;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).length > 0) return obj[k];
    }
    return undefined;
  };
  const detailsPhoto = pick(reduxDetails, ['photoURL', 'photo', 'avatar', 'profilePic', 'profilePhoto', 'image', 'picture', 'photo(pin)']);
  const detailsName = pick(reduxDetails, ['displayName', 'name']);
  const avatarUrl = reduxUser?.photo || detailsPhoto || "/default-avatar.png";
  const displayName = reduxUser?.displayName || detailsName || "User";

  // Seed Redux user from Firebase + backend if missing
  useEffect(() => {
    seedUserInReduxIfMissing({ reduxUser, auth, dispatch });
  }, [reduxUser, dispatch]);

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


  const handelProfile = () => {
    router.push('/dashboard/profile');
  }

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchQuery.trim() && !isSearchLoading) {
      setIsSearchLoading(true);
      try {
        // Update Redux with new query and clear previous videos
        dispatch(setSearchState({
          query: searchQuery.trim(),
          videos: []
        }));
        // Navigate to search page
        await router.push('/home/search');
        // Clear the search input
        setSearchQuery("");
      } catch (error) {
        console.error('Search navigation error:', error);
      } finally {
        setIsSearchLoading(false);
      }
    }
  };


  async function handleLogout() {
    try {
      await auth.signOut();
      dispatch(clearUser());
      router.push("/homepage");
      // console.log("User logged out successfully!");
    } catch (error) {
      // console.error("Error logging out:", error.message);
    }
  }


  return (
    <nav className="sticky top-0 z-50 w-full border-b-2 pb-1 border-green-300 px-4 sm:px-6 md:px-8 lg:px-12 py-2 sm:py-3 md:py-3 bg-black/80 backdrop-blur-xl">
      <div className="flex justify-between items-center w-full h-8 sm:h-10 md:h-12">
        {/* Logo - Left side */}
        <div className="flex-shrink-0 h-[50px] flex items-center">
          <Link href="/home/feed">
            <Image
              src='/Gradus.png'
              alt="Logo"
              width={150}
              height={50}
              priority
              className=""
            />
          </Link>
        </div>

        {/* Search Bar - Center */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <form onSubmit={handleSearch} className="w-full">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isSearchLoading ? "Searching..." : "Search for topics, skills, or videos..."}
                disabled={isSearchLoading}
                className={`w-full bg-gray-800 text-white placeholder-gray-400 border border-gray-600 rounded-full px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent text-sm ${isSearchLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
              <button
                type="submit"
                disabled={isSearchLoading}
                className={`absolute right-2 p-1.5 transition-colors duration-200 ${isSearchLoading ? 'text-gray-500 cursor-not-allowed' : 'text-gray-400 hover:text-green-300'}`}
              >
                {isSearchLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Actions - Right side */}
        <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
          {/* Mobile Search Icon */}
          <button
            onClick={() => router.push('/home/search')}
            className="md:hidden p-2 text-white hover:text-green-300 transition-colors duration-200"
            aria-label="Search"
          >
            <Search size={20} />
          </button>

          {/* <Link href="/blueprints">
            <button className="bg-green-300 text-black px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-full font-semibold cursor-pointer hover:bg-green-400 transition-colors duration-200 text-xs sm:text-sm md:text-base">
              Blueprints
            </button>
          </Link> */}

          {/* Profile Container */}
          {reduxUser && (
            <div className="relative" ref={profileRef}>
              <div
                className="cursor-pointer"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
              >
                <Image
                  src={avatarUrl}
                  alt="Profile"
                  width={40}
                  height={40}
                  unoptimized
                  className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full border-2 border-green-300 hover:border-green-400 transition-colors duration-200"
                />
              </div>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-gray-800 border border-green-300 rounded-lg shadow-xl z-50">
                  <div className="p-4 border-b border-gray-700">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <Image
                          src={avatarUrl}
                          alt="Profile"
                          width={40}
                          height={40}
                          unoptimized
                          className="w-10 h-10 rounded-full"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm sm:text-base truncate">
                          {displayName}
                        </div>
                        <div
                          className="text-green-300 text-xs sm:text-sm cursor-pointer hover:text-green-400 transition-colors duration-200"
                          onClick={handelProfile}
                        >
                          View Your Profile
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <div
                      className="px-3 py-2 text-white text-sm sm:text-base cursor-pointer hover:bg-gray-700 rounded-md transition-colors duration-200"
                      onClick={() => {
                        router.push('/revision');
                        setIsProfileOpen(false);
                      }}
                    >
                      Revise
                    </div>
                    <div
                      className="px-3 py-2 text-white text-sm sm:text-base font-bold cursor-pointer hover:bg-red-500 hover:text-black rounded-md transition-colors duration-200"
                      onClick={handleLogout}
                    >
                      Log-out
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavbarWithSearch;
