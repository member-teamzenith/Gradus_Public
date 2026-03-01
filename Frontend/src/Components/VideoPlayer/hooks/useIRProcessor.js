import { useState, useRef, useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setChunkCount } from '../../../../store/videoplayerSlice';
import { getCachedIR, saveIR } from '@/services/videoPlayerServices';
import { analyzeTranscript } from '@/pythonServices/VideoPlayerServices';

/**
 * Custom hook for handling IR (Intermediate Representation) processing
 * - Manages IR state and caching
 * - Analyzes transcripts to generate IR
 * - Handles token budget checks
 * - Manages chat initialization timing
 */
export const useIRProcessor = (
    videoId,
    videoTitle,
    videoDescription
) => {
    const dispatch = useDispatch();
    const irRef = useRef(null);
    const initDelayScheduledRef = useRef(false);
    const [canInitChat, setCanInitChat] = useState(false);

    // Reset state when video changes
    useEffect(() => {
        irRef.current = null;
        initDelayScheduledRef.current = false;
        setCanInitChat(false);
    }, [videoId]);

    /**
     * Get cached IR data from the server
     */
    const getCachedIRData = useCallback(async (id) => {
        try {
            const data = await getCachedIR(id);
            return data?.ir || null;
        } catch (_) {
            return null;
        }
    }, []);

    /**
     * Analyze transcript entries to generate IR
     * - Trims transcript to array format
     * - Checks token budget
     * - Calls Python analyze endpoint
     * - Saves IR to cache
     * - Schedules chat initialization
     */
    const analyzeToIR = useCallback(async (entries, id) => {
        try {
            // Trim transcript to array format: [start, end, text]
            const trimmedEntries = Array.isArray(entries)
                ? entries.map((entry) => [entry.start, entry.end, entry.text])
                : [];

            // Console log the full transcript as a single array preserving structure (stringified to avoid console grouping)
            try {
                // eslint-disable-next-line no-console

            } catch (_) { /* ignore console errors */ }

            // Fetch metadata from transcriptClient to get actual title and description
            let actualTitle = videoTitle || 'Untitled Video';
            let actualDescription = videoDescription || '';

            try {
                const { getMetadataCacheFirst } = await import('@/utils/transcriptClient');
                const metadata = await getMetadataCacheFirst(id);
                if (metadata?.title) {
                    actualTitle = metadata.title;
                }
                if (metadata?.description) {
                    actualDescription = metadata.description;
                }
            } catch (_) {
                // Use defaults if metadata fetch fails
            }

            // Console log the data being sent to analyze endpoint


            // Analyze transcript if we have entries
            let irResponse = null;
            if (trimmedEntries.length > 0) {
                try {
                    irResponse = await analyzeTranscript(trimmedEntries, id);
                } catch (_) {
                    irResponse = null;
                }
            }
            const ir = irResponse?.content || null;

            if (irResponse?.chunk_count) {
                dispatch(setChunkCount(irResponse.chunk_count));
            }

            if (ir) {
                try {
                    // Save IR content string (matches what test_interface.html uses)
                    await saveIR(id, ir);
                } catch (error) {

                }
            }

            // Wait 2s then allow init
            if (!initDelayScheduledRef.current) {
                initDelayScheduledRef.current = true;
                setTimeout(() => setCanInitChat(true), 2000);
            }
            return ir;
        } catch (_) {
            return null;
        }
    }, [videoTitle, videoDescription]);

    /**
     * Get IR from ref (current cached value)
     */
    const getIR = useCallback(() => {
        return irRef.current;
    }, []);

    /**
     * Set IR in ref (for external updates)
     */
    const setIR = useCallback((ir) => {
        irRef.current = ir;
    }, []);

    /**
     * Check if IR exists
     */
    const hasIR = useCallback(() => {
        return !!irRef.current;
    }, []);

    return {
        // State
        canInitChat,

        // Methods
        getCachedIRData,
        analyzeToIR,
        getIR,
        setIR,
        hasIR
    };
};
