const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

export function searchRecommendations(query = "Autonomous driving", limit = 25) {
    // Check for global scope (window in main thread, self in worker)
    // use 'self' if available (Worker), otherwise 'window'
    const globalScope = typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null);

    if (!globalScope) {
        console.warn('[Recommendations] Global scope is undefined (SSR)');
        return Promise.resolve({ success: false, error: "Server-side rendering" });
    }

    if (!globalScope.chrome || !globalScope.chrome.runtime || !globalScope.chrome.runtime.sendMessage) {
        console.warn('[Recommendations] Chrome runtime messaging unavailable');
        // In a worker, this might happen if chrome is not injected.
        return Promise.resolve({ success: false, error: "Chrome runtime messaging unavailable" });
    }

    if (!EXTENSION_ID || EXTENSION_ID === "YOUR_EXTENSION_ID_HERE") {
        console.warn('[Recommendations] Extension ID not configured. Set NEXT_PUBLIC_EXTENSION_ID');
        return Promise.resolve({ success: false, error: "Missing extension ID. Set NEXT_PUBLIC_EXTENSION_ID or replace placeholder." });
    }

    // console.log('[Recommendations] Searching with query:', query, 'limit:', limit, 'extensionId:', EXTENSION_ID);

    return new Promise((resolve) => {
        try {
            globalScope.chrome.runtime.sendMessage(
                EXTENSION_ID,
                { action: "search", query, limit },
                (response) => {
                    if (globalScope.chrome.runtime.lastError) {
                        // Extension not installed or not responding - return error response silently
                        resolve({ success: false, error: globalScope.chrome.runtime.lastError.message });
                        return;
                    }
                    // console.log('[Recommendations] Response received:', response);
                    resolve(response);
                }
            );
        } catch (e) {
            console.error('[Recommendations] Exception:', e);
            resolve({ success: false, error: e?.message || String(e) });
        }
    });
}


