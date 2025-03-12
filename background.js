chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Text Summarizer Extension Installed!");
});

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: extractTextAndSummarize,
  });
});

async function extractTextAndSummarize() {
  const pageText = document.body.innerText; // Extracts all text from the page

  // Get settings
  const storedData = await chrome.storage.sync.get([
    "apiKey",
    "geminiApiKey",
    "defaultModel",
  ]);
  const defaultModel = storedData.defaultModel || "openai"; // Default to OpenAI if not specified

  let apiKey;
  let modelName;

  if (defaultModel === "openai") {
    apiKey = storedData.apiKey;
    modelName = "OpenAI";
    if (!apiKey) {
      // If OpenAI key is missing but Gemini key exists, fall back to Gemini
      if (storedData.geminiApiKey) {
        apiKey = storedData.geminiApiKey;
        modelName = "Gemini";
      } else {
        alert("Please set your OpenAI API Key in settings.");
        return;
      }
    }
  } else {
    // gemini
    apiKey = storedData.geminiApiKey;
    modelName = "Gemini";
    if (!apiKey) {
      // If Gemini key is missing but OpenAI key exists, fall back to OpenAI
      if (storedData.apiKey) {
        apiKey = storedData.apiKey;
        modelName = "OpenAI";
      } else {
        alert("Please set your Gemini API Key in settings.");
        return;
      }
    }
  }

  try {
    let summary;

    if (modelName === "OpenAI") {
      summary = await getOpenAISummary(pageText, apiKey);
    } else {
      summary = await getGeminiSummary(pageText, apiKey);
    }

    // Create a popup with formatted HTML
    const popupWindow = window.open("", "AI Summary", "width=500,height=600");

    if (popupWindow) {
      // Create a nicely formatted popup
      popupWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>AI Summary</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              margin: 0;
              padding: 20px;
              background: #f9f9f9;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            h1 {
              color: #333;
              font-size: 24px;
              margin-bottom: 20px;
              border-bottom: 1px solid #eee;
              padding-bottom: 10px;
            }
            h2, h3 {
              color: #444;
              margin-top: 20px;
              margin-bottom: 10px;
            }
            strong {
              color: #000;
            }
            ul, ol {
              padding-left: 25px;
            }
            li {
              margin-bottom: 5px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #666;
              border-top: 1px solid #eee;
              padding-top: 10px;
            }
            .model-info {
              background: #f0f8ff;
              border-radius: 4px;
              padding: 8px 12px;
              display: inline-block;
              margin-bottom: 15px;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔍 AI Summary</h1>
            <div class="model-info">Generated with ${modelName}</div>
            <div class="summary-content">
              ${summary}
            </div>
            <div class="footer">
              Generated by AI Text Summarizer extension
            </div>
          </div>
        </body>
        </html>
      `);
      popupWindow.document.close();
    } else {
      // Fallback to alert if popup is blocked
      alert("🔍 AI Summary:\n\n" + summary.replace(/<[^>]*>/g, ""));
    }
  } catch (error) {
    console.error("Error with API:", error);
    alert("⚠️ Error: " + error.message);
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
            "You are a helpful assistant that summarizes web content in a clear, concise way. Create summaries with well-structured content including bullet points for key points and bold for important phrases. Generate a fully formatted summary that can be displayed directly to the user. DO NOT include markdown symbols like # or ** in your output - use proper HTML elements like <h3> and <strong> instead. Use <br> tags sparingly for line breaks, and avoid multiple consecutive line breaks. Each section should be separated by a single line break.",
        },
        {
          role: "user",
          content: `Summarize the following content with proper headings, bullet points, and highlighted key phrases:\n\n"${text}"`,
        },
      ],
      max_tokens: 500,
      temperature: 0.5,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return formatMarkdownToHTML(data.choices[0].message.content.trim());
}

async function getGeminiSummary(text, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
                text: "You are a helpful assistant that summarizes web content in a clear, concise way. Create summaries with well-structured content including bullet points for key points and bold for important phrases. Generate a fully formatted summary that can be displayed directly to the user. DO NOT include markdown symbols like # or ** in your output - use proper HTML elements like <h3> and <strong> instead. Use <br> tags sparingly for line breaks, and avoid multiple consecutive line breaks. Each section should be separated by a single line break.",
              },
              {
                text: `Summarize the following content with proper headings, bullet points, and highlighted key phrases:\n\n"${text}"`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 500,
        },
      }),
    }
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return formatMarkdownToHTML(data.candidates[0].content.parts[0].text.trim());
}

function formatMarkdownToHTML(markdown) {
  // In case the AI still sends markdown, convert it to HTML
  let html = markdown
    // Check if it has any HTML already
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.*?)__/g, "<strong>$1</strong>")
    // Bullet points
    .replace(/^\* (.*$)/gm, "<ul><li>$1</li></ul>")
    .replace(/^- (.*$)/gm, "<ul><li>$1</li></ul>")
    // Fix consecutive list items
    .replace(/<\/ul>\s*<ul>/g, "")
    // Handle multiple consecutive newlines
    .replace(/\n{3,}/g, "\n\n")
    // Convert remaining double newlines to breaks
    .replace(/\n\n/g, "<br><br>")
    // Clean up any excessive breaks
    .replace(/(\s*<br\s*\/?>\s*){3,}/gi, "<br><br>")
    .trim();

  // If we already have HTML content, just sanitize it
  if (/<\/?[a-z][\s\S]*>/i.test(markdown)) {
    return markdown
      .replace(/<script.*?>.*?<\/script>/gi, "") // Remove any script tags
      .replace(/onclick|onerror|onload/gi, "data-blocked") // Remove event handlers
      .replace(/(\s*<br\s*\/?>\s*){3,}/gi, "<br><br>") // Limit consecutive breaks
      .replace(/^\s+|\s+$/g, ""); // Trim whitespace
  }

  return html;
}
