import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // Store videos by query: { [query]: { videos: [], currentIndex: 0 } }
  videosByQuery: {},
};

const blueprintsVideosSlice = createSlice({
  name: "blueprintsVideos",
  initialState,
  reducers: {
    setVideosForQuery: (state, action) => {
      const { query, videos } = action.payload;
      state.videosByQuery[query] = {
        videos: videos.slice(0, 3), // Store only first 3 videos
        currentIndex: 0,
      };
    },
    nextVideoForQuery: (state, action) => {
      const { query } = action.payload;
      if (state.videosByQuery[query]) {
        const data = state.videosByQuery[query];
        data.currentIndex = (data.currentIndex + 1) % data.videos.length;
      }
    },
    resetVideosForQuery: (state, action) => {
      const { query } = action.payload;
      if (state.videosByQuery[query]) {
        state.videosByQuery[query].currentIndex = 0;
      }
    },
    clearAllVideos: (state) => {
      state.videosByQuery = {};
    },
  },
});

export const {
  setVideosForQuery,
  nextVideoForQuery,
  resetVideosForQuery,
  clearAllVideos,
} = blueprintsVideosSlice.actions;

export default blueprintsVideosSlice.reducer;
