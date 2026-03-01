import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectUserId } from '../../../../store/userSlice';
import { auth } from '@/lib/Firebase';
import { 
    getTokenUsage, 
    getMaxTokens, 
    saveIRTokens as saveIRTokensService,
    saveQuizTokens as saveQuizTokensService,
    recomputeAndSetTotal 
} from '@/services/Tokens';

/**
 * Custom hook to manage token state and operations
 * Centralizes all token-related logic from Watch component
 */
export const useTokenManager = () => {
    const [totalTokens, setTotalTokens] = useState(0);
    const [maxTokens, setMaxTokens] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const reduxUserId = useSelector(selectUserId);

    // Helper to resolve current uid: prefer Redux (authoritative), fall back to Firebase auth if available
    const getCurrentUid = useCallback(() => {
        try {
            if (reduxUserId) return reduxUserId;
            return auth?.currentUser?.uid || "";
        } catch (_) {
            return "";
        }
    }, [reduxUserId]);

    // Fetch token usage and max tokens
    const refreshTokens = useCallback(async (uid = null) => {
        const userId = uid || getCurrentUid();
        if (!userId) {
            setIsLoading(false);
            return { success: false, error: 'No user ID' };
        }

        try {
            const [usage, maxRes] = await Promise.all([
                getTokenUsage(userId).catch(() => null),
                getMaxTokens(userId).catch(() => null)
            ]);

            const tt = Number(usage?.data?.redis?.totalTokens ?? usage?.data?.totalTokens ?? 0);
            const mt = Number(maxRes?.data?.maxTokens ?? 0);

            if (!Number.isNaN(tt)) setTotalTokens(tt);
            if (!Number.isNaN(mt)) setMaxTokens(mt);
            
            setIsLoading(false);
            return { success: true, totalTokens: tt, maxTokens: mt };
        } catch (error) {
            console.error('Error fetching tokens:', error);
            setIsLoading(false);
            return { success: false, error: error.message };
        }
    }, [getCurrentUid]);

    // Fetch token usage and max tokens when redux user changes
    useEffect(() => {
        if (!reduxUserId) {
            setIsLoading(false);
            return;
        }
        refreshTokens(reduxUserId);
    }, [reduxUserId, refreshTokens]);

    // Save IR tokens and refresh total
    const saveIRTokens = useCallback(async (inputTokens) => {
        const uid = getCurrentUid();
        if (!uid || inputTokens <= 0) return { success: false };

        try {
            await saveIRTokensService(uid, inputTokens);
            await recomputeAndSetTotal(uid);
            
            // Refresh UI state
            const result = await refreshTokens(uid);
            return { success: true, ...result };
        } catch (error) {
            console.error('Error saving IR tokens:', error);
            return { success: false, error: error.message };
        }
    }, [getCurrentUid, refreshTokens]);

    // Save Quiz tokens and refresh total
    const saveQuizTokens = useCallback(async (outputTokens) => {
        const uid = getCurrentUid();
        if (!uid || outputTokens <= 0) return { success: false };

        try {
            await saveQuizTokensService(uid, outputTokens);
            await recomputeAndSetTotal(uid);
            
            // Refresh UI state
            const result = await refreshTokens(uid);
            return { success: true, ...result };
        } catch (error) {
            console.error('Error saving quiz tokens:', error);
            return { success: false, error: error.message };
        }
    }, [getCurrentUid, refreshTokens]);

    // Computed values
    const remainingTokens = useMemo(() => {
        return Math.max(0, maxTokens - totalTokens);
    }, [maxTokens, totalTokens]);

    const hasEnoughTokens = useCallback((requiredTokens) => {
        return remainingTokens >= requiredTokens;
    }, [remainingTokens]);

    const tokenPercentageUsed = useMemo(() => {
        if (maxTokens === 0) return 0;
        return Math.min(100, (totalTokens / maxTokens) * 100);
    }, [totalTokens, maxTokens]);

    return {
        // State
        totalTokens,
        maxTokens,
        remainingTokens,
        isLoading,
        
        // Computed
        tokenPercentageUsed,
        
        // Methods
        getCurrentUid,
        refreshTokens,
        saveIRTokens,
        saveQuizTokens,
        hasEnoughTokens,
        
        // Setters (for direct updates if needed)
        setTotalTokens,
        setMaxTokens,
    };
};

export default useTokenManager;
