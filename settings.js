document.addEventListener("DOMContentLoaded", function () {
  const apiKeyInput = document.getElementById("apiKeyInput");
  const geminiApiKeyInput = document.getElementById("geminiApiKeyInput");
  const defaultModelSelect = document.getElementById("defaultModel");
  const saveApiKeyBtn = document.getElementById("saveApiKey");

  // Load saved settings
  chrome.storage.sync.get(
    ["apiKey", "geminiApiKey", "defaultModel"],
    (data) => {
      if (data.apiKey) {
        apiKeyInput.value = data.apiKey;
      }
      if (data.geminiApiKey) {
        geminiApiKeyInput.value = data.geminiApiKey;
      }
      if (data.defaultModel) {
        defaultModelSelect.value = data.defaultModel;
      }
    }
  );

  saveApiKeyBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    const geminiApiKey = geminiApiKeyInput.value.trim();
    const defaultModel = defaultModelSelect.value;

    // Validate that at least one API key is provided
    if (!apiKey && !geminiApiKey) {
      alert("⚠️ Please enter at least one API key (OpenAI or Gemini).");
      return;
    }

    // If default model is selected but its API key is missing, warn user
    if (defaultModel === "openai" && !apiKey) {
      alert(
        "⚠️ Warning: You've selected OpenAI as default but no OpenAI API key is provided."
      );
    } else if (defaultModel === "gemini" && !geminiApiKey) {
      alert(
        "⚠️ Warning: You've selected Gemini as default but no Gemini API key is provided."
      );
    }

    // Save all settings
    chrome.storage.sync.set(
      {
        apiKey,
        geminiApiKey,
        defaultModel,
      },
      () => {
        alert("✅ Settings saved successfully!");
      }
    );
  });
});
