// Utilities for transcript retrieval with cache-first backend and extension fallback

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL
const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

async function callBackendGetTranscript(videoId) {
  const baseUrl = API_URL;
  const url = `${baseUrl}/transcript/${encodeURIComponent(videoId)}`;

  // console.log(`[Frontend] Attempting to fetch transcript from: ${url}`);

  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // console.log(`[Frontend] Response status: ${res.status}`);

    if (res.ok) return res.json();
    if (res.status === 404) return null;

    const text = await res.text().catch(() => "");
    throw new Error(`Backend GET failed (${res.status}): ${text}`);
  } catch (error) {
    console.error(`[Frontend] Fetch error for ${url}:`, error);
    throw error;
  }
}

async function callBackendPostTranscript(videoId, transcript) {
  const baseUrl = API_URL;
  const url = `${baseUrl}/transcript/${encodeURIComponent(videoId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ transcript })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Backend POST failed (${res.status}): ${text}`);
  }
  return res.json();
}

function sendMessageToExtension(message) {
  return new Promise((resolve, reject) => {
    // console.log(`Frontend: sendMessageToExtension called with:`, message);
    // console.log(`Frontend: isBrowser():`, isBrowser());
    // console.log(`Frontend: chrome.runtime.sendMessage available:`, !!window.chrome?.runtime?.sendMessage);
    // console.log(`Frontend: EXTENSION_ID:`, EXTENSION_ID);

    if (!isBrowser()) return reject(new Error("Not in browser context"));
    if (!window.chrome?.runtime?.sendMessage) return reject(new Error("chrome.runtime.sendMessage unavailable"));
    if (!EXTENSION_ID) return reject(new Error("Extension ID not configured (NEXT_PUBLIC_EXTENSION_ID)"));

    // Set a timeout to prevent hanging (increased to 15s to allow extension time to fetch captions)
    const timeout = setTimeout(() => {
      console.warn(`Frontend: Extension communication timeout after 15 seconds`);
      reject(new Error("Extension communication timeout"));
    }, 15000);

    try {
      // console.log(`Frontend: Sending message to extension ${EXTENSION_ID}:`, message);
      window.chrome.runtime.sendMessage(EXTENSION_ID, message, (response) => {
        clearTimeout(timeout);
        // console.log(`Frontend: Extension response received:`, response);

        // Check for Chrome runtime errors
        if (window.chrome.runtime.lastError) {
          const error = window.chrome.runtime.lastError;
          // Extension not installed or not responding - silently reject
          return reject(new Error(error.message || "Extension communication failed"));
        }

        // Check if response is valid
        if (!response) {
          console.warn(`Frontend: No response from extension`);
          return reject(new Error("No response from extension"));
        }

        resolve(response);
      });
    } catch (err) {
      clearTimeout(timeout);
      console.error(`Frontend: Exception in sendMessageToExtension:`, err);
      reject(err);
    }
  });
}

// Handshake (ping) disabled per requirement
// async function pingExtension() {
//   try {
//     const response = await sendMessageToExtension({ action: "ping" });
//     return Boolean(response && response.success && response.pong);
//   } catch (_) {
//     return false;
//   }
// }

export async function getTranscriptCacheFirst(videoId) {
  if (!videoId) throw new Error("videoId is required");

  // 1) Try backend cache
  const cached = await callBackendGetTranscript(videoId);
  if (cached?.transcript && Array.isArray(cached.transcript)) {
    return { transcript: cached.transcript, cached: true };
  }

  // 2) Ask extension directly (no ping/handshake)
  // console.log(`Frontend: Attempting to call extension for transcript, videoId: ${videoId}`);
  // console.log(`Frontend: Extension ID: ${EXTENSION_ID}`);
  let extResponse;
  try {
    extResponse = await sendMessageToExtension({ action: "getTranscript", videoId });
    // console.log(`Frontend: Extension response:`, extResponse);

    // Check if extension returned a valid response
    if (!extResponse || typeof extResponse !== 'object') {
      console.warn(`Frontend: Extension returned invalid response:`, extResponse);
      return { transcript: [], cached: false };
    }

    if (!extResponse.success || !Array.isArray(extResponse.transcript)) {
      const error = extResponse.error || "Extension could not fetch transcript";
      console.warn(`Frontend: Extension returned no transcript:`, error);
      return { transcript: [], cached: false };
    }
  } catch (error) {
    console.warn(`Frontend: Extension call failed (proceeding without transcript):`, error?.message || String(error));
    return { transcript: [], cached: false };
  }

  const transcript = extResponse.transcript;

  // 3) Cache in backend (best-effort)
  try {
    await callBackendPostTranscript(videoId, transcript);
  } catch (_) {
    // non-fatal
  }

  return { transcript, cached: false, extensionAvailable: true };
}

export async function getMetadataCacheFirst(videoId) {
  if (!videoId) return { title: undefined, description: undefined, thumbnail: undefined, cached: false };
  // Extension-first metadata fetch; non-blocking and tolerant of failures
  try {
    const response = await sendMessageToExtension({ action: "getMetadata", videoId });
    if (response && response.success && response.metadata) {
      const { title, description, thumbnail, languageCode } = response.metadata || {};
      return { title, description, thumbnail, languageCode, cached: false, extensionAvailable: true };
    }
  } catch (_) {
    // ignore and fall through with undefineds
  }
  return { title: undefined, description: undefined, thumbnail: undefined, languageCode: undefined, cached: false };
}

// Health check function to test backend connectivity
export async function checkBackendHealth() {
  const baseUrl = API_URL;
  const url = `${baseUrl}/health`;

  try {
    // console.log(`[Frontend] Testing backend health at: ${url}`);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (res.ok) {
      const data = await res.json();
      // console.log(`[Frontend] Backend health check successful:`, data);
      return { success: true, data };
    } else {
      // console.error(`[Frontend] Backend health check failed with status: ${res.status}`);
      return { success: false, status: res.status };
    }
  } catch (error) {
    // console.error(`[Frontend] Backend health check error:`, error);
    return { success: false, error: error.message };
  }
}


