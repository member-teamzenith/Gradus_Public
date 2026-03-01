import api from "@/lib/axios";

/**
 * Fetch all video queries/categories for a user
 * @param {string} uid - User ID
 * @returns {Promise<Object>} Object containing queries for video categories
 */
export const fetchAllVideos = async (uid) => {
    try {
        const response = await api.get(`/fetchAllVideos/${uid}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching all videos:", error);
        throw error;
    }
};
