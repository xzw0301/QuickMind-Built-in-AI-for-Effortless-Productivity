// background.js

// Global variable to hold the initialized Summarizer object
let quickMindSummarizer = null;
let isInitializing = false; 

const CHUNK_SIZE = 4000; 
const CHUNK_OVERLAP = 200; 

// --- Helper: Chunk Text for Batch Summarization (Map-Reduce) ---
function chunkText(text) {
    const chunks = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        const start = Math.max(0, i); 
        const end = Math.min(text.length, start + CHUNK_SIZE); 
        chunks.push(text.substring(start, end));

        if (end === text.length) {
            break;
        }
    }
    return chunks;
}

// --- Helper: Handle Summarization for Long Documents (Map-Reduce) ---
async function processLongSummary(summarizerInstance, text) {
    // 1. If text is short, perform single summary call
    if (text.length <= CHUNK_SIZE) {
        const summaryString = await summarizerInstance.summarize(text);
        // FIX: Wrap the final string in the expected object format.
        return { output: summaryString };
    }
    
    // 2. Map: Chunk the text
    const chunks = chunkText(text);

    // 3. Map: Summarize all chunks in parallel
    const summaryPromises = chunks.map(chunk => {
        return summarizerInstance.summarize(chunk).catch(e => {
            console.error("Error summarizing chunk:", e);
            return null; 
        });
    });

    const chunkSummaries = await Promise.all(summaryPromises);

    // 4. Reduce: Combine the summaries into a single string
    const combinedSummaryText = chunkSummaries
        .map(result => result && result.output ? result.output : '') 
        .filter(s => s.length > 0)
        .join('\n\n---\n\n'); 

    if (combinedSummaryText.length === 0) {
        // This path is already correctly returning the object structure
        return { output: 'The summary failed to produce a result.' };
    }
    
    // 5. Reduce: Summarize the combined summaries to get the final result
    let finalSummaryString;
    if (combinedSummaryText.length > CHUNK_SIZE) {
        const finalInput = combinedSummaryText.substring(0, CHUNK_SIZE);
        finalSummaryString = await summarizerInstance.summarize(finalInput);
    } else {
        finalSummaryString = await summarizerInstance.summarize(combinedSummaryText);
    }

    // FIX: Wrap the final string result from the Map-Reduce path in the expected object format.
    return { output: finalSummaryString };
}

// --- Function to check and initialize the Summarizer object ---
async function ensureSummarizerInitialized() {
    // 1. If already initialized, return immediately (idempotent)
    if (quickMindSummarizer) {
        return true; 
    }
    
    // NEW: If initialization is already running, wait for it to finish
    if (isInitializing) {
         await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (quickMindSummarizer || !isInitializing) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 50);
        });
        return !!quickMindSummarizer;
    }

    // 2. Otherwise, attempt to create it
    if (typeof Summarizer !== 'undefined' && Summarizer.create) {
        isInitializing = true; 
        try {
            console.log("Attempting to initialize Summarizer...");
            
            const options = { type: 'tldr', length: 'short', format: 'plain-text'};
            quickMindSummarizer = await Summarizer.create(options); 
            
            console.log("QuickMind Summarizer initialized successfully.");
            return true;
        } catch (error) {
            console.error("CRITICAL: Failed to create QuickMind Summarizer:", error);
            quickMindSummarizer = null; 
            return false;
        } finally {
            isInitializing = false; 
        }
    }
    console.error("CRITICAL: Summarizer API not found.");
    return false;
  }

// Initialization: Context menu creation
chrome.runtime.onInstalled.addListener(async () => {
    chrome.contextMenus.create({ id: "quickmind_parent", title: "QuickMind", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "quickmind_summarize", title: "Summarize", parentId: "quickmind_parent", contexts: ["selection"] });
});


// Listener for status checks from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'CHECK_AI_STATUS') {
        ensureSummarizerInitialized().then(isReady => {
            sendResponse({ available: isReady });
        });
        return true; 
    }
});


// --- UI Interaction Listeners (Specific) ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const action = info.menuItemId.replace('quickmind_', ''); 

    if (action === 'summarize' && tab.id) {
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
            
            let selectedText = response.text;
            
            // --- FIX: Input Sanitization (Aggressive Cleaning) ---
            if (selectedText) {
                // 1. Normalize all forms of whitespace (including non-breaking spaces)
                selectedText = selectedText.replace(/[\s\uFEFF\xA0]+/g, ' ').trim();
                // 2. Remove all non-ASCII control characters that might break the model
                selectedText = selectedText.replace(/[^\x00-\x7F]/g, '');
            }
            // ---------------------------------------------------

            if (!selectedText) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'DISPLAY_RESULT',
                    result: 'Please highlight some text before running QuickMind.',
                    originalAction: 'Error'
                });
                return;
            }
            // Send an instant LOADING message
            chrome.tabs.sendMessage(tab.id, {
              action: 'DISPLAY_RESULT',
              result: 'Summarizing now... This may take a moment.',
              originalAction: 'LOADING'
            })

            // B. Execute the On-Device Summarization (Using Map-Reduce for long text)
            const summaryResultObject = await processLongSummary(quickMindSummarizer, selectedText);
            
            const summaryText = summaryResultObject && summaryResultObject.output
                ? summaryResultObject.output 
                : 'Summarization failed to produce a result.';

            console.log("Summarization complete. Result length: ", summaryText.length);

            // C. Send the final result back to the content script for display (SUCCESS PATH)
            chrome.tabs.get(tab.id, (currentTab) => {
                if (chrome.runtime.lastError) {
                    console.error("Tab closed or invalid after summarization:", chrome.runtime.lastError.message);
                } else if (currentTab) {
                    chrome.tabs.sendMessage(currentTab.id, {
                        action: 'DISPLAY_RESULT',
                        result: summaryText,
                        originalAction: action
                    });
                }
            });

        } catch (error) {
            console.error('QuickMind Summarization Error:', error);
            if (tab.id) {
                // FIX: Guard the error reporting message (Connection Guard)
                chrome.tabs.get(tab.id, (currentTab) => {
                    if (!chrome.runtime.lastError && currentTab) {
                        chrome.tabs.sendMessage(currentTab.id, {
                            action: 'DISPLAY_RESULT',
                            result: `An unexpected error occurred during summarization: ${error.message}`,
                            originalAction: action
                        });
                    } else {
                         console.warn('Could not report error to tab; tab may have closed.');
                    }
                });
            }
        }
    }
});