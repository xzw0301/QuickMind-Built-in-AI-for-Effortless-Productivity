// content.js - Runs on the webpage

// Listen for messages from the background script (Service Worker)
// Do NOT use 'async' here, as it makes all handlers implicitly return a promise.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    // --- Message 1: Respond with the selected text (Response is expected by background.js) ---
    if (request.action === 'GET_SELECTED_TEXT') {
        const selectedText = window.getSelection().toString().trim();
        
        // This is sent immediately, but the port must be kept open for a moment.
        sendResponse({
            text: selectedText
        });
        
        // CRITICAL FIX: Return true to signal that sendResponse was called asynchronously (even if it wasn't)
        return true; 
    }
    
    // --- Message 2: Receive the final result and display it (No response expected) ---
    if (request.action === 'DISPLAY_RESULT') {
        displayResultPopup(request.result, request.originalAction);
        
        // CRITICAL FIX: Return false to signal synchronous completion / no response expected
        return false;
    }
    
    // Default return
    return false;
});

// content.js (Replace the helper function)

// Helper function to display the result (now using a custom DOM element)
// content.js (REPLACE the displayResultPopup function)

function displayResultPopup(text, action) {
    // 1. Remove all existing popups before creating a new one
    const existingPopup = document.getElementById('quickmind-result-popup');
    if (existingPopup) existingPopup.remove();

    // 2. Create the main container div
    const popup = document.createElement('div');
    popup.id = 'quickmind-result-popup';
    // Style: Minimalist black/white theme
    popup.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647; 
        background: #222; /* Dark background */
        border: 1px solid #555; /* Subtle border */
        padding: 15px;
        box-shadow: 0 6px 12px rgba(0,0,0,0.4);
        max-width: 400px;
        min-height: 100px;
        color: #fff; /* White text */
        font-family: 'Segoe UI', Roboto, sans-serif; /* Clean font stack */
        border-radius: 6px;
        animation: fadeIn 0.3s ease-in-out;
    `;
    
    // 3. Title
    const title = document.createElement('h4');
    title.textContent = `QuickMind ${action.toUpperCase()} Result:`;
    // Style: Simple and bold title
    title.style.cssText = 'margin: 0 0 12px 0; color: #eee; font-weight: 600; font-size: 16px; border-bottom: 1px solid #444; padding-bottom: 5px;';
    
    // 4. Content Area
    const content = document.createElement('div');
    content.textContent = text;
    // Style: Scrollable and readable content
    content.style.cssText = 'margin: 0 0 15px 0; max-height: 300px; overflow-y: auto; white-space: pre-wrap; color: #ccc; font-size: 14px; line-height: 1.6;';

    // 5. Close Button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Dismiss';
    // Style: White button with black/dark grey text
    closeButton.style.cssText = 'display: block; width: 100%; padding: 10px; border: 1px solid #555; background: #fff; color: #333; border-radius: 4px; cursor: pointer; font-weight: 600; transition: background 0.2s, color 0.2s;';
    closeButton.onmouseover = (e) => {
        e.target.style.background = '#444';
        e.target.style.color = '#fff';
    };
    closeButton.onmouseout = (e) => {
        e.target.style.background = '#fff';
        e.target.style.color = '#333';
    };
    closeButton.onclick = () => popup.remove();

    // 6. Assemble and Append
    popup.appendChild(title);
    popup.appendChild(content);
    popup.appendChild(closeButton);

    document.body.appendChild(popup);
}