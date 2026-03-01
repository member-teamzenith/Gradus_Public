const { createSlice } = require("@reduxjs/toolkit");

const initialState = {
    query: "",
    videos: [],
    categorizedVideos: {} // Add categorized videos for home page caching
};

const homeSlice = createSlice({
    name: 'home',
    initialState,
    reducers: {
        setSearchState: (state, action) => {
            const { query, videos } = action.payload || {};
            state.query = typeof query === 'string' ? query : "";
            state.videos = Array.isArray(videos) ? videos : [];
        },
        clearSearchState: (state) => {
            state.query = "";
            state.videos = [];
        },
        setCategorizedVideos: (state, action) => {
            // Store categorized videos { category: [videos] }
            state.categorizedVideos = action.payload || {};
        },
        clearCategorizedVideos: (state) => {
            state.categorizedVideos = {};
        }
    }
});

export const { setSearchState, clearSearchState, setCategorizedVideos, clearCategorizedVideos } = homeSlice.actions;
export default homeSlice.reducer;

