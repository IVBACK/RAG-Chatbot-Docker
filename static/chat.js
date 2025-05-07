// static/chat.js

// References to DOM elements
const chat = document.getElementById("chat");
const input = document.getElementById("message");
const sendBtn = document.getElementById("sendBtn");
const chatList = document.getElementById("chatList");
const contextMenu = document.getElementById("contextMenu");
const chatSearchInput = document.getElementById("chatSearchInput");
const clearChatSearchBtn = document.getElementById("clearChatSearchBtn");
const sidebarSearchInput = document.getElementById("sidebarSearchInput");
const loadingOverlay = document.getElementById("loadingOverlay");
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsModalBtn = document.getElementById("closeSettingsModal");
const searchToggleBtn = document.getElementById('searchToggleBtn');
const searchContainer = document.querySelector('.search-container');
const searchWrapper = document.querySelector('.search-wrapper'); // Parent of icon and search input field
let currentController = null;
let currentChatId = null;
let selectedChatItemForContextMenu = null;

// Load history and set theme when the page loads
window.onload = () => {
  // Force dark mode
  document.body.classList.add("dark-mode");
  localStorage.setItem("theme", "dark");

  // Load chat list and select the most recent chat
  loadChatList();
  
  // Set up auto-growing textarea
  setupTextarea();

  // Setup context menu event listeners
  setupContextMenu();

  // Setup chat search listeners
  setupEnhancedSearch();

  // Setup settings modal listeners
  setupSettingsModal();
};

// Loading Indicator Functions
function showLoadingIndicator(message = "Loading chat...") {
  if (loadingOverlay) {
    loadingOverlay.querySelector('p').textContent = message;
    loadingOverlay.style.display = 'flex';
  }
}

function hideLoadingIndicator() {
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

// Function to generate a unique chat ID
function generateChatId() {
  return 'chat_' + Date.now();
}

// Function to start a new chat
async function startNewChat() {
  showLoadingIndicator("Creating new chat...");
  try {
    if (currentController) {
      currentController.abort();
      currentController = null;
    }

    const chatId = generateChatId();
    const chatData = {
      id: chatId,
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString()
    };

    const chats = JSON.parse(localStorage.getItem("chats") || "{}");
    chats[chatId] = chatData;
    localStorage.setItem("chats", JSON.stringify(chats));

    addChatToList(chatData);
    await switchToChat(chatId, false); // Pass false to prevent nested loading indicators

  } catch (error) {
    console.error('Error creating new chat:', error);
    // Optionally, show an error message to the user here
  } finally {
    hideLoadingIndicator();
  }
}

// Function to add a chat to the list
function addChatToList(chatData) {
  const chatItem = document.createElement("div");
  chatItem.className = "chat-item";
  chatItem.dataset.chatId = chatData.id;
  chatItem.innerHTML = `
    <i class="fas fa-message"></i>
    <span class="chat-title">${escapeHtml(chatData.title)}</span>
  `;

  // Add click handler for switching chats
  chatItem.addEventListener("click", () => switchToChat(chatData.id));

  // Add context menu handler
  chatItem.addEventListener("contextmenu", (e) => showContextMenu(e, chatData.id));

  chatList.insertBefore(chatItem, chatList.firstChild);
}

// Function to switch to a specific chat
async function switchToChat(chatId, showIndicator = true) {
  console.log(`Attempting to switch to chat: ${chatId}, current: ${currentChatId}, showIndicator: ${showIndicator}`);

  // If already on the target chat AND this call is NOT from startNewChat (indicated by showIndicator = true)
  // then there's no need to do anything.
  if (currentChatId === chatId && showIndicator) {
    console.log('Already on the target chat, no action needed.');
    return;
  }

  if (showIndicator) {
    showLoadingIndicator("Loading chat...");
  }

  try {
    // Special handling for startNewChat: if we are switching to the chat that was just created.
    if (currentChatId === chatId && !showIndicator) { 
        console.log('Switching to a newly created chat.');
        chat.innerHTML = ''; 
        input.value = "";
        input.style.height = 'auto';
        input.focus();
        const items = document.querySelectorAll('.chat-item');
        items.forEach(item => {
            item.classList.toggle('selected', item.dataset.chatId === chatId);
        });
        scrollToBottom();
        return; 
    }

    // Standard chat switch (user clicks a different chat in the list)
    console.log(`Proceeding with switch from ${currentChatId} to ${chatId}`);
    if (currentChatId) {
      saveChatState(currentChatId);
    }
    
    // Clear search state when switching chats
    if (chatSearchInput) {
        chatSearchInput.value = ''; // Clear the search input field
    }
    if (clearChatSearchBtn) { // Hide the clear button for the search input
        clearChatSearchBtn.style.display = 'none';
    }
    clearChatHighlights(); // Clear any visual highlights from messages
    
    chat.innerHTML = ''; 

    currentChatId = chatId;

    const chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(item => {
      item.classList.toggle('selected', item.dataset.chatId === currentChatId);
    });

    await loadChatState(currentChatId); 

  } catch (error) {
    console.error('Error switching chat:', error);
  } finally {
    if (showIndicator) {
      hideLoadingIndicator();
    }
  }
}

// Function to save current chat state
function saveChatState(chatId) {
  const chats = JSON.parse(localStorage.getItem("chats") || "{}");
  if (chats[chatId]) {
    chats[chatId].messages = JSON.parse(localStorage.getItem("chatHistory") || "[]");
    localStorage.setItem("chats", JSON.stringify(chats));
  }
}

// Function to load chat state
async function loadChatState(chatId) {
  // Removed show/hide loading indicator from here as switchToChat handles it
  const chats = JSON.parse(localStorage.getItem("chats") || "{}");
  const chatData = chats[chatId];
  
  // chat.innerHTML = ""; // Cleared in switchToChat
  
  if (chatData) {
    localStorage.setItem("chatHistory", JSON.stringify(chatData.messages || []));
    if (chatData.messages) {
        chatData.messages.forEach(msg => {
            appendMessage(msg.role, msg.text, msg.time);
        });
    }
    input.value = "";
    input.style.height = 'auto';
    input.focus();
  } else {
    // Handle case where chatData might not exist for some reason
    chat.innerHTML = '<p style="text-align:center; color: #888;">Could not load chat.</p>';
  }
  scrollToBottom();
}

// Function to load chat list
function loadChatList() {
  const chats = JSON.parse(localStorage.getItem("chats") || "{}");
  chatList.innerHTML = "";

  // Sort chats by creation date (newest first)
  const sortedChats = Object.values(chats).sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  sortedChats.forEach(chatData => {
    addChatToList(chatData);
  });

  // Select the most recent chat or create a new one
  if (sortedChats.length > 0) {
    switchToChat(sortedChats[0].id);
  } else {
    startNewChat();
  }
}

// Context menu functions
function setupContextMenu() {
  // Hide context menu on click outside
  document.addEventListener("click", () => {
    contextMenu.style.display = "none";
  });

  // Prevent default context menu on chat items
  chatList.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
}

function showContextMenu(e, chatId) {
  e.preventDefault();
  selectedChatItemForContextMenu = chatId;

  // Position the menu
  contextMenu.style.display = "block";
  contextMenu.style.left = `${e.pageX}px`;
  contextMenu.style.top = `${e.pageY}px`;

  // Adjust menu position if it would go off screen
  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = `${e.pageX - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = `${e.pageY - rect.height}px`;
  }
}

function renameChat() {
  if (!selectedChatItemForContextMenu) return;

  const chats = JSON.parse(localStorage.getItem("chats") || "{}");
  const chat = chats[selectedChatItemForContextMenu];
  
  if (chat) {
    const newTitle = prompt("Enter new chat name:", chat.title);
    if (newTitle && newTitle.trim()) {
      chat.title = newTitle.trim();
      localStorage.setItem("chats", JSON.stringify(chats));
      
      // Update chat item in the list
      const chatItem = document.querySelector(`[data-chat-id="${selectedChatItemForContextMenu}"]`);
      if (chatItem) {
        chatItem.querySelector('.chat-title').textContent = newTitle.trim();
        // Re-apply filter after renaming
        const currentFilter = sidebarSearchInput.value.toLowerCase().trim();
        const title = (chat.title || '').toLowerCase();
        if (currentFilter && !title.includes(currentFilter)) {
          chatItem.style.display = 'none';
        } else {
          chatItem.style.display = 'flex';
        }
      }
    }
  }

  contextMenu.style.display = "none";
}

// Modify deleteChat to handle async switchToChat
async function deleteChat() {
  if (!selectedChatItemForContextMenu) return;

  const chats = JSON.parse(localStorage.getItem("chats") || "{}");
  const chatToDelete = chats[selectedChatItemForContextMenu];

  if (!chatToDelete) return;

  if (!confirm(`Are you sure you want to delete the chat "${chatToDelete.title}"? This action cannot be undone.`)) {
    contextMenu.style.display = "none";
    return;
  }

  delete chats[selectedChatItemForContextMenu];
  localStorage.setItem("chats", JSON.stringify(chats));

  const chatItem = document.querySelector(`[data-chat-id="${selectedChatItemForContextMenu}"]`);
  if (chatItem) {
    chatItem.remove();
  }

  if (selectedChatItemForContextMenu === currentChatId) {
    const remainingChats = Object.keys(chats);
    if (remainingChats.length > 0) {
      await switchToChat(remainingChats[0]);
    } else {
      await startNewChat();
    }
  }
  currentChatId = null; 
  selectedChatItemForContextMenu = null; 
  contextMenu.style.display = "none";
}

// Utility function to escape HTML
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Function to scroll chat to bottom
function scrollToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

// Setup auto-growing textarea
function setupTextarea() {
  function adjustHeight() {
    input.style.height = 'auto';
    input.style.height = (input.scrollHeight) + 'px';
  }

  input.addEventListener('input', adjustHeight);
  
  // Handle Enter key for sending message
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !input.disabled) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// Function to convert markdown to HTML and apply syntax highlighting
function markdownToHtml(text) {
  // Convert basic markdown (links, newlines)
  let html = text
    .replace(/\n/g, '<br>')
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

  // Convert ```code``` blocks
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    // For multi-line code blocks, preserve line breaks within <pre><code>
    // Escape HTML within the code block before highlighting
    const escapedCode = escapeHtml(code.trim());
    return `<pre><code class="hljs">${escapedCode}</code></pre>`;
  });

  // Convert `code` spans (inline code)
  html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');
  
  return html;
}

// Function to append a message to the chat
function appendMessage(role, text, time) {
  const div = document.createElement("div");
  div.classList.add("chat-message", role);

  let messageHtml = markdownToHtml(text);
  if (time) {
    const timestamp = new Date().toISOString();
    messageHtml += `<div class="time" data-timestamp="${timestamp}">${formatTimestamp(timestamp)}</div>`;
  }

  div.innerHTML = messageHtml;
  chat.appendChild(div);
  
  // Apply syntax highlighting to any new code blocks
  div.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block);
  });

  // If a search is active, check if the new message should be visible
  const currentSearchQuery = chatSearchInput.value.toLowerCase().trim();
  if (currentSearchQuery) {
    const messageText = (div.textContent || div.innerText || "").toLowerCase();
    const timeElement = div.querySelector('.time');
    let searchableText = messageText;
    if (timeElement && timeElement.textContent) {
        searchableText = messageText.replace(timeElement.textContent.toLowerCase(), '').trim();
    }

    if (searchableText.includes(currentSearchQuery)) {
      div.style.display = 'flex';
      div.classList.add('highlight');
    } else {
      div.style.display = 'none';
      div.classList.remove('highlight');
    }
  }

  scrollToBottom();
  return div;
}

// Function to save message to localStorage
function saveToHistory(role, text, time) {
  const history = JSON.parse(localStorage.getItem("chatHistory") || "[]");
  history.push({ role, text, time });
  localStorage.setItem("chatHistory", JSON.stringify(history));
}

// Function to send a message
async function sendMessage() {
  const msg = input.value.trim();
  if (!msg || input.disabled) return;

  // Disable input and button during sending
  input.disabled = true;
  sendBtn.disabled = true;
  input.style.opacity = "0.5";

  const now = new Date();
  const time = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Append user message (user messages are not processed for markdown highlighting)
  const userDiv = document.createElement("div");
  userDiv.classList.add("chat-message", "user");
  let userMessageHtml = escapeHtml(msg); // User messages should be escaped for safety
  if (time) {
    userMessageHtml += `<div class="time">${time}</div>`;
  }
  userDiv.innerHTML = userMessageHtml;
  chat.appendChild(userDiv);
  scrollToBottom();
  
  saveToHistory("user", msg, time); // Save the raw user message
  
  // Clear input and reset height
  input.value = "";
  input.style.height = 'auto';

  // Show typing indicator
  const typingMsg = appendMessage("bot", `<span class="typing-dots">Thinking</span>`);

  // Prepare the request
  currentController = new AbortController();
  const history = JSON.parse(localStorage.getItem("chatHistory") || "[]");
  const formattedHistory = history.map(entry => ({
    role: entry.role === "user" ? "user" : "assistant",
    content: entry.text // Send raw text to backend
  }));

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: formattedHistory }),
      signal: currentController.signal
    });

    if (!res.ok) {
      let errorDetails = `HTTP error! Status: ${res.status}`;
      try {
        const errorData = await res.json();
        errorDetails = errorData.error || errorDetails;
      } catch (parseError) {}
      throw new Error(errorDetails);
    }

    const data = await res.json();
    if (typeof data.response === 'undefined') {
      throw new Error("Invalid response format from server.");
    }

    // Get response timestamp
    const responseTime = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Sanitize the received response BEFORE markdown processing
    const cleanResponse = DOMPurify.sanitize(data.response || '');
    
    // Format with markdownToHtml and display the response
    const finalHtml = markdownToHtml(cleanResponse);
    typingMsg.innerHTML = `${finalHtml}<div class="time">${responseTime}</div>`;
    
    // Apply syntax highlighting to the updated message
    typingMsg.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
    
    // Save bot message (raw response, before markdownToHtml)
    saveToHistory("bot", cleanResponse, responseTime);
    
    // Scroll to the latest message
    scrollToBottom();

  } catch (error) {
    if (error.name === "AbortError") {
      typingMsg.remove();
    } else {
      const errorTime = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      console.error("Error:", error);
      // Error messages are not processed for markdown highlighting
      typingMsg.innerHTML = `<i>An error occurred: ${escapeHtml(error.message || 'Please try again.')}</i><div class="time">${errorTime}</div>`;
    }
  } finally {
    // Re-enable input and button
    input.disabled = false;
    sendBtn.disabled = false;
    input.style.opacity = "1";
    input.focus();
    currentController = null;
  }
}

// Function to setup chat search
function setupEnhancedSearch() {
  if (searchToggleBtn && searchContainer && chatSearchInput && clearChatSearchBtn && searchWrapper) {
    searchToggleBtn.addEventListener('click', function(event) {
      event.stopPropagation(); 
      if (!searchContainer.classList.contains('active')) {
        searchContainer.style.display = 'flex';
        searchContainer.offsetHeight; // Force reflow for transition
        searchContainer.classList.add('active');
        chatSearchInput.focus();
      } else {
        searchContainer.classList.remove('active');
        setTimeout(() => {
          if (!searchContainer.classList.contains('active')) {
            searchContainer.style.display = 'none';
          }
        }, 200); // Matches CSS transition duration
      }
    });

    chatSearchInput.addEventListener('input', function() {
      const searchText = this.value.toLowerCase().trim();
      if (clearChatSearchBtn) {
        clearChatSearchBtn.style.display = searchText ? 'inline-block' : 'none';
      }
      if (searchText) {
        searchInChat(searchText);
      } else {
        clearChatHighlights();
      }
    });

    clearChatSearchBtn.addEventListener('click', function(event) {
      event.stopPropagation();
      chatSearchInput.value = '';
      clearChatHighlights();
      this.style.display = 'none';
      chatSearchInput.focus();
      // Optional: To close search bar on clear, uncomment below
      // searchContainer.classList.remove('active');
      // setTimeout(() => { 
      //   if (!searchContainer.classList.contains('active')) {
      //     searchContainer.style.display = 'none'; 
      //   }
      // }, 200);
    });

    document.addEventListener('click', function(event) {
      if (searchContainer.classList.contains('active') && 
          !searchWrapper.contains(event.target)) {
        searchContainer.classList.remove('active');
        setTimeout(() => {
          if (!searchContainer.classList.contains('active')) {
            searchContainer.style.display = 'none';
          }
        }, 200);
      }
    });

    searchContainer.addEventListener('click', function(event) {
      event.stopPropagation();
    });
  }
}

// Replace previous searchInChat and clearChatHighlights if they were different
// The versions from previous correct state:
function searchInChat(searchText) {
    const messages = document.querySelectorAll('.chat-message');
    let firstMatchFound = false;
    messages.forEach(message => {
        // To search only message text, excluding timestamp
        const messageContent = message.cloneNode(true);
        const timeElement = messageContent.querySelector('.time');
        if (timeElement) {
            messageContent.removeChild(timeElement);
        }
        const text = messageContent.textContent.toLowerCase();
        
        if (text.includes(searchText)) {
            message.classList.add('highlight');
            message.style.display = 'flex';
            if (!firstMatchFound) {
                // Optional: scroll to first match. Could be jittery.
                // message.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstMatchFound = true;
            }
        } else {
            message.classList.remove('highlight');
            message.style.display = 'none'; // Hide non-matching messages during search
        }
    });
    if (!firstMatchFound && messages.length > 0) {
        // If no matches, perhaps show a message or keep all hidden if that's desired.
        // For now, all non-matches are hidden.
    }
    if (searchText === '' && messages.length > 0){
         scrollToBottom(); // Scroll to bottom if search is cleared
    }
}

function clearChatHighlights() {
    const messages = document.querySelectorAll('.chat-message');
    messages.forEach(message => {
        message.classList.remove('highlight');
        message.style.display = 'flex'; // Display all messages
    });
    scrollToBottom(); // Scroll to bottom when search is cleared
}

// Settings Management
const defaultSettings = {
  fontSize: 'medium',
  messageSpacing: 'normal',
  timestampFormat: '12hour',
  maxMessages: '100',
  language: 'en'
};

// Translations
const translations = {
  en: {
    newChat: 'New Chat',
    settings: 'Settings',
    search: 'Search in chat...',
    typeMessage: 'Type your message here...',
    rename: 'Rename',
    delete: 'Delete',
    clearAllChats: 'Clear All Chats',
    clearConfirm: 'Are you sure you want to delete all chats? This action cannot be undone.',
    thinking: 'Thinking',
    error: 'An error occurred: ',
    interfaceSettings: 'Interface Settings',
    messageDisplay: 'Message Display',
    storageSettings: 'Storage Settings',
    fontSize: 'Font Size',
    messageSpacing: 'Message Spacing',
    maxMessages: 'Maximum Messages in History',
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    compact: 'Compact',
    normal: 'Normal',
    relaxed: 'Relaxed',
    interfaceLanguage: 'Interface Language',
    timeFormat: 'Time Format',
    timeFormat12: '12:00 PM',
    timeFormat24: '13:00',
    tiny: 'Tiny',
    extraSmall: 'Extra Small',
    extraLarge: 'Extra Large',
    huge: 'Huge',
    extraCompact: 'Extra Compact',
    spacious: 'Spacious',
    extraSpacious: 'Extra Spacious'
  },
  de: {
    newChat: 'Neuer Chat',
    settings: 'Einstellungen',
    search: 'Chat durchsuchen...',
    typeMessage: 'Nachricht hier eingeben...',
    rename: 'Umbenennen',
    delete: 'Löschen',
    clearAllChats: 'Alle Chats löschen',
    clearConfirm: 'Möchten Sie wirklich alle Chats löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
    thinking: 'Denkt nach',
    error: 'Ein Fehler ist aufgetreten: ',
    interfaceSettings: 'Oberflächeneinstellungen',
    messageDisplay: 'Nachrichtenanzeige',
    storageSettings: 'Speichereinstellungen',
    fontSize: 'Schriftgröße',
    messageSpacing: 'Nachrichtenabstand',
    maxMessages: 'Maximale Nachrichten im Verlauf',
    small: 'Klein',
    medium: 'Mittel',
    large: 'Groß',
    compact: 'Kompakt',
    normal: 'Normal',
    relaxed: 'Entspannt',
    interfaceLanguage: 'Oberflächensprache',
    timeFormat: 'Zeitformat',
    timeFormat12: '12:00 PM',
    timeFormat24: '13:00',
    tiny: 'Winzig',
    extraSmall: 'Sehr Klein',
    extraLarge: 'Sehr Groß',
    huge: 'Riesig',
    extraCompact: 'Sehr Kompakt',
    spacious: 'Geräumig',
    extraSpacious: 'Sehr Geräumig'
  },
  zh: {
    newChat: '新对话',
    settings: '设置',
    search: '搜索对话...',
    typeMessage: '在此输入消息...',
    rename: '重命名',
    delete: '删除',
    clearAllChats: '清除所有对话',
    clearConfirm: '确定要删除所有对话吗？此操作无法撤消。',
    thinking: '思考中',
    error: '发生错误：',
    interfaceSettings: '界面设置',
    messageDisplay: '消息显示',
    storageSettings: '存储设置',
    fontSize: '字体大小',
    messageSpacing: '消息间距',
    maxMessages: '历史消息最大数量',
    small: '小',
    medium: '中',
    large: '大',
    compact: '紧凑',
    normal: '正常',
    relaxed: '宽松',
    interfaceLanguage: '界面语言',
    timeFormat: '时间格式',
    timeFormat12: '上午 12:00',
    timeFormat24: '13:00',
    tiny: '极小',
    extraSmall: '特小',
    extraLarge: '特大',
    huge: '极大',
    extraCompact: '极紧凑',
    spacious: '宽敞',
    extraSpacious: '特宽敞'
  },
  hi: {
    newChat: 'नई चैट',
    settings: 'सेटिंग्स',
    search: 'चैट में खोजें...',
    typeMessage: 'यहां अपना संदेश लिखें...',
    rename: 'नाम बदलें',
    delete: 'हटाएं',
    clearAllChats: 'सभी चैट साफ़ करें',
    clearConfirm: 'क्या आप वाकई सभी चैट हटाना चाहते हैं? यह क्रिया वापस नहीं ली जा सकती।',
    thinking: 'सोच रहा हूं',
    error: 'एक त्रुटि हुई: ',
    interfaceSettings: 'इंटरफ़ेस सेटिंग्स',
    messageDisplay: 'संदेश प्रदर्शन',
    storageSettings: 'स्टोरेज सेटिंग्स',
    fontSize: 'फ़ॉन्ट आकार',
    messageSpacing: 'संदेश अंतर',
    maxMessages: 'अधिकतम संदेश इतिहास',
    small: 'छोटा',
    medium: 'मध्यम',
    large: 'बड़ा',
    compact: 'संकुचित',
    normal: 'सामान्य',
    relaxed: 'विस्तृत',
    interfaceLanguage: 'इंटरफ़ेस भाषा',
    timeFormat: 'समय प्रारूप',
    timeFormat12: '12:00 पूर्वाह्न',
    timeFormat24: '13:00',
    tiny: 'बहुत छोटा',
    extraSmall: 'अति छोटा',
    extraLarge: 'बहुत बड़ा',
    huge: 'विशाल',
    extraCompact: 'अति संकुचित',
    spacious: 'विशाल',
    extraSpacious: 'अति विशाल'
  },
  es: {
    newChat: 'Nueva Conversación',
    settings: 'Configuración',
    search: 'Buscar en el chat...',
    typeMessage: 'Escribe tu mensaje aquí...',
    rename: 'Renombrar',
    delete: 'Eliminar',
    clearAllChats: 'Borrar Todos los Chats',
    clearConfirm: '¿Estás seguro de que quieres eliminar todos los chats? Esta acción no se puede deshacer.',
    thinking: 'Pensando',
    error: 'Ocurrió un error: ',
    interfaceSettings: 'Configuración de Interfaz',
    messageDisplay: 'Visualización de Mensajes',
    storageSettings: 'Configuración de Almacenamiento',
    fontSize: 'Tamaño de Fuente',
    messageSpacing: 'Espaciado de Mensajes',
    maxMessages: 'Máximo de Mensajes en Historial',
    small: 'Pequeño',
    medium: 'Mediano',
    large: 'Grande',
    compact: 'Compacto',
    normal: 'Normal',
    relaxed: 'Relajado',
    interfaceLanguage: 'Idioma de Interfaz',
    timeFormat: 'Formato de Hora',
    timeFormat12: '12:00 PM',
    timeFormat24: '13:00',
    tiny: 'Diminuto',
    extraSmall: 'Muy Pequeño',
    extraLarge: 'Muy Grande',
    huge: 'Enorme',
    extraCompact: 'Muy Compacto',
    spacious: 'Espacioso',
    extraSpacious: 'Muy Espacioso'
  },
  ar: {
    newChat: 'محادثة جديدة',
    settings: 'الإعدادات',
    search: 'البحث في المحادثة...',
    typeMessage: 'اكتب رسالتك هنا...',
    rename: 'إعادة تسمية',
    delete: 'حذف',
    clearAllChats: 'مسح جميع المحادثات',
    clearConfirm: 'هل أنت متأكد من حذف جميع المحادثات؟ لا يمكن التراجع عن هذا الإجراء.',
    thinking: 'يفكر',
    error: 'حدث خطأ: ',
    interfaceSettings: 'إعدادات الواجهة',
    messageDisplay: 'عرض الرسائل',
    storageSettings: 'إعدادات التخزين',
    fontSize: 'حجم الخط',
    messageSpacing: 'تباعد الرسائل',
    maxMessages: 'الحد الأقصى للرسائل في السجل',
    small: 'صغير',
    medium: 'متوسط',
    large: 'كبير',
    compact: 'متراص',
    normal: 'عادي',
    relaxed: 'متباعد',
    interfaceLanguage: 'لغة الواجهة',
    timeFormat: 'تنسيق الوقت',
    timeFormat12: '12:00 ص',
    timeFormat24: '13:00',
    tiny: 'متناهي الصغر',
    extraSmall: 'صغير جداً',
    extraLarge: 'كبير جداً',
    huge: 'ضخم',
    extraCompact: 'متراص جداً',
    spacious: 'واسع',
    extraSpacious: 'واسع جداً'
  },
  tr: {
    newChat: 'Yeni Sohbet',
    settings: 'Ayarlar',
    search: 'Sohbette ara...',
    typeMessage: 'Mesajınızı buraya yazın...',
    rename: 'Yeniden Adlandır',
    delete: 'Sil',
    clearAllChats: 'Tüm Sohbetleri Sil',
    clearConfirm: 'Tüm sohbetleri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
    thinking: 'Düşünüyor',
    error: 'Bir hata oluştu: ',
    interfaceSettings: 'Arayüz Ayarları',
    messageDisplay: 'Mesaj Görünümü',
    storageSettings: 'Depolama Ayarları',
    fontSize: 'Yazı Boyutu',
    messageSpacing: 'Mesaj Aralığı',
    maxMessages: 'Geçmişteki Maksimum Mesaj Sayısı',
    small: 'Küçük',
    medium: 'Orta',
    large: 'Büyük',
    compact: 'Sıkışık',
    normal: 'Normal',
    relaxed: 'Geniş',
    interfaceLanguage: 'Arayüz Dili',
    timeFormat: 'Zaman Biçimi',
    timeFormat12: '12:00 ÖÖ',
    timeFormat24: '13:00',
    tiny: 'Çok Küçük',
    extraSmall: 'Ekstra Küçük',
    extraLarge: 'Ekstra Büyük',
    huge: 'Çok Büyük',
    extraCompact: 'Çok Sıkışık',
    spacious: 'Çok Geniş',
    extraSpacious: 'Ekstra Geniş'
  },
  fr: {
    newChat: 'Nouvelle Conversation',
    settings: 'Paramètres',
    search: 'Rechercher dans la conversation...',
    typeMessage: 'Écrivez votre message ici...',
    rename: 'Renommer',
    delete: 'Supprimer',
    clearAllChats: 'Effacer Toutes les Conversations',
    clearConfirm: 'Êtes-vous sûr de vouloir supprimer toutes les conversations ? Cette action est irréversible.',
    thinking: 'Réflexion',
    error: 'Une erreur est survenue : ',
    interfaceSettings: 'Paramètres d\'Interface',
    messageDisplay: 'Affichage des Messages',
    storageSettings: 'Paramètres de Stockage',
    fontSize: 'Taille de Police',
    messageSpacing: 'Espacement des Messages',
    maxMessages: 'Maximum de Messages dans l\'Historique',
    small: 'Petit',
    medium: 'Moyen',
    large: 'Grand',
    compact: 'Compact',
    normal: 'Normal',
    relaxed: 'Détendu',
    interfaceLanguage: 'Langue d\'Interface',
    timeFormat: 'Format de l\'Heure',
    timeFormat12: '12:00 PM',
    timeFormat24: '13:00',
    tiny: 'Minuscule',
    extraSmall: 'Très Petit',
    extraLarge: 'Très Grand',
    huge: 'Énorme',
    extraCompact: 'Très Compact',
    spacious: 'Spacieux',
    extraSpacious: 'Très Spacieux'
  },
  ru: {
    newChat: 'Новый Чат',
    settings: 'Настройки',
    search: 'Поиск в чате...',
    typeMessage: 'Введите ваше сообщение здесь...',
    rename: 'Переименовать',
    delete: 'Удалить',
    clearAllChats: 'Очистить Все Чаты',
    clearConfirm: 'Вы уверены, что хотите удалить все чаты? Это действие нельзя отменить.',
    thinking: 'Думаю',
    error: 'Произошла ошибка: ',
    interfaceSettings: 'Настройки Интерфейса',
    messageDisplay: 'Отображение Сообщений',
    storageSettings: 'Настройки Хранения',
    fontSize: 'Размер Шрифта',
    messageSpacing: 'Интервал Сообщений',
    maxMessages: 'Максимум Сообщений в Истории',
    small: 'Маленький',
    medium: 'Средний',
    large: 'Большой',
    compact: 'Компактный',
    normal: 'Обычный',
    relaxed: 'Свободный',
    interfaceLanguage: 'Язык Интерфейса',
    timeFormat: 'Формат Времени',
    timeFormat12: '12:00 PM',
    timeFormat24: '13:00',
    tiny: 'Крошечный',
    extraSmall: 'Очень Маленький',
    extraLarge: 'Очень Большой',
    huge: 'Огромный',
    extraCompact: 'Очень Компактный',
    spacious: 'Просторный',
    extraSpacious: 'Очень Просторный'
  }
};

// Load settings from localStorage or use defaults
function loadSettings() {
  const savedSettings = JSON.parse(localStorage.getItem('chatSettings')) || {};
  return { ...defaultSettings, ...savedSettings };
}

// Save settings to localStorage
function saveSettings(settings) {
  localStorage.setItem('chatSettings', JSON.stringify(settings));
}

// Apply translations based on current language
function applyTranslations() {
  const settings = loadSettings();
  const currentTranslations = translations[settings.language];

  // Add RTL support for Arabic
  document.body.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
  
  // Add language-specific font families
  const fontFamilies = {
    de: '"Segoe UI", system-ui, -apple-system, sans-serif',
    zh: '"Microsoft YaHei", "微软雅黑", sans-serif',
    hi: '"Noto Sans Devanagari", sans-serif',
    ar: '"Noto Sans Arabic", sans-serif',
    default: '"Segoe UI", system-ui, -apple-system, sans-serif'
  };
  
  document.body.style.fontFamily = fontFamilies[settings.language] || fontFamilies.default;

  // Set language attribute for proper font rendering
  document.documentElement.lang = settings.language;

  // Update UI elements with translations
  document.querySelector('.new-chat-btn').innerHTML = 
    `<i class="fas fa-plus"></i> ${currentTranslations.newChat}`;
  
  document.querySelector('#settingsBtn').innerHTML = 
    `<i class="fas fa-cog"></i> ${currentTranslations.settings}`;
  
  document.querySelector('#message').placeholder = currentTranslations.typeMessage;
  document.querySelector('#chatSearchInput').placeholder = currentTranslations.search;
  
  // Update context menu items
  document.querySelector('.context-menu-item:nth-child(1)').innerHTML = 
    `<i class="fas fa-edit"></i> ${currentTranslations.rename}`;
  document.querySelector('.context-menu-item:nth-child(2)').innerHTML = 
    `<i class="fas fa-trash"></i> ${currentTranslations.delete}`;

  // Update all elements with data-translate attribute
  document.querySelectorAll('[data-translate]').forEach(element => {
    const translateKey = element.getAttribute('data-translate');
    if (translateKey && currentTranslations[translateKey]) {
      if (element.tagName.toLowerCase() === 'option') {
        element.text = currentTranslations[translateKey];
      } else if (element.tagName.toLowerCase() === 'input' || 
                 element.tagName.toLowerCase() === 'textarea') {
        element.placeholder = currentTranslations[translateKey];
      } else {
        element.textContent = currentTranslations[translateKey];
      }
    }
  });

  // Update clear button text
  document.querySelector('#clearHistory').textContent = currentTranslations.clearAllChats;
}

// Apply settings to the UI
function applySettings(settings) {
  // Apply font size to chat messages and input
  document.body.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
  document.body.classList.add(`font-size-${settings.fontSize}`);
  
  // Also apply font size to input area
  const messageInput = document.getElementById('message');
  if (messageInput) {
    messageInput.style.fontSize = settings.fontSize === 'small' ? '0.9rem' : 
                                 settings.fontSize === 'large' ? '1.1rem' : '1rem';
  }

  // Apply message spacing
  const chatBox = document.getElementById('chat');
  if (chatBox) {
    chatBox.classList.remove(
      'message-spacing-compact',
      'message-spacing-normal',
      'message-spacing-relaxed'
    );
    chatBox.classList.add(`message-spacing-${settings.messageSpacing}`);
  }

  // Update select elements to reflect current settings
  ['fontSize', 'messageSpacing', 'timestampFormat', 'maxMessages', 'language'].forEach(setting => {
    const element = document.getElementById(setting);
    if (element) {
      element.value = settings[setting];
    }
  });

  // Apply translations
  applyTranslations();

  // Update all existing timestamps
  updateAllTimestamps();

  // Apply max messages limit
  const maxMsgs = parseInt(settings.maxMessages);
  const messages = document.querySelectorAll('.chat-message');
  if (messages.length > maxMsgs) {
    const toRemove = messages.length - maxMsgs;
    for (let i = 0; i < toRemove; i++) {
      messages[i].remove();
    }
  }
}

// Format timestamp based on settings
function formatTimestamp(timestamp) {
  const settings = loadSettings();
  const date = new Date(timestamp);
  const options = {
    hour: settings.timestampFormat === '12hour' ? 'numeric' : '2-digit',
    minute: '2-digit',
    hour12: settings.timestampFormat === '12hour'
  };

  // Use appropriate locale based on language
  const locales = {
    en: 'en-US',
    de: 'de-DE',
    zh: 'zh-CN',
    hi: 'hi-IN',
    es: 'es-ES',
    ar: 'ar-SA',
    tr: 'tr-TR',
    fr: 'fr-FR',
    ru: 'ru-RU'
  };

  return new Intl.DateTimeFormat(locales[settings.language] || 'en-US', options).format(date);
}

// Update all existing timestamps in the chat
function updateAllTimestamps() {
  const timeElements = document.querySelectorAll('.chat-message .time');
  timeElements.forEach(timeElement => {
    const originalTime = timeElement.getAttribute('data-timestamp');
    if (originalTime) {
      timeElement.textContent = formatTimestamp(originalTime);
    }
  });
}

function setupSettingsModal() {
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettingsModal);
  }
  if (closeSettingsModalBtn) {
    closeSettingsModalBtn.addEventListener('click', closeSettingsModal);
  }
  window.addEventListener('click', (event) => {
    if (event.target === settingsModal) {
      closeSettingsModal();
    }
  });

  // Add event listeners for settings changes
  const settingSelects = document.querySelectorAll('.setting-select');
  settingSelects.forEach(select => {
    select.addEventListener('change', (e) => {
      const newSettings = {
        ...loadSettings(),
        [e.target.id]: e.target.value
      };
      saveSettings(newSettings);
      applySettings(newSettings);
    });
  });

  // Clear history button handler
  const clearHistoryBtn = document.getElementById('clearHistory');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      const settings = loadSettings();
      const confirmMessage = translations[settings.language].clearConfirm;
      if (confirm(confirmMessage)) {
        localStorage.removeItem('chats');
        window.location.reload();
      }
    });
  }

  // Initialize settings
  const currentSettings = loadSettings();
  applySettings(currentSettings);
}

function openSettingsModal() {
  if (settingsModal) {
    settingsModal.style.display = "block";
    // Re-apply settings when modal opens to ensure everything is in sync
    applySettings(loadSettings());
  }
}

function closeSettingsModal() {
  if (settingsModal) {
    settingsModal.style.display = "none";
  }
}

// Language handling
const languageSelect = document.getElementById('language');
if (languageSelect) {
  languageSelect.addEventListener('change', (e) => {
    const newSettings = {
      ...loadSettings(),
      language: e.target.value
    };
    saveSettings(newSettings);
    applySettings(newSettings);
  });
}

// Initialize settings on page load
document.addEventListener('DOMContentLoaded', () => {
  const currentSettings = loadSettings();
  applySettings(currentSettings);
});