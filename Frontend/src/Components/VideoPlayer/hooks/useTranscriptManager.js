import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { saveTranscript } from '@/services/videoPlayerServices';
import { isExtensionAvailable } from '@/utils/ExtensionCheck';

/**
 * Custom hook to manage video transcript fetching and formatting
 * Handles transcript retrieval, caching, and extension availability
 */
export const useTranscriptManager = (videoId) => {
    const [transcript, setTranscript] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showInstallExtension, setShowInstallExtension] = useState(false);
    const [transcriptFailed, setTranscriptFailed] = useState(false);
    const reduxVideoId = useSelector(state => state.videoPlayer.videoId);

    /**
     * Build transcript entries in the format needed for IR analysis
     * @param {Array} transcriptData - Raw transcript data
     * @returns {Array} Formatted entries with start, end, text
     */
    const buildTranscriptEntries = useCallback((transcriptData) => {
        if (!transcriptData || !Array.isArray(transcriptData)) return [];
        
        return transcriptData.map(entry => ({
            start: entry.start,
            end: entry.end,
            text: entry.text
        }));
    }, []);

    /**
     * Fetch video transcript from cache or extension
     * @param {string} videoIdParam - Optional video ID override
     * @returns {Promise<Array|null>} Transcript array or null
     */
    const fetchVideoTranscript = useCallback(async (videoIdParam = null) => {
        try {
            const idToUse = videoIdParam || reduxVideoId || videoId;
            if (!idToUse) return null;

            setIsLoading(true);
            setError(null);
            setTranscriptFailed(false);

            const { getTranscriptCacheFirst } = await import('@/utils/transcriptClient');

            // Retry a few times to allow backend Redis client to initialize after refresh
            const maxAttempts = 3;
            const delayMs = 300;
            
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                const result = await getTranscriptCacheFirst(idToUse);
                console.log(`[useTranscriptManager] Transcript fetch attempt ${attempt}/${maxAttempts} for video ${idToUse}:`, result);
                
                // Extension availability handshake removed; do not toggle UI
                if (result?.transcript && Array.isArray(result.transcript) && result.transcript.length > 0) {
                    // Best-effort: ensure transcript is cached in backend/Redis
                    try {
                        await saveTranscript(idToUse, result.transcript);
                    } catch (_) { /* non-fatal */ }
                    
                    setTranscript(result.transcript);
                    setIsLoading(false);
                    return result.transcript;
                }
                
                // If no transcript returned in this attempt, on the final attempt check extension availability
                if (attempt === maxAttempts) {
                    try {
                        const ok = await isExtensionAvailable(4000);
                        if (!ok) setShowInstallExtension(true);
                    } catch (_) {
                        setShowInstallExtension(true);
                    }
                }
                
                if (attempt < maxAttempts) {
                    await new Promise((r) => setTimeout(r, delayMs));
                }
            }
            
            // All attempts failed
            setTranscriptFailed(true);
            setIsLoading(false);
            return null;
        } catch (err) {
            console.error('Error fetching transcript:', err);
            setError(err.message);
            setIsLoading(false);
            return null;
        }
    }, [reduxVideoId, videoId]);

    /**
     * Get formatted transcript entries ready for analysis
     */
    const formattedEntries = useMemo(() => {
        if (!transcript) return [];
        return buildTranscriptEntries(transcript);
    }, [transcript, buildTranscriptEntries]);

    // Auto-fetch transcript when videoId changes
    useEffect(() => {
        const idToUse = reduxVideoId || videoId;
        if (idToUse) {
            fetchVideoTranscript(idToUse);
        }
    }, [reduxVideoId, videoId, fetchVideoTranscript]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            setTranscript(null);
            setError(null);
        };
    }, []);

    return {
        // State
        transcript,
        formattedEntries,
        isLoading,
        error,
        showInstallExtension,
        transcriptFailed,
        
        // Methods
        fetchVideoTranscript,
        buildTranscriptEntries,
        
        // Setters
        setShowInstallExtension,
        setTranscript
    };
};

export default useTranscriptManager;
