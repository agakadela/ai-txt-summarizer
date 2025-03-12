function extractMainText() {
  // Try to identify the main content area using common selectors
  const mainContentSelectors = [
    "article",
    "main",
    ".content",
    "#content",
    ".post",
    ".article",
    "[role='main']",
    ".main-content",
    "#main-content",
  ];

  let mainContent = null;

  // Try to find the main content element
  for (const selector of mainContentSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      mainContent = element;
      break;
    }
  }

  // If no main content element found, use the body
  if (!mainContent) {
    mainContent = document.body;
  }

  // Elements that are likely to be noise
  const noiseSelectors = [
    "nav",
    "header",
    "footer",
    ".nav",
    ".menu",
    ".header",
    ".footer",
    ".sidebar",
    "#sidebar",
    ".comments",
    ".ads",
    ".advertisement",
    "[role='navigation']",
    "[role='banner']",
    "[role='contentinfo']",
  ];

  // Create a copy of the main content to avoid modifying the original DOM
  const contentClone = mainContent.cloneNode(true);

  // Remove noise elements from the clone
  noiseSelectors.forEach((selector) => {
    const noiseElements = contentClone.querySelectorAll(selector);
    noiseElements.forEach((el) => el.remove());
  });

  // Extract text from relevant elements
  let textElements = contentClone.querySelectorAll(
    "p, h1, h2, h3, h4, h5, h6, li, blockquote, .post-content, .article-content"
  );
  let extractedText = "";

  // If no specific content elements found, get all text nodes
  if (textElements.length === 0) {
    // Get all text nodes
    const textNodes = [];
    const walk = document.createTreeWalker(
      contentClone,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    let node;
    while ((node = walk.nextNode())) {
      if (node.nodeValue.trim().length > 0) {
        textNodes.push(node);
      }
    }

    // Extract text from text nodes
    textNodes.forEach((node) => {
      extractedText += node.nodeValue.trim() + " "; // Add space to avoid cutting sentences
    });
  } else {
    // Extract text from specific elements
    textElements.forEach((el) => {
      // Add heading markers for better context
      if (el.tagName.match(/^H[1-6]$/)) {
        extractedText += "\n## " + el.innerText.trim() + "\n\n";
      } else {
        extractedText += el.innerText.trim() + " "; // Add space to avoid cutting sentences
      }
    });
  }

  // Clean up the text
  extractedText = extractedText
    .replace(/\s{2,}/g, " ") // Replace multiple spaces with a single space
    .replace(/\n{3,}/g, "\n\n") // Replace multiple newlines with just two
    .trim();

  return extractedText;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received:", request); // Log when a message is received
  if (request.action === "extractText") {
    let text = extractMainText();
    console.log("Extracted text length:", text.length); // Log the length of the extracted text
    sendResponse({ extractedText: text });
  }
  return true; // Return true to indicate we will respond asynchronously
});
