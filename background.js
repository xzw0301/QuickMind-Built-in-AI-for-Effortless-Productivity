
// Global variables for AI instances and initialization status
let quickMindSummarizer = null;
let isSummarizerInitializing = false; 

// NEW: Global variables for the Translator API
let quickMindTranslator = null;
let isTranslatorInitializing = false; 

// Map-Reduce Constants (for summarization)
const CHUNK_SIZE = 3000; 
const CHUNK_OVERLAP = 200; 
// --- Helper: Chunk Text for Batch Summarization (Map-Reduce) ---
// ... (chunkText function remains the same)
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
// ... (processLongSummary function remains the same)
async function processLongSummary(summarizerInstance, text, isReductionStep = false, level = 1) {
    console.log(`--- Starting Summarization Level ${level} (Reduction Step: ${isReductionStep}) ---`);

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
    
    const chunks = chunkText(text);
    console.log(`Text split into ${chunks.length} chunks.`);

    const summaryPromises = chunks.map(async (chunk, index) => {
        const prompt = isReductionStep 
            ? `Combine and condense the following partial summaries into a single, cohesive, final summary: ${chunk}` 
            : `Summarize the following text, focusing on key facts and arguments: ${chunk}`;

        try {
            const result = await summarizerInstance.summarize(prompt);
            
            if (typeof result === 'string' && result.trim().length > 50) { 
                return { output: result };
            } else if (typeof result === 'string' && result.trim().length === 0) {
                 console.warn(`WARN: Chunk ${index} produced an empty string result.`);
                 return { output: null }; 
            }
            return result && result.output ? result : { output: null }; 
            
        } catch (error) {
            console.error(`ERROR: Chunk ${index} failed at Level ${level}:`, error);
            return { output: null }; 
        }
    });

    const chunkSummaries = await Promise.all(summaryPromises);

    const combinedSummaryText = chunkSummaries
        .map(result => result && result.output ? result.output : '') 
        .filter(s => s.trim().length > 0)
        .join('\n\n---\n\n'); 

    console.log(`Level ${level} Reduction: Combined text length: ${combinedSummaryText.length}`);

    if (combinedSummaryText.length < 50) { 
        console.error(`FATAL: Level ${level} produced virtually no valid intermediate content.`);
        return { output: 'The summary failed to produce a result.' };
    }
    
    if (combinedSummaryText.length > CHUNK_SIZE) {
        return await processLongSummary(summarizerInstance, combinedSummaryText, true, level + 1);

    } else {
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


// --- NEW: Helper for Translation (using batch or streaming) ---
// NOTE: Hardcoded language pair (English to Spanish) until a settings UI is added.
const TRANSLATE_SOURCE = 'en';
const TRANSLATE_TARGET = 'de'; 

async function processTranslation(translatorInstance, text) {
    try {
        if (text.length > CHUNK_SIZE) { 
            // Use streaming for very long texts (as recommended by API docs)
            const stream = translatorInstance.translateStreaming(text);
            let translatedText = '';
            for await (const chunk of stream) {
                translatedText += chunk;
            }
            return { output: translatedText };
        } else {
            // Use simple batch translate for short/medium texts
            const translatedText = await translatorInstance.translate(text);
            return { output: translatedText };
        }
    } catch (error) {
        console.error("QuickMind Translation Error:", error);
        return { output: `Translation failed. Error: ${error.message}. Ensure model for ${TRANSLATE_SOURCE} to ${TRANSLATE_TARGET} is downloaded.` };
    }
}


// --- Function to check and initialize the Summarizer object (existing) ---
async function ensureSummarizerInitialized() {
    if (quickMindSummarizer) {
        return true; 
    }
    
    if (isSummarizerInitializing) {
         await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (quickMindSummarizer || !isSummarizerInitializing) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 50);
        });
        return !!quickMindSummarizer;
    }

    if (typeof Summarizer !== 'undefined' && Summarizer.create) {
        isSummarizerInitializing = true; 
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
            isSummarizerInitializing = false; 
        }
    }
    console.error("CRITICAL: Summarizer API not found.");
    return false;
}


// --- NEW: Function to check and initialize the Translator object ---
async function ensureTranslatorInitialized() {
    if (quickMindTranslator) {
        return true; 
    }
    
    if (isTranslatorInitializing) {
         await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (quickMindTranslator || !isTranslatorInitializing) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 50);
        });
        return !!quickMindTranslator;
    }

    if (typeof Translator !== 'undefined' && Translator.create) {
        isTranslatorInitializing = true; 
        try {
            console.log("Attempting to initialize Translator...");
            
            const options = { 
                sourceLanguage: TRANSLATE_SOURCE, 
                targetLanguage: TRANSLATE_TARGET 
            };
            quickMindTranslator = await Translator.create(options); 
            
            console.log(`QuickMind Translator initialized successfully (${TRANSLATE_SOURCE} -> ${TRANSLATE_TARGET}).`);
            return true;
        } catch (error) {
            console.error("CRITICAL: Failed to create QuickMind Translator:", error);
            quickMindTranslator = null; 
            return false;
        } finally {
            isTranslatorInitializing = false; 
        }
    }
    console.error("CRITICAL: Translator API not found.");
    return false;
}

// Initialization: Context menu creation
chrome.runtime.onInstalled.addListener(async () => {
    chrome.contextMenus.create({ id: "quickmind_parent", title: "QuickMind", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "quickmind_summarize", title: "Summarize", parentId: "quickmind_parent", contexts: ["selection"] });
    // NEW: Add the Translate context menu item
    chrome.contextMenus.create({ id: "quickmind_translate", title: "Translate", parentId: "quickmind_parent", contexts: ["selection"] }); 
});


// Listener for status checks from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'CHECK_AI_STATUS') {
        // Check availability of both APIs (optional, but good for future proofing)
        Promise.all([ensureSummarizerInitialized(), ensureTranslatorInitialized()]).then(([isSummarizerReady, isTranslatorReady]) => {
            sendResponse({ available: isSummarizerReady || isTranslatorReady });
        });
        return true; 
    }
});


// --- UI Interaction Listeners (Specific) ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const action = info.menuItemId.replace('quickmind_', ''); 

    // --- Action Handler for SUMMARIZE ---
    if (action === 'summarize' && tab.id) {
        const isReady = await ensureSummarizerInitialized();

        if (!isReady) {
            // ... (Error handling remains the same)
             chrome.tabs.sendMessage(tab.id, {
                action: 'DISPLAY_RESULT',
                result: 'AI Summarizer is not ready. Please wait a moment or check prerequisites.',
                originalAction: 'Error'
            });
            return;
        }

        try {
            // A. Get the selected text from the content script (remains the same)
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'GET_SELECTED_TEXT'
            });
            
            let selectedText = response.text;
            
            // Input Sanitization (remains the same)
            if (selectedText) {
                selectedText = selectedText.replace(/[\s\uFEFF\xA0]+/g, ' ').trim();
                selectedText = selectedText.replace(/[^\x00-\x7F]/g, '');
            }

            if (!selectedText) {
                // ... (Error handling remains the same)
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

            // B. Execute the On-Device Summarization
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
            // ... (Error handling remains the same)
            console.error('QuickMind Summarization Error:', error);
            if (tab.id) {
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

    // --- NEW ACTION HANDLER for TRANSLATE ---
    else if (action === 'translate' && tab.id) {
        const isReady = await ensureTranslatorInitialized();

        if (!isReady) {
             chrome.tabs.sendMessage(tab.id, {
                action: 'DISPLAY_RESULT',
                result: `AI Translator is not ready. Please wait, or check prerequisites. (Model: ${TRANSLATE_SOURCE} to ${TRANSLATE_TARGET})`,
                originalAction: 'Error'
            });
            return;
        }

        try {
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'GET_SELECTED_TEXT'
            });
            
            let selectedText = response.text;
            
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
              result: `Translating from ${TRANSLATE_SOURCE} to ${TRANSLATE_TARGET}...`,
              originalAction: 'LOADING'
            })

            // Execute the On-Device Translation
            const translationResultObject = await processTranslation(quickMindTranslator, selectedText);
            
            const translationText = translationResultObject && translationResultObject.output
                ? translationResultObject.output 
                : 'Translation failed to produce a result.';

            console.log("Translation complete. Result length: ", translationText.length);

            // Send the final result back to the content script for display
            chrome.tabs.get(tab.id, (currentTab) => {
                if (chrome.runtime.lastError) {
                    console.error("Tab closed or invalid after translation:", chrome.runtime.lastError.message);
                } else if (currentTab) {
                    chrome.tabs.sendMessage(currentTab.id, {
                        action: 'DISPLAY_RESULT',
                        result: translationText,
                        originalAction: action
                    });
                }
            });

        } catch (error) {
            console.error('QuickMind Translation Error:', error);
            if (tab.id) {
                chrome.tabs.get(tab.id, (currentTab) => {
                    if (!chrome.runtime.lastError && currentTab) {
                        chrome.tabs.sendMessage(currentTab.id, {
                            action: 'DISPLAY_RESULT',
                            result: `An unexpected error occurred during translation: ${error.message}`,
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