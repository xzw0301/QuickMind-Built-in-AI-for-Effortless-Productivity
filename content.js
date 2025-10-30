
// Global variable to hold the dialog element reference
let currentDialog = null;

// Helper function to create/update the summary dialog
function displaySummaryDialog(text, isFinalResult) {
    const dialogId = 'quickmind-dialog';

    // 1. Find or Create the dialog container
    let dialog = document.getElementById(dialogId);
    if (!dialog) {
        // Create new dialog elements
        dialog = document.createElement('div');
        dialog.id = dialogId;

        const header = document.createElement('div');
        header.id = 'quickmind-header';
        
        const contentArea = document.createElement('p');
        contentArea.id = 'quickmind-content';

        const dismissButton = document.createElement('button');
        dismissButton.id = 'quickmind-dismiss-btn';
        dismissButton.textContent = 'Dismiss';
        dismissButton.addEventListener('click', () => dialog.remove());

        // Assemble the dialog (once)
        dialog.appendChild(header);
        dialog.appendChild(contentArea);
        dialog.appendChild(dismissButton);
        document.body.appendChild(dialog);
    }
    
    // 2. Update the content and title based on the message type
    const header = dialog.querySelector('#quickmind-header');
    const contentArea = dialog.querySelector('#quickmind-content');
    const dismissButton = dialog.querySelector('#quickmind-dismiss-btn');
    
    header.textContent = 'Summary'; 
    contentArea.innerHTML = text.replace(/\n/g, '<br>');
    
    if (isFinalResult) {
        // Show the dismiss button when the result is final
        dismissButton.style.display = 'block';
        contentArea.style.color = 'white'; // Standard color for final result
    } else {
        // Hide dismiss button and use a lighter color for loading state
        dismissButton.style.display = 'none';
        contentArea.style.color = '#ffcc00'; // Temporary yellow color for attention
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    if (request.action === 'GET_SELECTED_TEXT') {
        const selectedText = window.getSelection().toString().trim();
        sendResponse({ text: selectedText });
        return true; 
    }
    
    if (request.action === 'DISPLAY_RESULT') {
        const isFinal = request.originalAction !== 'LOADING';
        displaySummaryDialog(request.result, isFinal);
        
        return false;
    }
    
    return false;
});