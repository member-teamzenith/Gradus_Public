import { createSlice } from '@reduxjs/toolkit';

// We store minimal auth user info needed across the app
// Avoid putting secrets or tokens in Redux; just uid, email, name, photo, etc.
const initialState = {
	user: null, // { uid, email, displayName, photoURL, emailVerified }
	details: null, // Full backend user details (age, gender, streaks, etc.)
};

const userSlice = createSlice({
	name: 'user',
	initialState,
	reducers: {
		setUser: (state, action) => {
			// Accept a partial user object and normalize keys
			const u = action.payload || null;
			if (!u) {
				state.user = null;
				return;
			}
			state.user = {
				uid: u.uid || u.id || null,
				email: u.email || null,
				displayName: u.displayName || u.name || null,
				photoURL: u.photoURL || u.photo || null,
				emailVerified: Boolean(u.emailVerified),
			};
		},
		clearUser: (state) => {
			state.user = null;
		},
		updateUserFields: (state, action) => {
			if (state.user && action.payload && typeof action.payload === 'object') {
				state.user = { ...state.user, ...action.payload };
			}
		},
		setUserDetails: (state, action) => {
			state.details = action.payload || null;
		},
		updateUserDetailsFields: (state, action) => {
			if (state.details && action.payload && typeof action.payload === 'object') {
				state.details = { ...state.details, ...action.payload };
			}
		},
	},
});

export const { setUser, clearUser, updateUserFields, setUserDetails, updateUserDetailsFields } = userSlice.actions;

// Selectors
export const selectUser = (state) => state?.user?.user || null;
export const selectUserId = (state) => state?.user?.user?.uid || '';
export const selectUserDetails = (state) => state?.user?.details || null;

export default userSlice.reducer;
