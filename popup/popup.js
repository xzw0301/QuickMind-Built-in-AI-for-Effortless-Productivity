
document.getElementById("check-status").addEventListener("click", async () => {
    const statusElement = document.getElementById("status");
    statusElement.textContent = "Initiating AI setup and checking status... (This may take a moment on first run)"; // Updated message
    
    // Send a message to the Service Worker to perform the check where the API is exposed
    const response = await chrome.runtime.sendMessage({
        action: 'CHECK_AI_STATUS'
    });

    if (response && response.available === true) {
        statusElement.textContent = "✅ Built-in AI is available on this device and ready!";
    } else {
        statusElement.textContent =
            "⚠️ Built-in AI not available. Check your Chrome version and hardware. The model may also still be downloading.";
    }
});