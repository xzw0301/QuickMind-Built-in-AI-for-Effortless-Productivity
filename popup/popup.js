// popup/popup.js

document.getElementById("check-status").addEventListener("click", async () => {
    const statusElement = document.getElementById("status");
    statusElement.textContent = "Checking status...";
    
    try {
        // Send a message to the Service Worker to perform the check
        // The Service Worker has the quickMindSummarizer object.
        const response = await chrome.runtime.sendMessage({
            action: 'CHECK_AI_STATUS'
        });

        // The Service Worker now sends back { available: true } or { available: false }
        if (response && response.available === true) {
            statusElement.textContent = "✅ Built-in AI is available on this device!";
        } else {
            statusElement.textContent =
                "⚠️ Built-in AI not available. Try running a summary first, or check your Chrome version and hardware.";
        }
    } catch (error) {
        // This catch handles errors if the Service Worker is completely unavailable or the message fails
        statusElement.textContent = 
            "⚠️ Error connecting to AI Service Worker. Check chrome://extensions/";
        console.error("Popup check failed:", error);
    }
});