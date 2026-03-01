import { useState, useEffect } from 'react';

/**
 * Custom hook to manage video metadata (title and description)
 * Fetches data from YouTube oEmbed API and transcriptClient
 */
export const useVideoMetadata = (videoId) => {
    const [videoTitle, setVideoTitle] = useState('Loading...');
    const [videoDescription, setVideoDescription] = useState('');
    const [isLoadingTitle, setIsLoadingTitle] = useState(true);
    const [isLoadingDescription, setIsLoadingDescription] = useState(true);
    const [error, setError] = useState(null);

    // Fetch video title via YouTube oEmbed (no API key required)
    useEffect(() => {
        if (!videoId) {
            setIsLoadingTitle(false);
            return;
        }

        let cancelled = false;
        
        async function fetchTitle() {
            try {
                setIsLoadingTitle(true);
                setError(null);
                
                const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
                const res = await fetch(oembedUrl);
                
                if (!res.ok) {
                    if (!cancelled) {
                        setVideoTitle('Video Title Not Available');
                        setIsLoadingTitle(false);
                    }
                    return;
                }
                
                const data = await res.json();
                if (!cancelled) {
                    setVideoTitle(data?.title || 'Video Title Not Available');
                    setIsLoadingTitle(false);
                }
            } catch (err) {
                if (!cancelled) {
                    setVideoTitle('Video Title Not Available');
                    setError(err.message);
                    setIsLoadingTitle(false);
                }
            }
        }
        
        fetchTitle();
        
        return () => {
            cancelled = true;
        };
    }, [videoId]);

    // Fetch video description from metadata
    useEffect(() => {
        if (!videoId) {
            setIsLoadingDescription(false);
            return;
        }

        let cancelled = false;
        
        (async () => {
            try {
                setIsLoadingDescription(true);
                
                const { getMetadataCacheFirst } = await import('@/utils/transcriptClient');
                const meta = await getMetadataCacheFirst(videoId);
                
                if (!cancelled) {
                    setVideoDescription(meta?.description || 'No description available');
                    setIsLoadingDescription(false);
                }
            } catch (err) {
                if (!cancelled) {
                    setVideoDescription('No description available');
                    setError(err.message);
                    setIsLoadingDescription(false);
                }
            }
        })();
        
        return () => {
            cancelled = true;
        };
    }, [videoId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            setVideoTitle('Loading...');
            setVideoDescription('');
        };
    }, []);

    return {
        videoTitle,
        videoDescription,
        isLoadingTitle,
        isLoadingDescription,
        isLoading: isLoadingTitle || isLoadingDescription,
        error,
        // Setters if needed for manual updates
        setVideoTitle,
        setVideoDescription
    };
};

export default useVideoMetadata;
