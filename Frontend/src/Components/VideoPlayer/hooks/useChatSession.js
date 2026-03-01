import { useRef, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectSessionByVideoId as selectChatSessionByVideoId, setSession as setChatSession, setHistory as setChatHistory } from './../../../../store/ChatBotSlice';
import { selectChunkCount } from '../../../../store/videoplayerSlice';
import { checkStorageStatus } from '@/pythonServices/VideoPlayerServices';

/**
 * Custom hook for managing chat session initialization
 * - Provides manual trigger function to initialize chat
 * - Should be called from parent after IR is available + 2s delay
 * - Loads chat history after initialization
 */
export const useChatSession = (
    videoId,
    userId,
    canInitChat,
    hasIR,
    isIRCached
) => {
    const dispatch = useDispatch();
    const chatSession = useSelector((state) => selectChatSessionByVideoId(state, videoId));
    const chunkCount = useSelector(selectChunkCount);
    const chatInitTriggeredRef = useRef(false);
    const videoIdRef = useRef(videoId);

    // Reset initialization flag and update videoIdRef on video change
    useEffect(() => {
        chatInitTriggeredRef.current = false;
        videoIdRef.current = videoId;
    }, [videoId]);

    /**
     * Manually trigger chat initialization
     * Should be called from parent component after IR is ready + 2s delay
     */
    const initializeChatSession = useCallback(async () => {
        if (!videoId || !userId) {
            // console.log('[useChatSession] Missing videoId or userId');
            return;
        }
        if (chatInitTriggeredRef.current) {
            // console.log('[useChatSession] Chat already initialized');
            return;
        }
        if (!hasIR || !hasIR()) {
            // console.log('[useChatSession] IR not available yet');
            return;
        }

        // console.log('[useChatSession] Initializing chat session...');
        chatInitTriggeredRef.current = true;

        if (!isIRCached && chunkCount > 0) {
            // Poll for storage status until chunk count matches (max 30 retries, ~1 min)
            let retries = 0;
            const maxRetries = 30;
            // console.log(`[useChatSession] Starting polling. Target chunkCount: ${chunkCount}`);

            while (retries < maxRetries) {
                try {
                    // Stop polling if videoId has changed
                    if (videoIdRef.current !== videoId) {
                        // console.log(`[useChatSession] Stopping stale polling for ${videoId}`);
                        return;
                    }

                    const status = await checkStorageStatus(videoId);
                    // console.log(`[useChatSession] Poll ${retries + 1}: status=${status?.count || 0}/${chunkCount}`);
                    if (status && status.count >= chunkCount) {
                        break;
                    }
                } catch (e) {
                    console.error("Storage check failed", e);
                }
                retries++;
                if (retries < maxRetries) {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
            if (retries >= maxRetries) {
                console.warn(`[useChatSession] Storage polling timed out after ${maxRetries} retries`);
            }
        }

        try {
            // Step 1: Call init endpoint directly (without auto-fetching history)
            const response = await fetch(`${await import('@/lib/server').then(m => m.CHATBOT_URL)}/chat/init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, video_id: videoId })
            });

            if (!response.ok) {
                console.error('[useChatSession] Chat init failed:', response.status);
                chatInitTriggeredRef.current = false; // Allow retry
                return;
            }

            const initData = await response.json();
            // console.log('[useChatSession] Init response:', initData);

            if (initData?.chat_id) {
                // Step 2: Directly fetch history without checking storage info
                let history = [];
                try {
                    const histResp = await fetch(`${await import('@/lib/server').then(m => m.CHATBOT_URL)}/chat/history/${encodeURIComponent(initData.chat_id)}?limit=50`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (histResp.ok) {
                        const histData = await histResp.json();
                        history = histData?.history || [];
                    }
                } catch (_) { /* ignore history errors */ }

                // Step 3: Dispatch to Redux after everything is ready
                dispatch(setChatSession({ videoId: videoId, chatId: initData.chat_id }));
                const formatted = Array.isArray(history) ? history.map(m => ({
                    role: m.role,
                    content: m.content || '',
                    attachments: m.attachments || [],
                    timestamp: m.timestamp,
                    message_id: m.message_id
                })) : [];
                dispatch(setChatHistory({ videoId: videoId, messages: formatted }));
                // console.log('[useChatSession] Chat session initialized successfully');
            }
        } catch (error) {
            console.error('[useChatSession] Chat initialization error:', error);
            chatInitTriggeredRef.current = false; // Allow retry
        }
    }, [videoId, userId, hasIR, isIRCached, chunkCount, dispatch]);

    return {
        chatSession,
        chatInitTriggeredRef,
        initializeChatSession
    };
};
