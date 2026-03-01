import api from "@/lib/axios";
import { setUser, updateUserFields, setUserDetails, updateUserDetailsFields } from "../../store/userSlice";

/**
 * Seed Redux user from Firebase auth and backend details if Redux user is missing.
 * Safe to call repeatedly; no-ops if reduxUser already exists or auth.currentUser is absent.
 *
 * @param {Object} params
 * @param {Object|null} params.reduxUser - Current user from Redux (selectUser)
 * @param {import('firebase/auth').Auth} params.auth - Firebase auth instance
 * @param {Function} params.dispatch - Redux dispatch
 * @returns {Promise<boolean>} true if we dispatched a seed; false if no action taken
 */
export const seedUserInReduxIfMissing = async ({ reduxUser, auth, dispatch }) => {
    try {
        const hasCoreUser = !!(reduxUser && reduxUser.uid);
        const needsEnrichment = hasCoreUser && (!reduxUser.photoURL || !reduxUser.displayName || !reduxUser.email);
        if (hasCoreUser && !needsEnrichment) return false; // Already present and enriched
        const authUser = auth?.currentUser;
        if (!authUser) return false; // Nothing to seed from

        // Try to fetch backend-enriched details
        let details = null;
        try {
            const res = await fetchUserDetails(authUser.uid);
            details = res?.data ? res.data : res;
        } catch (_) { /* ignore fetch errors; we'll seed from auth only */ }

        // Helper to pick value from multiple possible keys
        const pick = (obj, keys) => {
            if (!obj) return undefined;
            for (const k of keys) {
                if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).length > 0) return obj[k];
            }
            return undefined;
        };

        const detailName = pick(details, ['displayName', 'name']);
        const detailEmail = pick(details, ['email']);
        const detailPhoto = pick(details, ['photoURL', 'photo', 'avatar', 'profilePic', 'profilePhoto', 'image', 'picture', 'photo(pin)']);

        // Build normalized base user
        const base = {
            uid: authUser.uid,
            email: authUser.email || detailEmail || null,
            emailVerified: !!authUser.emailVerified,
            displayName: authUser.displayName || detailName || null,
            photoURL: authUser.photoURL || detailPhoto || null,
        };
        if (!hasCoreUser) {
            dispatch(setUser(base));
        } else if (needsEnrichment) {
            // Only update missing fields
            const patchUser = {};
            if (!reduxUser.displayName && base.displayName) patchUser.displayName = base.displayName;
            if (!reduxUser.photoURL && base.photoURL) patchUser.photoURL = base.photoURL;
            if (!reduxUser.email && base.email) patchUser.email = base.email;
            if (Object.keys(patchUser).length > 0) dispatch(updateUserFields(patchUser));
        }

        // Persist backend details for consumers that want full profile in Redux
        if (details) {
            dispatch(setUserDetails(details));
        }

        // Patch with fresher backend fields if they differ
        if (details) {
            const patch = {};
            const currentDisplay = hasCoreUser ? (reduxUser.displayName || base.displayName || '') : (base.displayName || '');
            const currentPhoto = hasCoreUser ? (reduxUser.photoURL || base.photoURL || '') : (base.photoURL || '');
            const currentEmail = hasCoreUser ? (reduxUser.email || base.email || '') : (base.email || '');
            if (detailName && detailName !== currentDisplay) patch.displayName = detailName;
            if (detailPhoto && detailPhoto !== currentPhoto) patch.photoURL = detailPhoto;
            if (detailEmail && detailEmail !== currentEmail) patch.email = detailEmail;
            if (Object.keys(patch).length > 0) dispatch(updateUserFields(patch));
        }
        return true;
    } catch (_) {
        return false;
    }
};

/**
 * Fetch user details by user ID
 * @param {string} uid - User ID
 * @returns {Promise<Object>} User details object
 */
export const fetchUserDetails = async (uid) => {
    try {
        const response = await api.get(`/user-details/${uid}`);
        return response.data;
    } catch (error) {
        // Surface 404 so callers can distinguish "user not found" from "missing fields"
        if (error?.response?.status === 404) {
            throw error;
        }
        console.error("Error fetching user details:", error);
        throw error;
    }
};


/**
 * Fetch user notes (videoId and content)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Notes data object with videoId as keys
 */
export const fetchUserNotes = async (userId) => {
    try {
        const response = await api.get(`/user-notes/${userId}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching user notes:", error);
        throw error;
    }
};

/**
 * Fetch user activity data
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Activity data
 */
export const fetchUserActivity = async (userId) => {
    try {
        const response = await api.get(`/user-activity/${userId}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching user activity:", error);
        throw error;
    }
};

/**
 * Update user activity data and statistics
 * @param {Object} data - Activity data
 * @param {string} data.userId - User ID
 * @param {Object} data.activityData - Activity data object
 * @param {Object} [data.stats] - Statistics object
 * @returns {Promise<Object>} Update response
 */
export const updateUserActivity = async (data) => {
    try {
        const response = await api.post("/update-activity", data);
        return response.data;
    } catch (error) {
        console.error("Error updating user activity:", error);
        throw error;
    }
};

/**
 * Update user time for today (simplified version for TimeTracker)
 * @param {string} userId - User ID
 * @param {number} timeSpent - Time spent in minutes
 * @returns {Promise<Object>} Update response
 */
export const updateUserTime = async (userId, timeSpent) => {
    try {
        const response = await api.post("/update-user-time", {
            userId,
            timeSpent
        });
        return response.data;
    } catch (error) {
        console.error("Error updating user time:", error);
        throw error;
    }
};

/**
 * Manually update user statistics
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Update response
 */
export const updateUserStats = async (userId) => {
    try {
        const response = await api.post(`/update-user-stats/${userId}`);
        return response.data;
    } catch (error) {
        console.error("Error updating user stats:", error);
        throw error;
    }
};

/**
 * Test Redis connection for a user
 * @param {string} uid - User ID
 * @returns {Promise<Object>} Test response
 */
export const testRedisConnection = async (uid) => {
    try {
        const response = await api.get(`/test-redis/${uid}`);
        return response.data;
    } catch (error) {
        console.error("Error testing Redis connection:", error);
        throw error;
    }
};

/**
 * Check both FirstFlame and BugHunter badge status for a user
 * @param {string} uid - User ID
 * @returns {Promise<Object>} Badges status response
 */
export const checkBadges = async (uid) => {
    try {
        const response = await api.get(`/check-badges/${uid}`);
        return response.data;
    } catch (error) {
        console.error("Error checking badges status:", error);
        throw error;
    }
};