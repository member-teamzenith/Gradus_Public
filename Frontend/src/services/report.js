import api from "@/lib/axios";

/**
 * Send bug report to backend
 * @param {Object} reportData - Report data
 * @param {string} reportData.userEmail - User's email address
 * @param {string} reportData.description - Issue description
 * @param {string} [reportData.screenshot] - Screenshot in base64 format
 * @param {string} [reportData.url] - Current page URL
 * @param {string} [reportData.timestamp] - Report timestamp
 * @returns {Promise<Object>} Send response
 */
export const sendBugReport = async (reportData) => {
    try {
        const response = await api.post('/send-report', reportData);
        return response.data;
    } catch (error) {
        console.error('Error sending bug report:', error);
        throw error;
    }
};
