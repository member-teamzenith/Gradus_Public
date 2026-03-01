"use client";
import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { auth } from "@/lib/Firebase";
import {
    fetchVideoSummary as fetchVideoSummaryService
} from '@/services/videoPlayerServices';
import dynamic from 'next/dynamic';
import InstallExtension from '../layout/InstallExtension';

// Lazy load ALL heavy components including navbar and time tracker
const NavbarWithSearch = dynamic(() => import('../common/NavbarWithSearch'), { ssr: false });
const TimeTracker = dynamic(() => import('../layout/TimeTracker'), { ssr: false });
const SummaryFormatter = dynamic(() => import('../VideoPlayer/watch/SummaryContainer'), { ssr: false });
const MathJaxProvider = dynamic(() => import('better-react-mathjax').then(mod => ({ default: mod.MathJaxContext })), { ssr: false });
const MathJaxRenderer = dynamic(() => import('better-react-mathjax').then(mod => ({ default: mod.MathJax })), { ssr: false });
const Chatbot = dynamic(() => import('../VideoPlayer/watch/ChatbotContainer'), { ssr: false });
const VideoRecommendation = dynamic(() => import('../VideoPlayer/watch/VideoRecommendationWrapper'), { ssr: false });
const Quiz = dynamic(() => import('../VideoPlayer/watch/QuizModel'), { ssr: false });
const NotesPanel = dynamic(() => import('../VideoPlayer/watch/NotesPanel'), { ssr: false });
import { useDispatch, useSelector } from "react-redux";
import { selectUserId } from '../../../store/userSlice';
import { setVideoId, clearSummariesForVideo } from '../../../store/videoplayerSlice';
import { CalendarDays, Printer, Brain } from 'lucide-react';
import { printSummaryToPDF as printSummaryToPDFHelper } from '../helper/SummaryPrint';
import { useVideoMetadata } from '../VideoPlayer/hooks/useVideoMetadata';
import { useTranscriptManager } from '../VideoPlayer/hooks/useTranscriptManager';
import { useIRProcessor } from '../VideoPlayer/hooks/useIRProcessor';
import { useSummaryGenerator } from '../VideoPlayer/hooks/useSummaryGenerator';
import { useChatSession } from '../VideoPlayer/hooks/useChatSession';
import { useRecommendations } from '../VideoPlayer/hooks/useRecommendations';
import { useQuizGenerator } from '../VideoPlayer/hooks/useQuizGenerator';

const generatedSummaryKeys = new Set();

// Static language list - memoized outside component
const LANGUAGES = [
    'English',
    'Spanish',
    'French',
    'German',
    'Chinese (Simplified)',
    'Portuguese',
    'Italian',
    'Arabic',
    'Hindi',
    'Hebrew',
    'Urdu',
    'Bengali',
    'Tamil',
    'Telugu',
    'Kannada'
];

// Memoized Action Buttons Bar - doesn't change based on video content
const ActionButtonsBar = memo(({ onScheduleClick, onPrintClick, onQuizClick, quizState, isQuizDisabled }) => (
    <div className="flex flex-col sm:flex-row gap-[12px] mt-[8px]">
        <button onClick={onScheduleClick} className="inline-flex items-center justify-center gap-2 bg-green-400 text-black border-0 rounded-[20px] text-sm sm:text-base cursor-pointer mt-0 transition-colors duration-200 hover:bg-green-500 px-3 sm:px-5 py-2 sm:py-3">
            <CalendarDays className='w-4 h-4 sm:w-5 sm:h-5 mr-1' />
            Schedule
        </button>
        <button
            className="inline-flex items-center justify-center gap-2 bg-green-400 text-black border-0 rounded-[20px] text-sm sm:text-base cursor-pointer mt-0 transition-colors duration-200 hover:bg-green-500 px-3 sm:px-5 py-2 sm:py-3"
            onClick={onPrintClick}
        >
            <Printer className='w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-3' />
            <span className="hidden sm:inline">Download Summary</span>
            <span className="sm:hidden">Download</span>
        </button>

        <button
            className={`inline-flex items-center justify-center gap-2 border-0 rounded-[20px] text-sm sm:text-base transition-colors duration-200 px-3 sm:px-5 py-2 sm:py-3 mt-[5px] ${
                quizState
                    ? 'bg-green-400 text-black cursor-pointer hover:bg-green-500'
                    : isQuizDisabled
                        ? 'bg-yellow-400 text-black cursor-not-allowed'
                        : 'bg-gray-400 text-gray-600 cursor-not-allowed'
            }`}
            onClick={onQuizClick}
            disabled={!quizState}
        >
            <Brain className='w-4 h-4 sm:w-5 sm:h-5 mr-1' />
            {quizState
                ? 'Quiz'
                : isQuizDisabled
                    ? 'Generating...'
                    : 'Quiz'}
        </button>
    </div>
));
ActionButtonsBar.displayName = 'ActionButtonsBar';

// Memoized Desktop Tab Button Bar
const DesktopTabButtonBar = memo(({ activeTab, onTabChange, selectedLanguage, showLanguageDropdown, onLanguageDropdownToggle, languages, onLanguageSelect, languageDropdownRef }) => (
    <div className='flex gap-[8px] ml-4'>
        <button
            onClick={() => onTabChange('description')}
            className={`px-4 py-2 rounded ${activeTab === 'description' ? 'bg-green-400 text-black font-bold' : 'bg-darkBlueGray text-white font-bold border border-white/20'}`}
        >
            Description
        </button>
        <div className='relative' ref={languageDropdownRef}>
            <button
                onClick={() => {
                    onTabChange('summary');
                    onLanguageDropdownToggle();
                }}
                className={`px-4 py-2 rounded flex items-center gap-2 ${activeTab === 'summary' ? 'bg-green-400 text-black font-bold' : 'bg-darkBlueGray text-white font-bold border border-white/20'}`}
            >
                Summary ({selectedLanguage})
                <svg className={`w-4 h-4 transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {showLanguageDropdown && (
                <div className='absolute top-full left-0 mt-1 bg-black border border-white/20 rounded shadow-lg z-50 max-h-60 overflow-y-auto summary-scroll'>
                    {languages.map((lang) => (
                        <button
                            key={lang}
                            onClick={() => onLanguageSelect(lang)}
                            className={`w-full text-left px-4 py-2 hover:bg-green-400 hover:text-black transition-colors ${
                                selectedLanguage === lang ? 'bg-green-500 text-black font-bold' : 'text-white'
                            }`}
                        >
                            {lang}
                        </button>
                    ))}
                </div>
            )}
        </div>
        <button
            onClick={() => onTabChange('chatbot')}
            className={`px-4 py-2 rounded ${activeTab === 'chatbot' ? 'bg-green-400 text-black font-bold' : 'bg-darkBlueGray text-white font-bold border border-white/20'}`}
        >
            Chatbot
        </button>
    </div>
));
DesktopTabButtonBar.displayName = 'DesktopTabButtonBar';

// Memoized Mobile Tab Button Bar
const MobileTabButtonBar = memo(({ activeTab, onTabChange, selectedLanguage, showLanguageDropdown, onLanguageDropdownToggle, languages, onLanguageSelect }) => (
    <div className='flex gap-[8px] overflow-x-auto'>
        <button
            onClick={() => onTabChange('description')}
            className={`px-3 py-2 rounded text-sm whitespace-nowrap ${activeTab === 'description' ? 'bg-green-400 text-black font-bold' : 'bg-darkBlueGray text-white font-bold border border-white/20'}`}
        >
            Description
        </button>
        <div className='relative'>
            <button
                onClick={() => {
                    onTabChange('summary');
                    onLanguageDropdownToggle();
                }}
                className={`px-3 py-2 rounded text-sm whitespace-nowrap flex items-center gap-1 ${activeTab === 'summary' ? 'bg-green-400 text-black font-bold' : 'bg-darkBlueGray text-white font-bold border border-white/20'}`}
            >
                Summary ({selectedLanguage})
                <svg className={`w-3 h-3 transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {showLanguageDropdown && (
                <div className='absolute top-full left-0 mt-1 bg-black border border-white/20 rounded shadow-lg z-50 max-h-60 overflow-y-auto min-w-[200px] summary-scroll'>
                    {languages.map((lang) => (
                        <button
                            key={lang}
                            onClick={() => onLanguageSelect(lang)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-green-400 hover:text-black transition-colors ${
                                selectedLanguage === lang ? 'bg-green-500 text-black font-bold' : 'text-white'
                            }`}
                        >
                            {lang}
                        </button>
                    ))}
                </div>
            )}
        </div>
        <button
            onClick={() => onTabChange('chatbot')}
            className={`px-3 py-2 rounded text-sm whitespace-nowrap ${activeTab === 'chatbot' ? 'bg-green-400 text-black font-bold' : 'bg-darkBlueGray text-white font-bold border border-white/20'}`}
        >
            Chatbot
        </button>
        <button
            onClick={() => onTabChange('recommendations')}
            className={`px-3 py-2 rounded text-sm whitespace-nowrap ${activeTab === 'recommendations' ? 'bg-green-400 text-black font-bold' : 'bg-darkBlueGray text-white font-bold border border-white/20'}`}
        >
            Recommendations
        </button>
        <button
            onClick={() => onTabChange('notes')}
            className={`px-3 py-2 rounded text-sm whitespace-nowrap ${activeTab === 'notes' ? 'bg-green-400 text-black font-bold' : 'bg-darkBlueGray text-white font-bold border border-white/20'}`}
        >
            Notes
        </button>
    </div>
));
MobileTabButtonBar.displayName = 'MobileTabButtonBar';

// Skeleton loader for instant perceived performance
const VideoPlayerSkeleton = memo(() => (
    <div className="w-full h-full bg-[#121212] animate-pulse flex items-center justify-center">
        <div className="text-gray-500 text-lg">Loading video...</div>
    </div>
));
VideoPlayerSkeleton.displayName = 'VideoPlayerSkeleton';

const Watch = () => {
    // Initialize userId safely; sync effect below will populate it from Redux or Firebase
    const [userId, setUserId] = useState("");
    const reduxUserId = useSelector(selectUserId);

    // Video ID from params
    const params = useParams();
    const videoId = params.id;

    // Video metadata hook
    const {
        videoTitle,
        videoDescription
    } = useVideoMetadata(videoId);

    // Transcript management hook
    const {
        transcript,
        formattedEntries,
        fetchVideoTranscript,
        buildTranscriptEntries,
        showInstallExtension,
        setShowInstallExtension,
        transcriptFailed
    } = useTranscriptManager(videoId);

    // Track if transcript is being loaded
    const [isTranscriptLoading, setIsTranscriptLoading] = useState(true);
    const [hasAttemptedTranscript, setHasAttemptedTranscript] = useState(false);

    // IR processing hook
    const {
        canInitChat,
        getCachedIRData,
        analyzeToIR,
        getIR,
        setIR,
        hasIR
    } = useIRProcessor(videoId, videoTitle, videoDescription);

    const [quizOpen, setQuizOpen] = useState(false);
    const [irReady, setIrReady] = useState(false); // Track when IR is available
    const [isIRCached, setIsIRCached] = useState(false); // Track if IR was loaded from cache
    const dispatch = useDispatch();
    const reduxVideoId = useSelector(state => state.videoPlayer.videoId);
    const reduxQuiz = useSelector(state => state.videoPlayer.quiz);

    // Debug Redux state changes
    useEffect(() => {

    }, [reduxQuiz]);


    const [activeTab, setActiveTab] = useState('description'); // 'description' | 'summary' | 'chatbot' | 'recommendations' | 'notes'
    const [iframeLoading, setIframeLoading] = useState(true);
    const [selectedLanguage, setSelectedLanguage] = useState('English');
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
    const languageDropdownRef = useRef(null);
    const [componentsLoaded, setComponentsLoaded] = useState(false);

    // Recommendations management hook
    const {
        recPrimaryTopic,
        recSubjectCategory,
        recSimilarTopics,
        recPrerequisiteTopics,
        recNextTopics,
        memoizedRecommendations,
        getCachedRecommendationsData,
        loadCachedRecommendations,
        fetchRecommendationsWithIR,
        autoFetchRecommendations
    } = useRecommendations(videoId, userId, getIR, hasIR, videoTitle);

    // Summary generation hook
    const {
        summary,
        cleanSummary,
        summaryLoading,
        mathText,
        summaryFromCacheRef,
        generateSummary,
        setMathText
    } = useSummaryGenerator(
        videoId,
        userId,
        selectedLanguage,
        fetchVideoTranscript,
        buildTranscriptEntries,
        getCachedIRData,
        analyzeToIR,
        getIR,
        setIR
    );

    // Chat session management hook
    const {
        chatSession,
        chatInitTriggeredRef,
        initializeChatSession
    } = useChatSession(videoId, userId, canInitChat, hasIR, isIRCached);

    // Quiz generation hook
    const {
        quizStartedRef,
        fetchQuiz,
        autoFetchQuiz
    } = useQuizGenerator(
        videoId,
        fetchVideoTranscript,
        buildTranscriptEntries,
        getCachedIRData,
        analyzeToIR,
        getIR,
        setIR,
        hasIR
    );

    // Track transcript loading and attempt state
    useEffect(() => {
        if (!videoId) return;
        
        setIsTranscriptLoading(true);
        setHasAttemptedTranscript(false);
        
        // Check if transcript is loaded or failed after a reasonable time
        const checkTimer = setTimeout(() => {
            setHasAttemptedTranscript(true);
            if (transcript || !transcriptFailed) {
                setIsTranscriptLoading(false);
            }
        }, 2000); // Give 2 seconds for transcript to load
        
        return () => clearTimeout(checkTimer);
    }, [videoId, transcript, transcriptFailed]);

    // Update loading state when transcript is received
    useEffect(() => {
        if (transcript && transcript.length > 0) {
            setIsTranscriptLoading(false);
            setHasAttemptedTranscript(true);
        }
    }, [transcript]);

    // Preconnect to YouTube domains for faster iframe loading
    useEffect(() => {
        // Create preconnect links
        const preconnects = [
            'https://www.youtube.com',
            'https://i.ytimg.com',
            'https://www.google.com'
        ];
        
        const links = [];
        preconnects.forEach(href => {
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = href;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
            links.push(link);
        });

        return () => {
            links.forEach(link => document.head.removeChild(link));
        };
    }, []);

    // Defer component loading to after initial render
    useEffect(() => {
        const timer = setTimeout(() => setComponentsLoaded(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target)) {
                setShowLanguageDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        // Re-arm quiz generation when video changes
        quizStartedRef.current = false;

        // Reset IR ready state when video changes
        setIrReady(false);
        setIsIRCached(false);

        // Clear summaries for previous video when video changes
        if (videoId) {
            // Clear the old generatedSummaryKeys
            generatedSummaryKeys.clear();
            // Clear Redux summaries for previous video
            try {
                if (reduxVideoId && reduxVideoId !== videoId) {
                    dispatch(clearSummariesForVideo(reduxVideoId));
                }
            } catch (error) {
                console.error('Error clearing summaries:', error);
            }
        }
    }, [videoId, reduxVideoId, dispatch]);

    const videoUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&cc_load_policy=1&autoplay=1&playsinline=1`;

    const fetchVideoSummary = useCallback(async (videoIdParam = null) => {
        try {
            const idToUse = videoIdParam || reduxVideoId;
            if (idToUse && userId) {
                // Fetch from summaries endpoint using service
                const data = await fetchVideoSummaryService(idToUse);

                if (data && data.summary) {
                    return data.summary;
                } else {
                    return null;
                }
            } else {
                return null;
            }
        } catch (error) {

            return null;
        }
    }, [reduxVideoId, userId]);

    // As soon as video changes, optionally ensure IR exists (only when summary wasn't found in cache) and refresh cached recommendations (no Python call here)
    useEffect(() => {
        if (!userId || !videoId) return;
        (async () => {
            // If summary came from cache for this video, skip IR analysis/embedding here
            if (!summaryFromCacheRef.current) {
                // Try to reuse/cached IR first
                let ir = await getCachedIRData(videoId);
                if (!ir) {
                    const fullTranscript = await fetchVideoTranscript(videoId).catch(() => null);
                    let entries = [];
                    if (fullTranscript && Array.isArray(fullTranscript) && fullTranscript.length > 0) {
                        entries = buildTranscriptEntries(fullTranscript);
                    }
                    ir = await analyzeToIR(entries, videoId);
                }
                if (ir) {
                    setIR(ir);
                    // console.log('[Watch] IR set (fresh or from cache)');
                    setIrReady(true); // Mark IR as ready
                    setIsIRCached(true);
                }
            } else {
                // Summary came from cache, but we still need to load cached IR into state
                // console.log('[Watch] Summary from cache, loading IR from cache...');
                const cachedIR = await getCachedIRData(videoId);
                if (cachedIR) {
                    setIR(cachedIR);
                    // console.log('[Watch] IR loaded from cache into state');
                    setIrReady(true); // Mark IR as ready
                    setIsIRCached(true);
                }
            }

            // Refresh recommendations from cache only; Python recommendations will be triggered automatically
            await loadCachedRecommendations(videoId);
        })();
    }, [userId, videoId, fetchVideoTranscript, getCachedIRData, analyzeToIR, setIR, loadCachedRecommendations]);

    // Separate effect: Auto-trigger recommendations, quiz, and chat when IR becomes available
    useEffect(() => {
        if (!userId || !videoId || !irReady) return;

        // console.log('[Watch] IR is now available, triggering parallel operations...');

        // Trigger recommendations and quiz immediately
        autoFetchRecommendations();
        autoFetchQuiz();

        // Trigger chat initialization after 2s delay
        const chatTimer = setTimeout(() => {
            // console.log('[Watch] Triggering chat initialization...');
            initializeChatSession();
        }, 2000);

        return () => clearTimeout(chatTimer);
    }, [userId, videoId, irReady, autoFetchRecommendations, autoFetchQuiz, initializeChatSession]);

    useEffect(() => {
        if (videoId) {
            dispatch(setVideoId(videoId));
        }
    }, [videoId, dispatch]);

    // Ensure Redux videoId always matches this tab's URL when switching tabs/windows
    useEffect(() => {
        function syncVideoIdWithUrl() {
            if (params?.id) {
                dispatch(setVideoId(params.id));
            }
        }

        const handleVisibility = () => {
            if (!document.hidden) {
                syncVideoIdWithUrl();
            }
        };

        window.addEventListener('focus', syncVideoIdWithUrl);
        document.addEventListener('visibilitychange', handleVisibility);
        // Initial sync in case of any mismatch
        syncVideoIdWithUrl();

        return () => {
            window.removeEventListener('focus', syncVideoIdWithUrl);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [dispatch, params]);

    // Keep videoId in Redux until URL changes; do not reset on unload/unmount
    // Removed beforeunload and unmount resets to preserve videoId across navigation

    // Keep userId in sync: prefer Redux (authoritative) but fall back to Firebase auth when Redux isn't ready
    useEffect(() => {
        try {
            const uid = reduxUserId || (auth && auth.currentUser && auth.currentUser.uid) || "";
            setUserId(uid);
        } catch (_) {
            setUserId("");
        }
    }, [reduxUserId]);

    // Cleanup effect to reset state when component unmounts
    useEffect(() => {
        return () => {
            setActiveTab('description');
            setQuizOpen(false);
            setSelectedLanguage('English');
            setShowLanguageDropdown(false);
            setIframeLoading(true);
            setShowInstallExtension(false);
            // Don't reset videoId in Redux on unmount
            // Don't reset tokens on unmount
        };
    }, []);

    // Ensure YouTube Iframe API is loaded and auto-enable captions to trigger timedtext
    useEffect(() => {
        if (!videoId) return;
        let cancelled = false;
        function onYouTubeIframeAPIReadyLocal() {
            if (cancelled) return;
            // eslint-disable-next-line no-undef
            const player = new YT.Player('player', {
                events: {
                    onReady: () => {
                        try {
                            player.loadModule && player.loadModule('captions');
                            // Prefer English; YouTube will fallback if not available
                            player.setOption && player.setOption('captions', 'track', { languageCode: 'en' });
                            // Attempt normal autoplay (may be blocked by browser policies)
                            try { player.playVideo && player.playVideo(); } catch (_) { }
                        } catch (_) {
                            // Hide loader even if there's an error
                            setIframeLoading(false);
                        }
                    }
                }
            });
        }

        function loadYT() {
            if (window.YT && window.YT.Player) {
                onYouTubeIframeAPIReadyLocal();
                return;
            }
            const scriptId = 'yt-iframe-api';
            if (document.getElementById(scriptId)) return;
            const tag = document.createElement('script');
            tag.id = scriptId;
            tag.src = 'https://www.youtube.com/iframe_api';
            document.body.appendChild(tag);
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (typeof prev === 'function') try { prev(); } catch (_) { }
                onYouTubeIframeAPIReadyLocal();
            };
        }

        // Reset iframe loading state when videoId changes
        setIframeLoading(true);
        loadYT();
        return () => { cancelled = true; };
    }, [videoId]);

    // Handle iframe load event as fallback
    useEffect(() => {
        const handleIframeLoad = () => {
            setIframeLoading(false);
        };

        const iframe = document.getElementById('player');
        if (iframe) {
            iframe.addEventListener('load', handleIframeLoad);
            return () => {
                iframe.removeEventListener('load', handleIframeLoad);
            };
        }
    }, [videoId]);

    // Fallback timeout to hide loader after 10 seconds
    useEffect(() => {
        if (iframeLoading) {
            const timeout = setTimeout(() => {

                setIframeLoading(false);
            }, 10000); // 10 seconds timeout

            return () => clearTimeout(timeout);
        }
    }, [iframeLoading]);

    // Fetch video summary when Redux videoId changes
    useEffect(() => {
        if (reduxVideoId && userId) {
            fetchVideoSummary(reduxVideoId);
        }
    }, [reduxVideoId, userId, fetchVideoSummary]);

    const handleScheduleClick = useCallback(() => {
        const videoTitleForCalender = videoTitle || 'Study Session';
        const videoId = params.id; // Or get from your router/context
        const duration = 60; // minutes

        const details = {
            title: `Study: ${videoTitleForCalender}`,
            details: `Study session for video: https://youtube.com/watch?v=${videoId}\n\nNotes:\n- Review summary before watching\n- Take notes during video\n- Practice with Q&A after watching`,
            duration
        };

        const now = new Date();
        const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
        startTime.setHours(10, 0, 0, 0); // 10 AM
        const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

        function formatGoogleDate(date) {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        }

        const calendarUrl = new URL('https://calendar.google.com/calendar/render');
        calendarUrl.searchParams.append('action', 'TEMPLATE');
        calendarUrl.searchParams.append('text', details.title);
        calendarUrl.searchParams.append('details', details.details);
        calendarUrl.searchParams.append(
            'dates',
            `${formatGoogleDate(startTime)}/${formatGoogleDate(endTime)}`
        );

        window.open(calendarUrl.toString(), '_blank');
    }, [videoTitle, params.id]);

    const handlePrintClick = useCallback(async () => {
        const ok = await printSummaryToPDFHelper(cleanSummary || summary || '', videoTitle || 'Summary');
        if (ok) toast.success('PDF downloaded'); else toast.error('Error generating PDF. Please try again.');
    }, [cleanSummary, summary, videoTitle]);

    const handleQuizClick = useCallback(() => {
        if (reduxQuiz?.isReady && reduxQuiz?.videoId === videoId) {
            setQuizOpen(true);
        }
    }, [reduxQuiz, videoId]);

    const handleTabChange = useCallback((tab) => {
        setActiveTab(tab);
    }, []);

    const handleLanguageDropdownToggle = useCallback(() => {
        setShowLanguageDropdown(prev => !prev);
    }, []);

    const handleLanguageSelect = useCallback((lang) => {
        setSelectedLanguage(lang);
        setShowLanguageDropdown(false);
    }, []);

    // Memoize quiz state for ActionButtonsBar
    const quizButtonState = useMemo(() => ({
        isReady: reduxQuiz?.isReady && reduxQuiz?.videoId === videoId,
        isLoading: reduxQuiz?.isLoading
    }), [reduxQuiz, videoId]);

    // Stabilize math content for MathJax to avoid typesetting during rapid updates/unmounts
    useEffect(() => {
        if (activeTab !== 'summary') {
            setMathText("");
            return;
        }
        const stable = setTimeout(() => {
            setMathText(cleanSummary || summary || "");
        }, 250);
        return () => clearTimeout(stable);
        // Intentionally depend on cleanSummary and activeTab; summary is covered via cleanSummary sync
    }, [cleanSummary, activeTab, summary, setMathText]);


    return (
        <>
            <div className="bg-black min-h-screen" style={{ background: 'black', backgroundImage: 'none' }}>
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
                {componentsLoaded && <TimeTracker />}
                {componentsLoaded && <NavbarWithSearch />}
                {/* InstallExtension UI disabled per requirement */}
                <div className='relative'>
                    {/* Video Player Section and Controls */}
                    <div className="flex flex-col md:flex-row gap-[20px] mb-[30px] text-white items-start">
                        {/* Video Player Container */}
                        <div className="w-full md:w-[70%] mb-[30px] px-4 md:pl-[50px]">
                            <div className="flex gap-[15px] w-full p-[10px] items-start bg-[#121212] mt-[20px] h-[300px] sm:h-[400px] md:h-[550px] relative">
                                {iframeLoading && <VideoPlayerSkeleton />}
                                <iframe
                                    id="player"
                                    allowFullScreen
                                    loading="lazy"
                                    className={`w-full h-full border-0 ${iframeLoading ? 'opacity-0 absolute' : 'opacity-100'}`}
                                    src={videoUrl}
                                    title="Video player"
                                />
                            </div>
                            <div className="mx-[15px] my-0 px-0 py-[1px]">
                                {videoTitle &&
                                    <h1 className="text-xl sm:text-2xl text-white m-0 py-[10px] font-semibold text-left overflow-hidden text-ellipsis line-clamp-2">{videoTitle}</h1>
                                }
                                {!videoTitle &&
                                    <h1 className="text-xl sm:text-2xl text-white m-0 py-[10px] font-semibold text-left overflow-hidden text-ellipsis line-clamp-2">Video Title</h1>
                                }
                            </div>
                            <ActionButtonsBar
                                onScheduleClick={handleScheduleClick}
                                onPrintClick={handlePrintClick}
                                onQuizClick={handleQuizClick}
                                quizState={quizButtonState.isReady}
                                isQuizDisabled={quizButtonState.isLoading}
                            />
                        </div>

                        {/* Notes Container - Hidden on small screens, shown on medium+ */}
                        <div className="hidden md:block w-[30%] p-[15px] bg-darkBlueGray h-[525px] border border-white mt-[20px] text-white rounded-3xl">
                            <NotesPanel
                                userId={userId}
                                videoId={videoId}
                                className="h-full"
                                textareaClassName="w-full bg-[#0b0b0b] text-[#e5e7eb] border border-white/20 rounded-md p-2 h-[440px] resize-none"
                            />
                        </div>
                    </div>

                    {/* Desktop Layout - Hidden on small screens */}
                    <div className='hidden md:flex gap-0 m-0 justify-between'>
                        <div className='flex flex-col gap-[12px] w-[70%] h-auto relative left-0'>
                            <DesktopTabButtonBar
                                activeTab={activeTab}
                                onTabChange={handleTabChange}
                                selectedLanguage={selectedLanguage}
                                showLanguageDropdown={showLanguageDropdown}
                                onLanguageDropdownToggle={handleLanguageDropdownToggle}
                                languages={LANGUAGES}
                                onLanguageSelect={handleLanguageSelect}
                                languageDropdownRef={languageDropdownRef}
                            />

                            <div className={`w-full h-[580px] bg-darkBlueGray border border-white rounded-md ${activeTab === 'summary' || activeTab === 'description' ? 'overflow-y-auto summary-scroll' : 'overflow-hidden'}`} id={activeTab === 'summary' ? 'summary-container' : undefined}>
                                {activeTab === 'description' ? (
                                    <div className='bg-darkBlueGray rounded-md p-4 h-[580px] text-white'>
                                        <h3 className='text-lg font-semibold mb-4 text-green-400'>Video Description</h3>
                                        <div className='whitespace-pre-wrap text-sm leading-relaxed'>
                                            {videoDescription}
                                        </div>
                                    </div>
                                ) : activeTab === 'summary' ? (
                                    (transcriptFailed && hasAttemptedTranscript && !isTranscriptLoading) ? (
                                        <div className='bg-darkBlueGray rounded-md p-4 h-[580px] text-white flex flex-col items-center justify-center'>
                                            <div className='text-6xl mb-4'>⚠️</div>
                                            <div className='text-lg font-semibold text-red-400 mb-2'>Service Not Available</div>
                                            <div className='text-sm text-gray-400 text-center max-w-md'>
                                                This video's transcript cannot be accessed due to the video owner's permission restrictions.
                                            </div>
                                        </div>
                                    ) : mathText ? (
                                        <MathJaxProvider>
                                            <MathJaxRenderer>
                                                <SummaryFormatter content={mathText} />
                                            </MathJaxRenderer>
                                        </MathJaxProvider>
                                    ) : (
                                        <div className='bg-darkBlueGray rounded-md p-4 h-[580px] text-white flex flex-col items-center justify-center'>
                                            <div className='relative w-16 h-16 mb-4'>
                                                <div className='absolute inset-0 border-4 border-green-400/30 rounded-full'></div>
                                                <div className='absolute inset-0 border-4 border-transparent border-t-green-400 rounded-full animate-spin'></div>
                                            </div>
                                            <div className='text-lg font-semibold text-green-400 mb-2'>Generating Summary</div>
                                            <div className='text-sm text-gray-400'>Please wait while we analyze the video...</div>
                                        </div>
                                    )
                                ) : (
                                    <div className='bg-darkBlueGray rounded-md p-3 h-[580px]'>
                                        {(transcriptFailed && hasAttemptedTranscript && !isTranscriptLoading) ? (
                                            <div className='text-white flex flex-col items-center justify-center h-full'>
                                                <div className='text-6xl mb-4'>⚠️</div>
                                                <div className='text-lg font-semibold text-red-400 mb-2'>Service Not Available</div>
                                                <div className='text-sm text-gray-400 text-center max-w-md'>
                                                    This video's transcript cannot be accessed due to the video owner's permission restrictions.
                                                </div>
                                            </div>
                                        ) : (
                                            <Chatbot userId={userId} videoId={videoId} />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <VideoRecommendation
                            videoId={videoId}
                            userId={userId}
                            recommendations={memoizedRecommendations}
                            transcriptFailed={transcriptFailed && hasAttemptedTranscript && !isTranscriptLoading}
                        />
                    </div>

                    {/* Mobile Layout - Visible only on small screens */}
                    <div className='md:hidden flex flex-col gap-[12px] w-full px-4'>
                        {/* Mobile Toggle Buttons */}
                        <MobileTabButtonBar
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                            selectedLanguage={selectedLanguage}
                            showLanguageDropdown={showLanguageDropdown}
                            onLanguageDropdownToggle={handleLanguageDropdownToggle}
                            languages={LANGUAGES}
                            onLanguageSelect={handleLanguageSelect}
                        />

                        {/* Mobile Content Container */}
                        <div className={`w-full h-[400px] bg-darkBlueGray border border-white rounded-md ${activeTab === 'summary' || activeTab === 'description' ? 'overflow-y-auto summary-scroll' : 'overflow-hidden'}`}>
                            {activeTab === 'description' ? (
                                <div className='bg-darkBlueGray rounded-md p-4 h-[400px] text-white'>
                                    <h3 className='text-lg font-semibold mb-4 text-green-400'>Video Description</h3>
                                    <div className='whitespace-pre-wrap text-sm leading-relaxed'>
                                        {videoDescription}
                                    </div>
                                </div>
                            ) : activeTab === 'summary' ? (
                                (transcriptFailed && hasAttemptedTranscript && !isTranscriptLoading) ? (
                                    <div className='bg-darkBlueGray rounded-md p-4 h-[400px] text-white flex flex-col items-center justify-center'>
                                        <div className='text-6xl mb-4'>⚠️</div>
                                        <div className='text-lg font-semibold text-red-400 mb-2'>Service Not Available</div>
                                        <div className='text-sm text-gray-400 text-center max-w-md px-4'>
                                            This video's transcript cannot be accessed due to the video owner's permission restrictions.
                                        </div>
                                    </div>
                                ) : mathText ? (
                                    <MathJaxProvider>
                                        <MathJaxRenderer>
                                            <SummaryFormatter content={mathText} />
                                        </MathJaxRenderer>
                                    </MathJaxProvider>
                                ) : (
                                    <div className='bg-darkBlueGray rounded-md p-4 h-[400px] text-white flex flex-col items-center justify-center'>
                                        <div className='relative w-16 h-16 mb-4'>
                                            <div className='absolute inset-0 border-4 border-green-400/30 rounded-full'></div>
                                            <div className='absolute inset-0 border-4 border-transparent border-t-green-400 rounded-full animate-spin'></div>
                                        </div>
                                        <div className='text-lg font-semibold text-green-400 mb-2'>Generating Summary</div>
                                        <div className='text-sm text-gray-400'>Please wait while we analyze the video...</div>
                                    </div>
                                )
                            ) : activeTab === 'chatbot' ? (
                                <div className='bg-darkBlueGray rounded-md p-3 h-[400px]'>
                                    {(transcriptFailed && hasAttemptedTranscript && !isTranscriptLoading) ? (
                                        <div className='text-white flex flex-col items-center justify-center h-full'>
                                            <div className='text-6xl mb-4'>⚠️</div>
                                            <div className='text-lg font-semibold text-red-400 mb-2'>Service Not Available</div>
                                            <div className='text-sm text-gray-400 text-center max-w-md px-4'>
                                                This video's transcript cannot be accessed due to the video owner's permission restrictions.
                                            </div>
                                        </div>
                                    ) : (
                                        <Chatbot userId={userId} videoId={videoId} />
                                    )}
                                </div>
                            ) : activeTab === 'recommendations' ? (
                                <div className='bg-darkBlueGray rounded-md p-3 h-[400px] overflow-y-auto'>
                                    {(transcriptFailed && hasAttemptedTranscript && !isTranscriptLoading) ? (
                                        <div className='text-white flex flex-col items-center justify-center h-full'>
                                            <div className='text-6xl mb-4'>⚠️</div>
                                            <div className='text-lg font-semibold text-red-400 mb-2'>Service Not Available</div>
                                            <div className='text-sm text-gray-400 text-center max-w-md px-4'>
                                                This video's transcript cannot be accessed due to the video owner's permission restrictions.
                                            </div>
                                        </div>
                                    ) : (
                                        <VideoRecommendation
                                            videoId={videoId}
                                            userId={userId}
                                            recommendations={memoizedRecommendations}
                                        />
                                    )}
                                </div>
                            ) : activeTab === 'notes' ? (
                                <div className='bg-darkBlueGray rounded-md p-3 h-[400px]'>
                                    <NotesPanel
                                        userId={userId}
                                        videoId={videoId}
                                        textareaClassName="w-full bg-[#0b0b0b] text-[#e5e7eb] border border-white/20 rounded-md p-2 h-[320px] resize-none"
                                    />
                                </div>
                            ) : null}
                        </div>
                    </div>

                </div>
                {quizOpen && (
                    <div className="fixed inset-0 z-[1002] bg-black bg-opacity-70 flex items-center justify-center">
                        <div className="relative bg-white rounded-xl max-w-2xl w-full shadow-lg z-[1003]">
                            {/* Quiz body */}
                            <Quiz quizContent={reduxQuiz?.content || ''} onClose={() => setQuizOpen(false)} videoId={videoId} />
                        </div>
                    </div>
                )}

            </div>
            <InstallExtension open={showInstallExtension} onClose={() => setShowInstallExtension(false)} />
        </>
    )
}

export default Watch