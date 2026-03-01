import api from '@/utils/api';

// Save IR token usage
export const saveIRTokens = async (uid, tokens) => {
    try {
        const res = await api.post('/api/tokens/ir', { uid, tokens });
        return res.data;
    } catch (error) {
        // console.error('Failed to save IR tokens:', error);
        throw error;
    }
};

// Save chatbot token usage (incremental)
export const saveChatbotTokens = async (uid, tokens) => {
    try {
        const res = await api.post('/api/tokens/chatbot', { uid, tokens });
        return res.data;
    } catch (error) {
        // console.error('Failed to save chatbot tokens:', error);
        throw error;
    }
};

// Save quiz token usage
export const saveQuizTokens = async (uid, tokens) => {
    try {
        const res = await api.post('/api/tokens/quiz', { uid, tokens });
        return res.data;
    } catch (error) {
        // console.error('Failed to save quiz tokens:', error);
        throw error;
    }
};

// Save total token usage
// Override total tokens (absolute set) — uses update-all to avoid accidental increments
export const saveTotalTokens = async (uid, tokens) => {
    try {
        const res = await api.post('/api/tokens/update-all', { uid, totalTokens: tokens });
        return res.data;
    } catch (error) {
        // console.error('Failed to set total tokens:', error);
        throw error;
    }
};

// Get token usage snapshot for a user
export const getTokenUsage = async (uid) => {
    try {
        const res = await api.get(`/api/tokens/${encodeURIComponent(uid)}`);
        return res.data;
    } catch (error) {
        // console.error('Failed to fetch token usage:', error);
        throw error;
    }
};

// Get user's MaxTokens (limit) from backend (Redis-first with Firestore fallback)
export const getMaxTokens = async (uid) => {
    try {
        const res = await api.get(`/api/tokens/max/${encodeURIComponent(uid)}`);
        return res.data;
    } catch (error) {
        // console.error('Failed to fetch MaxTokens:', error);
        throw error;
    }
};

// Recompute totalTokens as the sum of quizTokens + irTokens + chatBotTokens and set it
export const recomputeAndSetTotal = async (uid) => {
    try {
        const usage = await getTokenUsage(uid);
        const r = usage?.data?.redis || {};
        const quiz = Number(r.quizTokens || 0);
        const ir = Number(r.irTokens || 0);
        const chat = Number(r.chatBotTokens || 0);
        const sum = [quiz, ir, chat].reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
        return await saveTotalTokens(uid, sum);
    } catch (error) {
        // console.error('Failed to recompute and set total tokens:', error);
        throw error;
    }
};


