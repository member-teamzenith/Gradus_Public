import { configureStore ,combineReducers } from "@reduxjs/toolkit";
import videoPlayerSlice from "./videoplayerSlice";
import homeSlice from "./HomeSlice";
import chatBotSlice from "./ChatBotSlice";
import userSlice from "./userSlice";
import blueprintsVideosSlice from "./blueprintsVideos";


import {
    persistReducer,
    persistStore,
    FLUSH,
    REHYDRATE,
    PAUSE,
    PERSIST,
    PURGE,
    REGISTER,
} from 'redux-persist';

import storage from 'redux-persist/lib/storage';

const persistConfig = {
    key:'root',
    version:1,
    storage,
    // Ensure quiz data persists across page navigations
    whitelist: ['videoPlayer', 'home', 'user']
};

// Specific persist config for videoPlayer to ensure quiz persistence
const videoPlayerPersistConfig = {
    key: 'videoPlayer',
    storage,
    whitelist: ['quiz'] // Persist quiz data, not videoId
};

const rootReducer = combineReducers({
    videoPlayer: persistReducer(videoPlayerPersistConfig, videoPlayerSlice),
    home: homeSlice,
    chatbot: chatBotSlice,
    user: userSlice,
    blueprintsVideos: blueprintsVideosSlice,
});

const persistedReducer = persistReducer(persistConfig,rootReducer);

const store = configureStore({
    reducer:persistedReducer,
    middleware:(getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck:{
                ignoreActions:[FLUSH,REHYDRATE,PAUSE,PERSIST,PURGE,REGISTER],
            },
        }),
});

export const persistor = persistStore(store);
export default store;