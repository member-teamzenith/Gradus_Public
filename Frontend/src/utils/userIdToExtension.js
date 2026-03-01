/**
 * Send userId to the Gradus Chrome extension
 * @param {string} userId - The user's Firebase UID
 */
export function sendUserIdToExtension(userId) {
  if (!userId || typeof userId !== 'string') {
    console.error('Invalid userId provided to sendUserIdToExtension');
    return;
  }

  try {
    // Extension ID from environment variable
    const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;

    // console.log('[AuthSync] Attempting to send userId:', userId);
    // console.log('[AuthSync] Target Extension ID:', extensionId);

    if (!extensionId) {
      console.error('[AuthSync] Extension ID not found in environment variables');
      return;
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      // console.log('[AuthSync] chrome.runtime.sendMessage is available');
      chrome.runtime.sendMessage(
        extensionId,
        {
          action: 'setUserId',
          userId: userId,
          timestamp: new Date().toISOString()
        },
        (response) => {
          if (chrome.runtime.lastError) {
            // Extension not installed or not responding - this is expected behavior
            // Silently handle the error to avoid console clutter
            // Uncomment the line below if you need to debug extension communication:
            // console.log('[AuthSync] Extension not available:', chrome.runtime.lastError.message);
            return;
          } else if (response && response.success) {
            // console.log('[AuthSync] Successfully sent userId to extension. Response:', response);
          } else {
            console.warn('[AuthSync] Extension responded but success was false:', response);
          }
        }
      );
    } else {
      console.warn('[AuthSync] chrome.runtime.sendMessage is NOT available. Are you running this in a normal browser tab?');
    }
  } catch (error) {
    console.error('[AuthSync] Unexpected error:', error);
  }
}