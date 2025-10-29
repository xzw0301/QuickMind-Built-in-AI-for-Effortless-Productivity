
// Global variable to hold the initialized Summarizer object
// Set to null until 'await Summarizer.create()' is complete
let quickMindSummarizer = null;

// --- Ensure content script is injected dynamically when needed ---
async function ensureContentScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        });
        console.log("✅ Content script injected dynamically into tab:", tabId);
    } catch (e) {
        console.warn("⚠️ Could not inject content script:", e);
    }
}


// --- Function to check and initialize the Summarizer object ---
async function ensureSummarizerInitialized() {
    // 1. If already initialized, return immediately (idempotent)
    if (quickMindSummarizer) {
        console.log("Summarizer already initialized.");
        return true; 
    }
    
    // 2. Otherwise, attempt to create it
    if (typeof Summarizer !== 'undefined' && Summarizer.create) {
        try {
            console.log("Attempting to initialize Summarizer...");
            const options = { type: 'key-points', length: 'short', format: 'markdown' };
            
            // This is the long-running operation that can interfere with the worker lifecycle
            quickMindSummarizer = await Summarizer.create(options);
            
            console.log("QuickMind Summarizer initialized successfully.");
            return true;
        } catch (error) {
            console.error("CRITICAL: Failed to create QuickMind Summarizer:", error);
            // Reset to null if creation fails
            quickMindSummarizer = null; 
            return false;
        }
    }
    console.error("CRITICAL: Summarizer API not found.");
    return false;
  }

// Initialization: Called when the extension is first installed, updated, or Chrome starts.
chrome.runtime.onInstalled.addListener(async () => {
    // 1. Create the context menus
    chrome.contextMenus.create({
        id: "quickmind_parent",
        title: "QuickMind",
        contexts: ["selection"]
    });
    chrome.contextMenus.create({
        id: "quickmind_summarize",
        title: "Summarize",
        parentId: "quickmind_parent",
        contexts: ["selection"]
    });
    // Add other context menu items here later (Translate/Proofread)

});


// --- Communication Listeners (General) ---

// Listener for status checks from the popup
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'CHECK_AI_STATUS') {
        // Check the current state of the global object.
        // It will be null if the object creation failed/timed out, or if it hasn't run yet.
        const isAvailable = quickMindSummarizer !== null;

        // If it is not available, try to run the initializaiton in the background
        // but do not await it, which could block the Service Worker.
        if (!isAvailable) {
          ensureSummarizerInitialized().catch(e => console.error("Background status init failed: ", e));
        }

        sendResponse({ available: isAvailable });
        return true; // Keep the message channel open for async response
    }
});


// --- UI Interaction Listeners (Specific) ---

// Listener for a click on any of your menu items (Right-Click)
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const action = info.menuItemId.replace('quickmind_', ''); // 'summarize'

    if (action === 'summarize' && tab.id) {
        await ensureContentScript(tab.id);

        const isReady = await ensureSummarizerInitialized();

        if (!isReady) {
             chrome.tabs.sendMessage(tab.id, {
                action: 'DISPLAY_RESULT',
                result: 'AI Summarizer is not ready. Please wait a moment or check prerequisites.',
                originalAction: 'Error'
            });
            return;
        }

        try {
            // A. Get the selected text from the content script
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'GET_SELECTED_TEXT'
            });
            
            const selectedText = response.text;

            if (!selectedText) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'DISPLAY_RESULT',
                    result: 'Please highlight some text before running QuickMind.',
                    originalAction: 'Error'
                });
                return;
            }

            // B. Execute the On-Device Summarization (Batch summarization)
            // Call summarize() on the pre-created object
            const summaryResult = await quickMindSummarizer.summarize(selectedText);
            console.log("Summarization complete. Result length: ", summaryResult.length);

            // C. Send the final result back to the content script for display
            chrome.tabs.get(tab.id, (currentTab) => {
                if (chrome.runtime.lastError) {
                    console.error("Tab closed or invalid after summarization:", chrome.runtime.lastError.message);
                } else if (currentTab) {
                    // Only send if the tab is confirmed to be open
                    chrome.tabs.sendMessage(currentTab.id, {
                        action: 'DISPLAY_RESULT',
                        result: summaryResult,
                        originalAction: action
                    });
                }
            });

        } catch (error) {
            console.error('QuickMind Summarization Error:', error);
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'DISPLAY_RESULT',
                    result: `An unexpected error occurred during summarization: ${error.message}`,
                    originalAction: action
                });
            }
        }
    }
});