import api from "@/lib/axios";

/**
 * Register a new user
 * @param {string} uid - User ID
 * @param {string} email - User email
 * @returns {Promise<Object>} Registration response
 */
export const registerUser = async (uid, email) => {
    try {
        const response = await api.post("/register", {
            uid,
            email,
            personalDetailsAdded: false
        });
        return response.data;
    } catch (error) {
        console.error("Error registering user:", error);
        throw error;
    }
};

/**
 * Update user personal details
 * @param {Object} data - Personal details data
 * @param {string} data.uid - User ID
 * @param {string} data.name - User name
 * @param {string} data.gender - User gender
 * @param {string} data.age - User age
 * @param {string} data.email - User email
 * @param {string} data.photo - User photo URL
 * @returns {Promise<Object>} Update response
 */
export const updatePersonalDetails = async (data) => {
    try {
        const response = await api.post("/personal-details", data);
        return response.data;
    } catch (error) {
        console.error("Error updating personal details:", error);
        throw error;
    }
};

/**
 * Update user course and interest preferences
 * @param {Object} data - Course interest data
 * @param {string} data.uid - User ID
 * @param {boolean} data.hasCourse - Whether user selected course option
 * @param {boolean} data.hasInterests - Whether user selected interests option
 * @returns {Promise<Object>} Update response
 */
export const updateCourseInterest = async (data) => {
    try {
        const response = await api.post("/course-interest", data);
        return response.data;
    } catch (error) {
        console.error("Error updating course interest:", error);
        throw error;
    }
};

/**
 * Get user course and interest preferences
 * @param {string} uid - User ID
 * @returns {Promise<Object>} Course interest data with hasCourse, hasInterests flags, subjects, exams, and interests arrays
 */
export const getCourseInterest = async (uid) => {
    try {
        const response = await api.get(`/course-interest/${uid}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching course interest:", error);
        throw error;
    }
};

/**
 * Update user course selection
 * @param {Object} data - Course selection data
 * @param {string} data.uid - User ID
 * @param {string} data.course - Selected course
 * @returns {Promise<Object>} Update response
 */
export const updateCourseSelection = async (data) => {
    try {
        const response = await api.post("/course-selection", data);
        return response.data;
    } catch (error) {
        console.error("Error updating course selection:", error);
        throw error;
    }
};

/**
 * Update user academic preferences (subjects and exams)
 * @param {Object} data - Academic preferences data
 * @param {string} data.uid - User ID
 * @param {Array<string>} data.subjects - Selected subjects
 * @param {Array<string>} data.exams - Selected exams
 * @returns {Promise<Object>} Update response
 */
export const updateAcademicPreferences = async (data) => {
    try {
        const response = await api.post("/academic-preferences", data);
        return response.data;
    } catch (error) {
        console.error("Error updating academic preferences:", error);
        throw error;
    }
};

/**
 * Update user interests
 * @param {Object} data - Interests data
 * @param {string} data.uid - User ID
 * @param {Array<string>} data.interests - Selected interests
 * @returns {Promise<Object>} Update response
 */
export const updateInterests = async (data) => {
    try {
        const response = await api.post("/interests", data);
        return response.data;
    } catch (error) {
        console.error("Error updating interests:", error);
        throw error;
    }
};

/**
 * Get available avatars
 * @returns {Promise<Array>} Array of avatar URLs
 */
export const getAvatars = async () => {
    try {
        const response = await api.get("/avatars");
        return response.data.avatars;
    } catch (error) {
        console.error("Error fetching avatars:", error);
        throw error;
    }
};

