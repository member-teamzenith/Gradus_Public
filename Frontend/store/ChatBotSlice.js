import { createSlice } from '@reduxjs/toolkit';

// Chat history stored per videoId
// state shape:
// {
//   byVideoId: {
//     [videoId]: {
//       messages: Array<ChatMessage>,
//       chatId: string | null,
//       initialized: boolean
//     }
//   }
// }

const initialState = {
  byVideoId: {}
};
//hello  world
const ensureVideoBucket = (state, videoId) => {
  if (!state.byVideoId[videoId]) {
    state.byVideoId[videoId] = { messages: [], chatId: null, initialized: false };
  }
  return state.byVideoId[videoId];
};

const dedupeMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  const seen = new Set();
  const result = [];
  for (const m of messages) {
    const key = `${m?.message_id || ''}|${m?.timestamp || ''}|${m?.role || ''}|${(m?.content || '').slice(0,24)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(m);
  }
  return result;
};

const chatBotSlice = createSlice({
  name: 'chatbot',
  initialState,
  reducers: {
    setSession: (state, action) => {
      const { videoId, chatId } = action.payload || {};
      const bucket = ensureVideoBucket(state, videoId);
      bucket.chatId = chatId || null;
      bucket.initialized = Boolean(chatId);
    },
    setHistory: (state, action) => {
      const { videoId, messages } = action.payload || {};
      const bucket = ensureVideoBucket(state, videoId);
      // Always override and dedupe to avoid accumulation on multiple loads
      bucket.messages = dedupeMessages(Array.isArray(messages) ? messages : []);
      bucket.initialized = true;
    },
    appendMessage: (state, action) => {
      const { videoId, message } = action.payload || {};
      const bucket = ensureVideoBucket(state, videoId);
      bucket.messages = dedupeMessages([...(bucket.messages || []), message]);
    },
    updateLastAssistantMessage: (state, action) => {
      const { videoId, content } = action.payload || {};
      const bucket = ensureVideoBucket(state, videoId);
      const msgs = bucket.messages;
      if (!Array.isArray(msgs) || msgs.length === 0) return;
      // Prefer updating the last optimistic assistant message if present
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m && m.role === 'assistant' && (m.optimistic === true || typeof m.optimistic === 'undefined')) {
          msgs[i] = { ...m, content };
          return;
        }
      }
      // Fallback: update last assistant message
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m && m.role === 'assistant') {
          msgs[i] = { ...m, content };
          return;
        }
      }
    },
    clearVideo: (state, action) => {
      const { videoId } = action.payload || {};
      if (state.byVideoId[videoId]) {
        state.byVideoId[videoId] = { messages: [], chatId: null, initialized: false };
      }
    },
    clearAll: (state) => {
      state.byVideoId = {};
    }
  }
});

export const { setSession, setHistory, appendMessage, updateLastAssistantMessage, clearVideo, clearAll } = chatBotSlice.actions;

export const selectMessagesByVideoId = (state, videoId) => {
  try {
    return state.chatbot?.byVideoId?.[videoId]?.messages || [];
  } catch {
    return [];
  }
};

export const selectSessionByVideoId = (state, videoId) => {
  try {
    const bucket = state.chatbot?.byVideoId?.[videoId];
    return {
      chatId: bucket?.chatId || '',
      initialized: Boolean(bucket?.initialized)
    };
  } catch {
    return { chatId: '', initialized: false };
  }
};

export default chatBotSlice.reducer;


