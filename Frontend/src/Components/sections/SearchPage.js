"use client";
import React, { useEffect, useState } from 'react';
import { auth } from '@/lib/Firebase';
import { motion } from 'motion/react'
import { fetchUserDetails } from '@/services/userServices';
import { searchRecommendations } from '@/utils/recommendations';
import SearchVideos from '../layout/SearchVideos';
import Navbar from '../common/Navbar';
import { useDispatch, useSelector } from 'react-redux';
import { setSearchState } from '../../../store/HomeSlice';
import SearchVideosLoader from '../loaders/SearchVideosLoader';
import InstallExtension from '../layout/InstallExtension';
import { isExtensionAvailable } from '@/utils/ExtensionCheck';


const SearchPage = () => {
    const dispatch = useDispatch();
    const homeState = useSelector((state) => state?.home);
    const savedQuery = typeof homeState?.query === 'string' ? homeState.query : '';
    const savedVideos = Array.isArray(homeState?.videos) ? homeState.videos : [];

    const [username, setUsername] = useState('there');
    const [query, setQuery] = useState('');
    const [animatedName, setAnimatedName] = useState('');
    const [videos, setVideos] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [hasAutoSearched, setHasAutoSearched] = useState(false);
    const [showInstallExtension, setShowInstallExtension] = useState(false);
    const hasSearched = isSearching || (Array.isArray(videos) && videos.length > 0) || (Array.isArray(savedVideos) && savedVideos.length > 0);
    const displayVideos = (Array.isArray(videos) && videos.length > 0)
        ? videos
        : (Array.isArray(savedVideos) ? savedVideos : []);

    useEffect(() => {
        const user = auth?.currentUser;
        if (!user?.uid) return;
        fetchUserDetails(user.uid)
            .then((details) => {
                const nameCandidate = details?.data?.name || details?.name || "There";
                if (typeof nameCandidate === 'string' && nameCandidate.trim().length > 0) {
                    const firstName = nameCandidate.trim().split(/\s+/)[0];
                    setUsername(firstName);
                }
            })
            .catch(() => {
                // keep default 'there' on error
            });
    }, []);

    // Initialize from Redux if available
    useEffect(() => {
        try {
            if (savedQuery) setQuery(savedQuery);
            if (Array.isArray(savedVideos) && savedVideos.length > 0) {
                setVideos(savedVideos);
            }
        } catch (_) { }
    }, [savedQuery, savedVideos]);

    // Check if the Gradus extension is available
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const ok = await isExtensionAvailable(2000);
                if (!cancelled) setShowInstallExtension(!ok);
            } catch (_) {
                if (!cancelled) setShowInstallExtension(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Typewriter effect for the name
    useEffect(() => {
        if (typeof username !== 'string') return;
        const safeName = String(username || '').trim();
        if (!safeName) return;
        setAnimatedName('');
        const letters = Array.from(safeName);
        let index = 0;
        const startDelay = 300; // start slightly after "Hello"
        const stepMs = 120; // speed per letter
        let intervalId;
        const startTimeout = setTimeout(() => {
            intervalId = setInterval(() => {
                if (index < letters.length) {
                    const nextChar = letters[index] ?? '';
                    setAnimatedName((prev) => (prev ?? '') + nextChar);
                    index += 1;
                } else {
                    clearInterval(intervalId);
                }
            }, stepMs);
        }, startDelay);

        return () => {
            try { clearTimeout(startTimeout); } catch (_) { }
            try { if (intervalId) clearInterval(intervalId); } catch (_) { }
        };
    }, [username]);

    // Reusable search function
    const performSearch = async (searchQuery) => {
        if (!searchQuery || !searchQuery.trim()) return;

        setIsSearching(true);
        setSearchError('');
        try {
            const res = await searchRecommendations(searchQuery.trim(), 15);
            const items = Array.isArray(res) ? res : (res?.items || res?.results || res?.data || []);
            const nextVideos = Array.isArray(items) ? items : [];
            setVideos(nextVideos);
            dispatch(setSearchState({ query: searchQuery.trim(), videos: nextVideos }));
        } catch (err) {
            setSearchError(err?.message || 'Search failed');
        } finally {
            setIsSearching(false);
        }
    };

    // Auto-search effect when coming from navbar
    useEffect(() => {
        if (savedQuery && savedQuery.trim() && !hasAutoSearched && savedVideos.length === 0) {
            setHasAutoSearched(true);
            performSearch(savedQuery);
        }
    }, [savedQuery, hasAutoSearched, savedVideos.length]);

    return (
        <>
            <div className="flex flex-col min-h-screen">
                <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md">
                    <Navbar />
                </div>
                <div className={`flex-1 bg-black from-gray-900 to-black px-4 sm:px-6 md:px-8 pt-28 sm:pt-32 md:pt-36 pb-6 sm:pb-8 md:pb-10 flex ${hasSearched ? 'items-start justify-center' : 'items-center justify-center'} font-questrial`} style={{ fontFamily: 'Questrial, sans-serif' }}>
                    <div className={`${hasSearched ? 'max-w-none' : 'max-w-3xl'} w-full`}>
                        {!hasSearched && (
                            <>
                                <motion.h1
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                    className="text-3xl sm:text-3xl md:text-4xl font-bold text-white text-center"
                                >
                                    Hello <span className='text-green-300'>{animatedName || ''}</span>
                                </motion.h1>
                                <motion.p
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
                                    className="text-gray-300 mt-2 sm:mt-3 md:mt-4 text-3xl sm:text-3xl md:text-4xl text-center"
                                >
                                    What would you like to learn today?
                                </motion.p>
                            </>
                        )}

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
                            className={hasSearched ? 'mt-2' : 'mt-6 sm:mt-8'}
                        >
                            <div className="flex items-center gap-2 bg-gray-800 rounded-full px-4 sm:px-5 py-2.5 sm:py-3 border border-gray-700 focus-within:ring-2 focus-within:ring-[#18cb96]">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={async (e) => {
                                        if (e.key === 'Enter') {
                                            await performSearch(query);
                                        }
                                    }}
                                    placeholder="Search for topics, skills, or videos..."
                                    className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none text-sm sm:text-base"
                                />
                                <button
                                    type="button"
                                    className="shrink-0 bg-[#18cb96] hover:bg-[#15b789] text-black font-semibold rounded-full px-4 py-2 sm:px-5 sm:py-2 transition-colors cursor-pointer"
                                    onClick={async () => {
                                        await performSearch(query);
                                    }}
                                >
                                    {isSearching ? 'Searching…' : 'Search'}
                                </button>
                            </div>
                        </motion.div>

                        {isSearching && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mt-6">
                                <SearchVideosLoader count={9} />
                            </motion.div>
                        )}

                        {searchError && (
                            <p className="text-red-400 mt-3 text-sm">{searchError}</p>
                        )}

                        {!isSearching && displayVideos && displayVideos.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.4, ease: 'easeOut' }}
                                className="mt-6"
                            >
                                <SearchVideos items={displayVideos} />
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
            <InstallExtension open={showInstallExtension} onClose={() => setShowInstallExtension(false)} />
        </>
    );
};

export default SearchPage;