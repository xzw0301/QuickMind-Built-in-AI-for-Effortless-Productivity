# ⚡ QuickMind – Built-in AI for Effortless Productivity

**QuickMind** is a Chrome extension that boosts your productivity with Google’s **built-in on-device AI**.  
Summarize, translate, or proofread any text on the web — all with **one click** and **no prompts**.

---

## ✨ Why QuickMind

- 🚀 **Instant productivity** – highlight and act in one step  
- 🤖 **Prompt-free** – no typing, no configuration, just results  
- 🌍 **Summarize, translate, or proofread** using Chrome’s built-in AI  
- 💻 **On-device only** – fast, private, and always available  
- 🧩 **Seamless integration** with your Chrome browsing experience  

---

## 🧠 How It Works

QuickMind uses **Google’s built-in AI (Gemini Nano and related on-device APIs)** available in modern versions of Chrome.  
All operations happen **locally** — there’s **no fallback** to cloud or external services.

### Typical Flow:
1. You highlight text on a webpage.  
2. You choose **QuickMind → Summarize / Translate / Proofread**.  
3. Chrome’s built-in AI instantly generates the result — on your device.  

No prompts, no lag, no data leaving your computer.

---

## 📁 Project Structure

quickmind/

- manifest.json

- background.js

- content.js

- popup/
    - popup.html
    - popup.js
    - popup.css

- icons/
    - icon16.png
    - icon48.png
    - icon128.png

- README.md


---

## ⚙️ Setup Instructions

### 1️⃣ Prerequisites
## 🔧 Prerequisites

Before using QuickMind you must meet the system requirements for Chrome’s built-in on-device AI (Gemini Nano):

- 🖥 **Operating System**  
  - Windows 10 or Windows 11  
  - macOS 13 (Ventura) or later — **Apple Silicon chip (M1 or newer)** required; Intel-based Mac systems may not be supported  
  - Linux (recent distribution)  
  - ChromeOS (Chromebook Plus devices only; standard ChromeOS not yet supported)

- 🌐 **Google Chrome**  
  - Version **138 or later**  
  - Enable the following flags:  
    `chrome://flags/#optimization-guide-on-device-model`  
    `chrome://flags/#prompt-api-for-gemini-nano`  
    `chrome://flags/#on-device-translation`  
    `chrome://flags/#summarization-api`

- 💾 **Storage**  
  - Minimum **22 GB of free space** on the drive/volume where your Chrome profile is stored (required for the on-device model download and cache)

- ⚙️ **Hardware**  
  - GPU with **more than 4 GB of VRAM** OR  
  - On Apple Silicon: any machine **M1 or newer** meets the requirement (shared memory GPU model)  
  - If neither applies, the on-device AI may fail to initialize

- 📱 **Platform Support**  
  - Desktop only (Windows/macOS/Linux)  
  - Mobile (Android/iOS) and standard ChromeOS devices are **not supported** yet

> ⚠️ *Note: If your device does not meet these requirements, QuickMind may not function correctly because the on-device model cannot download or run. There is deliberately no cloud fallback.*

---

### 2️⃣ Load the Extension
1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `quickmind/` folder

---

## 💡 Usage

1. Highlight any text on a webpage  
2. Right-click → **QuickMind → Choose Action**  
3. Instantly get a summarized, translated, or proofread result  

Quick, intuitive, and prompt-free.

---

## 🧩 Tech Stack

| Component | Technology |
|------------|-------------|
| Browser Runtime | Chrome (v128+) |
| AI Engine | Google Built-in AI (Gemini Nano) |
| Language | JavaScript / HTML / CSS |
| Processing | 100% On-Device |
| Design Focus | Productivity & Simplicity |

---

## 🔒 Privacy by Design

- All AI tasks run **on your device**  
- No network calls or data uploads  
- No prompts or user input stored  

Your browsing stays yours — naturally safe because nothing leaves your computer.

---

## 🚧 Roadmap

- 🔍 Auto-detect best action (summary, translation, proofreading)  
- 🗂️ Local history of processed results  
- 🌈 UI refinements for smoother interaction  
- 💬 Support for more languages and tone settings  

---

## 🪪 License

MIT License © 2025 Sophia W.

---

## 🙌 About

**QuickMind** – The simplest way to think faster and work smarter.  
Built on Chrome’s next-generation **on-device AI** for seamless productivity.


