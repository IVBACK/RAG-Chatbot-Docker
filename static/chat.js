// static/chat.js

// References to DOM elements
const chat = document.getElementById("chat");
const input = document.getElementById("message");
const sendBtn = document.getElementById("sendBtn");
let currentController = null; // To cancel API requests

// Load history and set theme when the page loads
window.onload = () => {
  // Load chat history from localStorage
  const history = JSON.parse(localStorage.getItem("chatHistory") || "[]");
  history.forEach(entry => {
    // Call appendMessage for each message in history (sanitization should be handled within appendMessage if necessary)
    appendMessage(entry.role, entry.text, entry.time);
  });

  // Apply the saved theme mode (dark/light)
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
  }

  // Scroll the chat box to the bottom
  chat.scrollTop = chat.scrollHeight;

  // Focus on the input field initially
  input.focus();
};

// Function to toggle theme
function toggleTheme() {
  document.body.classList.toggle("dark-mode");
  const mode = document.body.classList.contains("dark-mode") ? "dark" : "light";
  localStorage.setItem("theme", mode); // Save the selected theme
}

// Function to clear chat history
function clearHistory() {
  // If there's an ongoing API request, cancel it
  if (currentController) {
    currentController.abort();
    currentController = null;
  }
  // Remove history from localStorage
  localStorage.removeItem("chatHistory");
  // Clear the chat box display
  chat.innerHTML = "";
  input.focus(); // Focus back on input
}

// Function to send a message to the server
async function sendMessage() {
    const msg = input.value.trim(); // Get input value and trim whitespace
    if (!msg) return; // Don't send empty messages
  
    // Disable button and input during sending
    sendBtn.disabled = true;
    input.disabled = true;
    input.style.opacity = "0.5";
  
    const now = new Date();
    // Format time (use 'en-US' locale or adjust as needed)
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  
    // User message continues to be appended with a timestamp
    appendMessage("user", msg, time);
    saveToHistory("user", msg, time);
    input.value = ""; // Clear input field
  
    // --- CHANGE: Do NOT send timestamp for the "Thinking..." message ---
    const typingMsg = appendMessage("bot", `<span class="typing-dots">Thinking</span>`); // 'time' argument removed
  
    currentController = new AbortController();
    const history = JSON.parse(localStorage.getItem("chatHistory") || "[]");
    const formattedHistory = history.map(entry => ({
      role: entry.role === "user" ? "user" : "assistant",
      content: entry.text
    }));
  
    try {
      // Send POST request to the API
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: formattedHistory }),
        signal: currentController.signal
      });
  
      // Check if the response status is OK (e.g., 200-299)
      if (!res.ok) {
          let errorDetails = `HTTP error! Status: ${res.status}`;
          try {
              const errorData = await res.json();
              errorDetails = errorData.error || errorDetails;
          } catch (parseError) { /* Ignore if error response isn't JSON */ }
          throw new Error(errorDetails);
      }
  
      // Get the response as JSON
      const data = await res.json();
  
       // Check if the expected 'response' key exists
       if (typeof data.response === 'undefined') {
          console.error("Backend response missing 'response' key:", data);
          throw new Error("Invalid response format from server.");
      }
  
      // Get NEW timestamp AFTER successful response
      const responseTimeNow = new Date();
      const responseTime = responseTimeNow.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); // Use 'en-US' or desired locale
  
      // Sanitize the received response
      const cleanResponse = DOMPurify.sanitize(data.response || '');
      // Format the sanitized HTML
      const finalHtml = markdownToHtml(cleanResponse);
  
      // --- NO CHANGE: Final response gets updated with the correct 'responseTime' ---
      typingMsg.innerHTML = `${finalHtml}<div class="time">${responseTime}</div>`;
      // Save bot message with the correct time
      saveToHistory("bot", cleanResponse, responseTime);
  
    } catch (error) {
      // Handle errors
      if (error.name === "AbortError") {
        // Request was cancelled by the user
        typingMsg.remove();
      } else {
        // Get timestamp for the error
        const errorTimeNow = new Date();
        const errorTime = errorTimeNow.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); // Use 'en-US' or desired locale
        // Log the actual error for debugging
        console.error("Error fetching or processing chat response:", error);
        // --- CHANGE: Add timestamp to the error message as well ---
        typingMsg.innerHTML = `<i>An error occurred: ${error.message || 'Please try again.'}</i><div class="time">${errorTime}</div>`;
      }
    } finally {
      // Re-enable button and input regardless of success or error
      sendBtn.disabled = false;
      input.disabled = false;
      input.style.opacity = "1";
      input.focus();
      currentController = null;
    }
  }

// Function to append a message to the chat box
// Function to append a message to the chat box
function appendMessage(role, text, time) { // 'time' parameter is now optional
    const div = document.createElement("div");
    div.classList.add("chat-message", role);
  
    // Format/sanitize the main message text
    let messageHtml = markdownToHtml(text);
  
    // Only add the timestamp div if the 'time' parameter was provided
    if (time) {
      messageHtml += `<div class="time">${time}</div>`;
    }
  
    div.innerHTML = messageHtml; // Set the message content
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight; // Scroll to bottom
    return div; // Return the created element
  }

// Function to save a message to localStorage
function saveToHistory(role, text, time) {
  const history = JSON.parse(localStorage.getItem("chatHistory") || "[]");
  history.push({ role, text, time });
  localStorage.setItem("chatHistory", JSON.stringify(history));
}

// Function to convert basic Markdown to HTML
function markdownToHtml(text) {
    // Replace newlines with <br>
    // Convert URLs to clickable links (add rel="noopener noreferrer" for security)
    // Ensure this function doesn't break HTML sanitized by DOMPurify.
   return text
        .replace(/\n/g, '<br>')
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

// Listen for Enter key press in the input field
input.addEventListener("keydown", function (e) {
  // If the pressed key is Enter and the input is not disabled
  if (e.key === "Enter" && !input.disabled) {
    e.preventDefault(); // Prevent default Enter behavior (like form submission)
    sendMessage(); // Call the sendMessage function
  }
});