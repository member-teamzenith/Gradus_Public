// Utility to check if the Gradus Chrome extension is installed and responding
// It sends an external message to the extension and expects a pong response

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

export function pingExtension(timeoutMs = 2000) {
    return new Promise((resolve) => {
        try {
            if (typeof window === 'undefined') return resolve(false);
            const chromeApi = window.chrome;
            if (!chromeApi || !chromeApi.runtime || typeof chromeApi.runtime.sendMessage !== 'function') {
                return resolve(false);
            }

            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                resolve(false);
            }, Math.max(500, Number(timeoutMs) || 2000));

            // Send a simple ping; background should respond with pong
            chromeApi.runtime.sendMessage(EXTENSION_ID, { action: 'ping' }, (response) => {
                if (settled) return;
                settled = true;
                try { clearTimeout(timer); } catch (_) { }

                // Check for chrome.runtime.lastError to suppress console errors
                // This prevents "The message port closed before a response was received" errors
                if (chromeApi.runtime.lastError) {
                    // Extension not installed or not responding - this is expected
                    resolve(false);
                    return;
                }

                const ok = !!(response && response.success && response.pong === true);
                resolve(ok);
            });
        } catch (_) {
            resolve(false);
        }
    });
}

export async function isExtensionAvailable(timeoutMs = 2000) {
    try {
        const ok = await pingExtension(timeoutMs);
        return !!ok;
    } catch (_) {
        return false;
    }
}


