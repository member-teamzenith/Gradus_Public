const { createSlice } = require("@reduxjs/toolkit");

const initialState = {
    videoId: "",
    quiz: {
        content: "",
        videoId: "",
        isReady: false,
        isLoading: false
    },
    summaries: {
        // Structure: { videoId: { language: { content: string, cleanSummary: string } } }
    },
    chunkCount: 0
};

const videoPlayerSlice = createSlice({
    name: 'home',
    initialState,
    reducers: {
        setVideoId: (state, action) => {
            state.videoId = action.payload;
            state.chunkCount = 0;
        },
        resetVideoId: (state) => {
            state.videoId = '';
        },
        setQuiz: (state, action) => {
            state.quiz = {
                content: action.payload.content,
                videoId: action.payload.videoId,
                isReady: true,
                isLoading: false
            };
        },
        setQuizLoading: (state, action) => {
            if (state.quiz) {
                state.quiz.isLoading = action.payload;
            }
        },
        clearQuiz: (state) => {
            state.quiz = {
                content: "",
                videoId: "",
                isReady: false,
                isLoading: false
            };
        },
        clearQuizForVideo: (state, action) => {
            if (state.quiz && state.quiz.videoId === action.payload) {
                state.quiz = {
                    content: "",
                    videoId: "",
                    isReady: false,
                    isLoading: false
                };
            }
        },
        setSummary: (state, action) => {
            const { videoId, language, content, cleanSummary } = action.payload;
            // Ensure summaries object exists
            if (!state.summaries) {
                state.summaries = {};
            }
            if (!state.summaries[videoId]) {
                state.summaries[videoId] = {};
            }
            state.summaries[videoId][language] = {
                content,
                cleanSummary
            };
        },
        clearSummariesForVideo: (state, action) => {
            const videoId = action.payload;
            // Ensure summaries object exists before accessing
            if (state.summaries && state.summaries[videoId]) {
                delete state.summaries[videoId];
            }
        },
        clearAllSummaries: (state) => {
            state.summaries = {};
        },
        setChunkCount: (state, action) => {
            state.chunkCount = action.payload;
        }
    }
});

export const {
    setVideoId,
    resetVideoId,
    setQuiz,
    setQuizLoading,
    clearQuiz,
    clearQuizForVideo,
    setSummary,
    clearSummariesForVideo,
    clearAllSummaries,
    setChunkCount
} = videoPlayerSlice.actions;

export const selectChunkCount = (state) => state.videoPlayer.chunkCount;

export default videoPlayerSlice.reducer;
