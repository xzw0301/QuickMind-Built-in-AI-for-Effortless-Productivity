// background.js

// Global variable to hold the initialized Summarizer object
let quickMindSummarizer = null;
let isInitializing = false; 

const CHUNK_SIZE = 3000; 
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
async function processLongSummary(summarizerInstance, text, isReductionStep = false, level = 1) {
    console.log(`--- Starting Summarization Level ${level} (Reduction Step: ${isReductionStep}) ---`);

    // 1. If text is short, perform single summary call
    if (text.length <= CHUNK_SIZE && !isReductionStep) {
        console.log("Input is short. Performing single summary call.");
        try {
            const summaryString = await summarizerInstance.summarize(text);
            return { output: summaryString };
        } catch (error) {
            console.error(`ERROR: Single summary call failed at Level ${level}:`, error);
            return { output: null };
        }
    }
    
    // 2. Map: Chunk the text
    const chunks = chunkText(text);
    console.log(`Text split into ${chunks.length} chunks.`);

    // 3. Map: Summarize all chunks in parallel
    const summaryPromises = chunks.map(async (chunk, index) => {
        const prompt = isReductionStep 
            ? `Combine and condense the following partial summaries into a single, cohesive, final summary: ${chunk}` 
            : `Summarize the following text, focusing on key facts and arguments: ${chunk}`;

        try {
            // CRITICAL CHECK: Call the API and ensure result has content
            const result = await summarizerInstance.summarize(prompt);
            
            // The API returns a string directly, not an object, if successful
            if (typeof result === 'string' && result.trim().length > 50) { 
                return { output: result };
            } else if (typeof result === 'string' && result.trim().length === 0) {
                 console.warn(`WARN: Chunk ${index} produced an empty string result.`);
                 return { output: null }; 
            }
            // Should not happen if API returns string, but handles unexpected object returns
            return result && result.output ? result : { output: null }; 
            
        } catch (error) {
            // Log the error for the failing chunk
            console.error(`ERROR: Chunk ${index} failed at Level ${level}:`, error);
            return { output: null }; 
        }
    });

    const chunkSummaries = await Promise.all(summaryPromises);

    // 4. Reduce: Combine the summaries into a single string
    const combinedSummaryText = chunkSummaries
        .map(result => result && result.output ? result.output : '') 
        .filter(s => s.trim().length > 0)
        .join('\n\n---\n\n'); 

    console.log(`Level ${level} Reduction: Combined text length: ${combinedSummaryText.length}`);

    if (combinedSummaryText.length < 50) { // If final text is minimal, fail gracefully
        console.error(`FATAL: Level ${level} produced virtually no valid intermediate content.`);
        return { output: 'The summary failed to produce a result.' };
    }
    
    // 5. Reduce: Summarize the combined summaries to get the final result
    if (combinedSummaryText.length > CHUNK_SIZE) {
        // Recursively reduce the text (go to the next level)
        return await processLongSummary(summarizerInstance, combinedSummaryText, true, level + 1);

    } else {
        // Final reduction step
        const finalPrompt = `Provide a single, cohesive summary of the following text: ${combinedSummaryText}`;
        console.log("Performing final summary reduction.");

        try {
            const finalSummaryString = await summarizerInstance.summarize(finalPrompt);
            
            if (typeof finalSummaryString === 'string' && finalSummaryString.trim().length > 0) {
                 return { output: finalSummaryString };
            } else {
                 console.error("FATAL: Final summary API call returned an empty result.");
                 return { output: 'The summary failed to produce a result.' };
            }
           
        } catch (error) {
            console.error("ERROR: Final summary reduction failed.", error);
            return { output: 'The summary failed to produce a result.' };
        }
    }
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