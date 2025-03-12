document.addEventListener("DOMContentLoaded", function () {
  const summarizeBtn = document.getElementById("summarizeBtn");
  const summarizeBtnText = document.getElementById("summarizeBtnText");
  const loadingSpinner = document.getElementById("loadingSpinner");
  const copyBtn = document.getElementById("copyBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const summaryOutput = document.getElementById("summaryOutput");
  const charCount = document.getElementById("charCount");
  const statusMessage = document.getElementById("statusMessage");
  const openaiBtn = document.getElementById("openaiBtn");
  const geminiBtn = document.getElementById("geminiBtn");

  // Store current model
  let currentModel = "openai";

  // Initialize character counter
  updateCharCount(0);

  // Set up model switching
  openaiBtn.addEventListener("click", () => {
    switchModel("openai").catch(console.error);
  });
  geminiBtn.addEventListener("click", () => {
    switchModel("gemini").catch(console.error);
  });

  // Check API key on load and set default model
  initializeSettings();

  summarizeBtn.addEventListener("click", () => {
    setLoading(true);
    statusMessage.textContent = "Analyzing page content...";

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          function: extractTextFromPage,
        },
        async (results) => {
          if (results && results[0].result) {
            statusMessage.textContent = "Extracting relevant content...";
            summarizeText(results[0].result);
          } else {
            setLoading(false);
            statusMessage.textContent =
              "Error: Unable to extract text from this page.";
          }
        }
      );
    });
  });

  copyBtn.addEventListener("click", async () => {
    const summaryText = summaryOutput.innerText; // This strips formatting
    const formattedHtml = getFormattedHtml(summaryOutput.innerHTML); // Get formatted HTML

    if (!summaryText) {
      statusMessage.textContent = "Nothing to copy yet!";
      return;
    }

    // Try to copy with formatting
    const success = await copyFormattedText(formattedHtml);

    statusMessage.textContent = success
      ? "✓ Copied to clipboard!"
      : "✓ Copied as plain text";

    // Clear the message after 2 seconds
    setTimeout(() => {
      statusMessage.textContent = "";
    }, 2000);
  });

  settingsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Update character count
  function updateCharCount(count) {
    charCount.textContent = `${count} characters`;
  }

  function setLoading(isLoading) {
    if (isLoading) {
      summarizeBtn.disabled = true;
      summarizeBtnText.textContent = "Summarizing...";
      loadingSpinner.classList.remove("hidden");
    } else {
      summarizeBtn.disabled = false;
      summarizeBtnText.textContent = "Summarize Page";
      loadingSpinner.classList.add("hidden");
    }
  }

  async function switchModel(model) {
    // Get API keys first
    const storedData = await chrome.storage.sync.get([
      "apiKey",
      "geminiApiKey",
    ]);

    // Check if the target model has an API key
    if (model === "openai" && !storedData.apiKey) {
      statusMessage.textContent =
        "⚠️ OpenAI API key not set. Please visit Settings.";
      return;
    }
    if (model === "gemini" && !storedData.geminiApiKey) {
      statusMessage.textContent =
        "⚠️ Gemini API key not set. Please visit Settings.";
      return;
    }

    currentModel = model;

    // Update UI
    if (model === "openai") {
      openaiBtn.classList.add("active");
      geminiBtn.classList.remove("active");
    } else {
      openaiBtn.classList.remove("active");
      geminiBtn.classList.add("active");
    }

    // Clear status message after 2 seconds if it was an error message
    if (statusMessage.textContent.includes("⚠️")) {
      setTimeout(() => {
        statusMessage.textContent = "";
      }, 2000);
    }
  }

  async function initializeSettings() {
    const storedData = await chrome.storage.sync.get([
      "apiKey",
      "geminiApiKey",
      "defaultModel",
    ]);

    // Check if either API key is set
    if (!storedData.apiKey && !storedData.geminiApiKey) {
      statusMessage.textContent = "⚠️ No API keys set. Please visit Settings.";
      summarizeBtn.disabled = true;
      return;
    }

    // Set the default model if available
    if (storedData.defaultModel) {
      switchModel(storedData.defaultModel);
    } else {
      // Otherwise, set according to available keys
      if (storedData.apiKey) {
        switchModel("openai");
      } else if (storedData.geminiApiKey) {
        switchModel("gemini");
      }
    }

    // Disable model button if API key not available
    if (!storedData.apiKey) {
      openaiBtn.disabled = true;
      openaiBtn.title = "OpenAI API key not set";
    }

    if (!storedData.geminiApiKey) {
      geminiBtn.disabled = true;
      geminiBtn.title = "Gemini API key not set";
    }
  }

  function cleanSummary(summary) {
    return summary.replace(/```html/g, "").replace(/```/g, "");
  }

  async function summarizeText(text) {
    // Get both API keys
    const storedData = await chrome.storage.sync.get([
      "apiKey",
      "geminiApiKey",
    ]);
    let apiKey;

    if (currentModel === "openai") {
      apiKey = storedData.apiKey;
      if (!apiKey) {
        setLoading(false);
        statusMessage.textContent =
          "⚠️ OpenAI API key not set. Please visit Settings.";
        return;
      }
    } else {
      // gemini
      apiKey = storedData.geminiApiKey;
      if (!apiKey) {
        setLoading(false);
        statusMessage.textContent =
          "⚠️ Gemini API key not set. Please visit Settings.";
        return;
      }
    }

    // Clear previous content
    summaryOutput.innerHTML = "";
    statusMessage.textContent = "Generating summary...";

    try {
      let summary;

      if (currentModel === "openai") {
        summary = await getOpenAISummary(text, apiKey);
      } else {
        summary = await getGeminiSummary(text, apiKey);
      }

      if (summary) {
        // Convert markdown to HTML and display
        const formattedHtml = formatMarkdownToHTML(summary);
        summaryOutput.innerHTML = cleanSummary(formattedHtml);
        updateCharCount(summary.length);
        statusMessage.textContent = "✓ Summary generated successfully!";
      } else {
        throw new Error("Failed to generate summary");
      }
    } catch (error) {
      summaryOutput.innerText = `Error: ${error.message}`;
      statusMessage.textContent = "❌ API error occurred.";
    } finally {
      setLoading(false);
    }
  }

  async function getOpenAISummary(text, apiKey) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that summarizes web content in a clear, concise way. Follow these strict formatting rules:" +
              "\n1. Use semantic HTML5 elements for structure" +
              "\n2. NEVER use <br> tags for spacing - use CSS margins/padding instead" +
              "\n3. Wrap sections in <section> tags" +
              "\n4. Use <h1> only once at the top, then <h2>, <h3> for subsections" +
              "\n5. Group related content in <div> elements" +
              "\n6. Use <ul> and <li> for lists" +
              "\n7. Use <p> tags for paragraphs" +
              "\n8. Use <strong> for emphasis" +
              "\n9. NEVER include empty lines between elements" +
              "\n10. NEVER use markdown syntax" +
              "\nYour response must be clean, semantic HTML without extra spacing.",
          },
          {
            role: "user",
            content: `Summarize the following content with proper headings, bullet points, and highlighted key phrases:\n\n"${text}"`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.5,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.choices[0].message.content.trim();
  }

  async function getGeminiSummary(text, apiKey) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "You are a helpful assistant that summarizes web content in a clear, concise way. Follow these strict formatting rules:" +
                    "\n1. Use semantic HTML5 elements for structure" +
                    "\n2. NEVER use <br> tags for spacing - use CSS margins/padding instead" +
                    "\n3. Wrap sections in <section> tags" +
                    "\n4. Use <h1> only once at the top, then <h2>, <h3> for subsections" +
                    "\n5. Group related content in <div> elements" +
                    "\n6. Use <ul> and <li> for lists" +
                    "\n7. Use <p> tags for paragraphs" +
                    "\n8. Use <strong> for emphasis" +
                    "\n9. NEVER include empty lines between elements" +
                    "\n10. NEVER use markdown syntax" +
                    "\nYour response must be clean, semantic HTML without extra spacing.",
                },
                {
                  text: `Summarize the following content with proper headings, bullet points, and highlighted key phrases:\n\n"${text}"`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 1500,
          },
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.candidates[0].content.parts[0].text.trim();
  }

  function formatMarkdownToHTML(markdown) {
    // First clean up any existing HTML
    if (/<\/?[a-z][\s\S]*>/i.test(markdown)) {
      markdown = markdown
        .replace(/<script.*?>.*?<\/script>/gi, "") // Remove script tags
        .replace(/onclick|onerror|onload/gi, "data-blocked") // Remove event handlers
        .replace(/(\s*<br\s*\/?>\s*){2,}/gi, "") // Remove consecutive breaks
        .replace(/>\s+</g, "><") // Remove whitespace between tags
        .replace(/^\s+|\s+$/g, "") // Trim whitespace
        .replace(/<title>.*?<\/title>/gi, ""); // Remove title tags
    }

    // Convert any remaining markdown to HTML
    let html = markdown
      // Headers (only if not already HTML)
      .replace(/^### (.*$)/gm, "<h3>$1</h3>")
      .replace(/^## (.*$)/gm, "<h2>$1</h2>")
      .replace(/^# (.*$)/gm, "<h1>$1</h1>")
      // Bold
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.*?)__/g, "<strong>$1</strong>")
      // Bullet points
      .replace(/^\* (.*$)/gm, "<li>$1</li>")
      .replace(/^- (.*$)/gm, "<li>$1</li>")
      // Wrap consecutive list items in ul
      .replace(/(<li>.*?<\/li>(\s*<li>.*?<\/li>)*)/g, "<ul>$1</ul>")
      // Convert newlines to paragraphs (only for non-HTML content)
      .replace(/([^\n]+)\n\n/g, "<p>$1</p>")
      // Clean up any remaining newlines and spaces
      .replace(/\n+/g, "")
      .replace(/>\s+</g, "><")
      .trim();

    // Final cleanup
    html = html
      .replace(/<p>\s*<\/p>/g, "") // Remove empty paragraphs
      .replace(/(<br\s*\/?>\s*)+/g, "") // Remove any remaining br tags
      .replace(/>\s+</g, "><"); // Final cleanup of spaces between tags

    return html;
  }

  function getFormattedHtml(content) {
    return `
        <!-- Generated by AI Text Summarizer -->
        <div class="copied-content">
            ${content}
            <div style="margin-top: 1em; font-size: 0.8em; color: #666;">
                Summarized by AI Text Summarizer
            </div>
        </div>
    `;
  }

  async function copyFormattedText(html) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([summaryOutput.innerText], {
            type: "text/plain",
          }),
        }),
      ]);
      return true;
    } catch (err) {
      // Fallback to plain text if HTML copying fails
      try {
        await navigator.clipboard.writeText(summaryOutput.innerText);
      } catch (plainTextErr) {
        console.error("Copy failed:", plainTextErr);
      }
      return false;
    }
  }
});

function extractTextFromPage() {
  return document.body.innerText;
}
