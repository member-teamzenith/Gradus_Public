import api from "@/lib/axios";

/**
 * Save transcript to backend cache
 * @param {string} videoId - Video ID
 * @param {Array} transcript - Transcript data
 * @returns {Promise<Object>} Save response
 */
export const saveTranscript = async (videoId, transcript) => {
    try {
        const response = await api.post(`/transcript/${encodeURIComponent(videoId)}`, {
            transcript
        });
        return response.data;
    } catch (error) {
        console.error("Error saving transcript:", error);
        throw error;
    }
};

/**
 * Fetch video summary from backend
 * @param {string} videoId - Video ID
 * @returns {Promise<Object>} Summary data
 */
export const fetchVideoSummary = async (videoId) => {
    try {
        const response = await api.get(`/summary/${videoId}`);
        return response.data;
    } catch (error) {
        // Handle 404 responses gracefully - return the error response data
        if (error.response && error.response.status === 404) {
            return error.response.data;
        }
        console.error("Error fetching video summary:", error);
        throw error;
    }
};

/**
 * Get cached IR (Information Retrieval) data
 * @param {string} videoId - Video ID
 * @returns {Promise<Object>} IR data
 */
export const getCachedIR = async (videoId) => {
    try {
        const response = await api.get(`/ir/${encodeURIComponent(videoId)}`);
        return response.data;
    } catch (error) {
        // Handle 404 responses gracefully - return the error response data
        if (error.response && error.response.status === 404) {
            return error.response.data;
        }
        console.error("Error fetching cached IR:", error);
        throw error;
    }
};

/**
 * Save IR data to backend cache
 * @param {string} videoId - Video ID
 * @param {string} ir - IR content
 * @returns {Promise<Object>} Save response
 */
export const saveIR = async (videoId, ir) => {
    try {
        // Backend expects IR as an object with 'content' field
        const irPayload = typeof ir === 'string' ? { content: ir } : ir;
        const response = await api.post(`/ir/${encodeURIComponent(videoId)}`, {
            ir: irPayload
        });
        return response.data;
    } catch (error) {
        console.error("Error saving IR:", error);
        throw error;
    }
};

/**
 * Get user note for a specific video
 * @param {string} userId - User ID
 * @param {string} videoId - Video ID
 * @returns {Promise<Object>} Note data
 */
export const getUserNote = async (userId, videoId) => {
    try {
        const response = await api.get(`/get-note/${userId}/${videoId}`);
        return response.data;
    } catch (error) {
        // Handle 404 responses gracefully - return empty note data
        if (error.response && error.response.status === 404) {
            return { note: null, message: 'No note for this video' };
        }
        console.error("Error fetching user note:", error);
        throw error;
    }
};

/**
 * Save user note for a specific video
 * @param {string} userId - User ID
 * @param {string} videoId - Video ID
 * @param {string} content - Note content
 * @returns {Promise<Object>} Save response
 */
export const saveUserNote = async (userId, videoId, content) => {
    try {
        const response = await api.post("/save-note", {
            userId,
            videoId,
            content
        });
        return response.data;
    } catch (error) {
        console.error("Error saving user note:", error);
        throw error;
    }
};

/**
 * Save summary to backend database
 * @param {string} videoId - Video ID
 * @param {string} summary - Summary content
 * @returns {Promise<Object>} Save response
 */
export const saveSummaryToDb = async (videoId, summary) => {
    try {
        const response = await api.post(`/summary/${videoId}`, {
            summary
        });
        return response.data;
    } catch (error) {
        console.error("Error saving summary to database:", error);
        throw error;
    }
};

/**
 * Save recommendations to backend cache
 * @param {string} videoId - Video ID
 * @param {Object} recommendations - Recommendations object
 * @returns {Promise<Object>} Save response
 */
export const saveRecommendations = async (videoId, recommendations) => {
    try {
        const response = await api.post(`/recommendations/${encodeURIComponent(videoId)}`, {
            recommendations
        });
        return response.data;
    } catch (error) {
        console.error("Error saving recommendations:", error);
        throw error;
    }
};

/**
 * Get cached recommendations from backend
 * @param {string} videoId - Video ID
 * @returns {Promise<Object>} Recommendations data
 */
export const getCachedRecommendations = async (videoId) => {
    try {
        const response = await api.get(`/recommendations/${encodeURIComponent(videoId)}`);
        return response.data;
    } catch (error) {
        // Handle 404 responses gracefully - return the error response data
        if (error.response && error.response.status === 404) {
            return error.response.data;
        }
        console.error("Error fetching cached recommendations:", error);
        throw error;
    }
};