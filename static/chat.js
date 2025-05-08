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

let currentActiveSettings = {}; // Global variable to hold current settings

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
  setupSettingsModal(); // This will set up listeners that use currentActiveSettings
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

    // Save current chat state before creating new one
    if (currentChatId) {
      await saveChatState(currentChatId);
    }

    const chatId = generateChatId();
    const chatData = {
      id: chatId,
      title: 'New Chat',
      messages: [], // New chat starts with empty messages
      createdAt: new Date().toISOString()
    };

    const chats = JSON.parse(localStorage.getItem("chats") || "{}");
    chats[chatId] = chatData;
    localStorage.setItem("chats", JSON.stringify(chats));

    addChatToList(chatData);
    
    await switchToChat(chatId, false);

  } catch (error) {
    console.error('Error creating new chat:', error);
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

  chatItem.addEventListener("click", () => switchToChat(chatData.id));
  chatItem.addEventListener("contextmenu", (e) => showContextMenu(e, chatData.id));
  chatList.insertBefore(chatItem, chatList.firstChild);
}

// Function to switch to a specific chat
async function switchToChat(chatId, showIndicator = true) {
  console.log(`Attempting to switch to chat: ${chatId}, current: ${currentChatId}, showIndicator: ${showIndicator}`);

  if (currentChatId === chatId && showIndicator) {
    console.log('Already on the target chat, no action needed.');
    return; 
  }

  if (showIndicator) {
    showLoadingIndicator("Loading chat...");
  }

  try {
    if (currentChatId) {
      const currentChatHistory = JSON.parse(localStorage.getItem("chatHistory") || "[]");
      const chats = JSON.parse(localStorage.getItem("chats") || "{}");
      if (chats[currentChatId]) {
        chats[currentChatId].messages = currentChatHistory;
        localStorage.setItem("chats", JSON.stringify(chats));
      }
    }

    chat.innerHTML = '';
    localStorage.setItem("chatHistory", "[]");
    currentChatId = chatId;

    const chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(item => {
      item.classList.toggle('selected', item.dataset.chatId === currentChatId);
    });

    if (chatSearchInput) chatSearchInput.value = '';
    if (clearChatSearchBtn) clearChatSearchBtn.style.display = 'none';
    clearChatHighlights();

    const chats = JSON.parse(localStorage.getItem("chats") || "{}");
    const newChatData = chats[chatId];
    if (newChatData && newChatData.messages) {
      localStorage.setItem("chatHistory", JSON.stringify(newChatData.messages));
      newChatData.messages.forEach(msg => {
        const messageTimestamp = msg.timestamp || msg.time;
        if (msg.role && msg.content && messageTimestamp) {
          appendMessage(msg.role, msg.content, messageTimestamp, currentActiveSettings); // Pass currentActiveSettings
        }
      });
    }
  } catch (error) {
    console.error('Error switching chat:', error);
    chat.innerHTML = '<p style="text-align:center; color: #888;">Error loading chat.</p>';
  } finally {
    if (showIndicator) {
      hideLoadingIndicator();
    }
  }
}

// Function to save chat state
function saveChatState(chatId) {
  const chats = JSON.parse(localStorage.getItem("chats") || "{}");
  const chatHistory = JSON.parse(localStorage.getItem("chatHistory") || "[]");
  
  if (chats[chatId]) {
    chats[chatId].messages = chatHistory;
    localStorage.setItem("chats", JSON.stringify(chats));
  }
}

// Function to load chat state
async function loadChatState(chatId) {
  const chats = JSON.parse(localStorage.getItem("chats") || "{}");
  const chatData = chats[chatId];
  
  if (chatData) {
    localStorage.setItem("chatHistory", JSON.stringify(chatData.messages || []));
    chat.innerHTML = ''; 
    
    if (chatData.messages && Array.isArray(chatData.messages)) {
      chatData.messages.forEach(msg => {
        const messageTimestamp = msg.timestamp || msg.time;
        if (msg.role && msg.content && messageTimestamp) {
          // If appendMessage were called here directly, it would need settings.
          // However, loadChatState is typically followed by switchToChat which handles rendering with settings.
          // For safety, if direct rendering was intended here, settings would be needed.
          // Current flow: loadChatList -> switchToChat -> appendMessage (which now takes settings)
        }
      });
    }
    
    input.value = "";
    input.style.height = 'auto';
    input.focus();
  } else {
    chat.innerHTML = '<p style="text-align:center; color: #888;">Could not load chat.</p>';
  }
  scrollToBottom();
}

// Function to load chat list
function loadChatList() {
  const chats = JSON.parse(localStorage.getItem("chats") || "{}");
  chatList.innerHTML = "";

  const sortedChats = Object.values(chats).sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  sortedChats.forEach(chatData => {
    addChatToList(chatData);
  });

  if (sortedChats.length > 0) {
    switchToChat(sortedChats[0].id);
  } else {
    startNewChat();
  }
}

// Context menu functions
function setupContextMenu() {
  document.addEventListener("click", () => {
    contextMenu.style.display = "none";
  });
  chatList.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
}

function showContextMenu(e, chatId) {
  e.preventDefault();
  selectedChatItemForContextMenu = chatId;
  contextMenu.style.display = "block";
  contextMenu.style.left = `${e.pageX}px`;
  contextMenu.style.top = `${e.pageY}px`;
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
      const chatItem = document.querySelector(`[data-chat-id="${selectedChatItemForContextMenu}"]`);
      if (chatItem) {
        chatItem.querySelector('.chat-title').textContent = newTitle.trim();
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
  if (chatItem) chatItem.remove();
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
function appendMessage(role, text, timestamp, settings) {
  const div = document.createElement("div");
  div.classList.add("chat-message", role);

  let messageHtml = markdownToHtml(text);
  if (timestamp) {
    messageHtml += `<div class="time" data-timestamp="${timestamp}">${formatTimestamp(timestamp, settings)}</div>`;
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
function saveToHistory(role, text, timestamp) {
  const history = JSON.parse(localStorage.getItem("chatHistory") || "[]");
  history.push({
    role: role,
    content: text,
    timestamp: timestamp
  });
  localStorage.setItem("chatHistory", JSON.stringify(history));
}

// NEW FUNCTION: applyMaxMessagesLimit
function applyMaxMessagesLimit(settings) {
  try {
    const maxMsgs = parseInt(settings.maxMessages);
    if (isNaN(maxMsgs) || maxMsgs <= 0) {
        console.warn('Max messages limit is invalid or zero, skipping pruning:', settings.maxMessages);
        return; 
    }
    const messages = document.querySelectorAll('.chat-message');
    if (messages.length > maxMsgs) {
      const toRemove = messages.length - maxMsgs;
      for (let i = 0; i < toRemove; i++) {
        if (messages[i]) { 
            messages[i].remove();
        }
      }
    }
  } catch (error) {
    console.error('Error applying max messages limit:', error);
  }
}

// Function to add a message to chat and save to history
function addMessageToChat(role, text) {
  const timestamp = new Date().toISOString();
  const messageElement = appendMessage(role, text, timestamp, currentActiveSettings);
  saveToHistory(role, text, timestamp);
  
  applyMaxMessagesLimit(currentActiveSettings);

  return messageElement;
}

// Function to send a message
async function sendMessage() {
  const messageInput = document.getElementById('message');
  const sendBtn = document.getElementById('sendBtn');
  const message = messageInput.value.trim();
  
  if (message === '') return;
  
  // Disable input and button while sending
  messageInput.disabled = true;
  sendBtn.disabled = true;
  
  messageInput.value = '';
  messageInput.style.height = 'auto'; // Reset height after sending
  
  // User message added using addMessageToChat which now uses currentActiveSettings
  addMessageToChat('user', message);

  // MODIFIED: Use currentActiveSettings for translations
  const thinkingMessage = translations[currentActiveSettings.language || 'tr'].thinking;
  // MODIFIED: Pass currentActiveSettings to appendMessage for the thinkingDiv
  const thinkingDiv = appendMessage('bot', `${thinkingMessage}<span class="typing-dots"></span>`, null, currentActiveSettings);
  
  try {
    const chatHistory = JSON.parse(localStorage.getItem("chatHistory") || "[]");
    
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // MODIFIED: Pass currentActiveSettings.language to API
      body: JSON.stringify({
        messages: chatHistory,
        message: message,
        language: currentActiveSettings.language || 'tr'
      })
    });

    if (thinkingDiv && thinkingDiv.parentNode) {
      thinkingDiv.parentNode.removeChild(thinkingDiv);
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      // MODIFIED: Use currentActiveSettings for error translation
      const errorPrefix = translations[currentActiveSettings.language].error;
      const errorMessage = `${errorPrefix}${data.error}`;
      const errorDiv = addMessageToChat('error', errorMessage); // addMessageToChat handles settings
      errorDiv.classList.add('error-message');
      const chatHistory = JSON.parse(localStorage.getItem("chatHistory") || "[]");
      chatHistory.pop(); // Remove user message that led to error
      localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
      showNotification(errorMessage, 'error');
    } else {
      addMessageToChat('bot', data.response); // addMessageToChat handles settings
      const chatContainer = document.getElementById('chat');
      const wasAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop === chatContainer.clientHeight;
      if (wasAtBottom) scrollToBottom(); else showScrollButton();
    }
  } catch (error) {
    if (thinkingDiv && thinkingDiv.parentNode) thinkingDiv.parentNode.removeChild(thinkingDiv);
    console.error('Error:', error);
    // MODIFIED: Use currentActiveSettings for error translation
    const errorPrefix = translations[currentActiveSettings.language].error;
    const errorMessage = `${errorPrefix}${error.message}`;
    const errorDiv = addMessageToChat('error', errorMessage); // addMessageToChat handles settings
    errorDiv.classList.add('error-message');
    showNotification(errorMessage, 'error');
    const chatHistory = JSON.parse(localStorage.getItem("chatHistory") || "[]");
    chatHistory.pop();
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  } finally {
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

// Function to show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Fade in
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Remove after 5 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}

// Function to show scroll to bottom button
function showScrollButton() {
  let scrollButton = document.getElementById('scrollToBottom');
  if (!scrollButton) {
    scrollButton = document.createElement('button');
    scrollButton.id = 'scrollToBottom';
    scrollButton.className = 'scroll-button';
    scrollButton.innerHTML = '<i class="fas fa-arrow-down"></i>';
    scrollButton.onclick = () => {
      scrollToBottom();
      scrollButton.remove();
    };
    document.body.appendChild(scrollButton);
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

function searchInChat(searchText) {
    const messages = document.querySelectorAll('.chat-message');
    let firstMatchFound = false;
    messages.forEach(message => {
        const messageContent = message.cloneNode(true);
        const timeElement = messageContent.querySelector('.time');
        if (timeElement) messageContent.removeChild(timeElement);
        const text = messageContent.textContent.toLowerCase();
        
        if (text.includes(searchText)) {
            message.classList.add('highlight');
            message.style.display = 'flex';
            if (!firstMatchFound) {
                firstMatchFound = true;
            }
        } else {
            message.classList.remove('highlight');
            message.style.display = 'none'; 
        }
    });
    if (searchText === '' && messages.length > 0) scrollToBottom();
}

function clearChatHighlights() {
    const messages = document.querySelectorAll('.chat-message');
    messages.forEach(message => {
        message.classList.remove('highlight');
        message.style.display = 'flex'; 
    });
    scrollToBottom(); 
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
  const settings = { ...defaultSettings, ...savedSettings };
  console.log('Loading settings (from localStorage):', settings); // Clarified log
  return settings;
}

// Save settings to localStorage
function saveSettings(settings) {
  console.log('Saving settings (to localStorage):', settings); // Clarified log
  localStorage.setItem('chatSettings', JSON.stringify(settings));
}

// Apply translations based on current language
function applyTranslations(settings) {
  const currentTranslations = translations[settings.language];

  document.body.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
  const fontFamilies = {
    de: '"Segoe UI", system-ui, -apple-system, sans-serif',
    zh: '"Microsoft YaHei", "微软雅黑", sans-serif',
    hi: '"Noto Sans Devanagari", sans-serif',
    ar: '"Noto Sans Arabic", sans-serif',
    default: '"Segoe UI", system-ui, -apple-system, sans-serif'
  };
  document.body.style.fontFamily = fontFamilies[settings.language] || fontFamilies.default;
  document.documentElement.lang = settings.language;

  document.querySelector('.new-chat-btn').innerHTML = `<i class="fas fa-plus"></i> ${currentTranslations.newChat}`;
  document.querySelector('#settingsBtn').innerHTML = `<i class="fas fa-cog"></i> ${currentTranslations.settings}`;
  document.querySelector('#message').placeholder = currentTranslations.typeMessage;
  if(chatSearchInput) chatSearchInput.placeholder = currentTranslations.search; // Added null check for chatSearchInput
  
  const renameMenuItem = document.querySelector('.context-menu-item:nth-child(1)');
  if (renameMenuItem) renameMenuItem.innerHTML = `<i class="fas fa-edit"></i> ${currentTranslations.rename}`;
  const deleteMenuItem = document.querySelector('.context-menu-item:nth-child(2)');
  if (deleteMenuItem) deleteMenuItem.innerHTML = `<i class="fas fa-trash"></i> ${currentTranslations.delete}`;

  document.querySelectorAll('[data-translate]').forEach(element => {
    const translateKey = element.getAttribute('data-translate');
    if (translateKey && currentTranslations[translateKey]) {
      if (element.tagName.toLowerCase() === 'option') {
        element.text = currentTranslations[translateKey];
      } else if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
        element.placeholder = currentTranslations[translateKey];
      } else {
        element.textContent = currentTranslations[translateKey];
      }
    }
  });
  const clearHistoryButton = document.querySelector('#clearHistory');
  if (clearHistoryButton) clearHistoryButton.textContent = currentTranslations.clearAllChats;
}

// Apply settings to the UI
function applySettings(settings) {
  console.log('Applying settings from memory:', settings); // Clarified log
  
  try {
    document.body.classList.remove('font-size-tiny', 'font-size-extraSmall', 'font-size-small', 'font-size-medium', 'font-size-large', 'font-size-extraLarge', 'font-size-huge');
    document.body.classList.add(`font-size-${settings.fontSize}`);
    const messageInput = document.getElementById('message');
    if (messageInput) {
      const fontSizes = { tiny: '0.75rem', extraSmall: '0.85rem', small: '0.95rem', medium: '1rem', large: '1.15rem', extraLarge: '1.3rem', huge: '1.5rem' };
      messageInput.style.fontSize = fontSizes[settings.fontSize] || '1rem';
    }
  } catch (error) { console.error('Error applying font size:', error); }
  
  try {
    const chatBox = document.querySelector('.chat-box');
    if (chatBox) {
      chatBox.classList.remove('message-spacing-extraCompact', 'message-spacing-compact', 'message-spacing-normal', 'message-spacing-relaxed', 'message-spacing-spacious', 'message-spacing-extraSpacious');
      chatBox.classList.add(`message-spacing-${settings.messageSpacing}`);
      const spacingValues = { extraCompact: '0.25rem', compact: '0.5rem', normal: '1rem', relaxed: '1.5rem', spacious: '2rem', extraSpacious: '2.5rem' };
      chatBox.style.setProperty('--message-spacing', spacingValues[settings.messageSpacing] || '1rem');
    } else { console.warn('Chat box element not found'); }
  } catch (error) { console.error('Error applying message spacing:', error); }

  try {
    ['fontSize', 'messageSpacing', 'timestampFormat', 'maxMessages', 'language'].forEach(settingId => {
      const element = document.getElementById(settingId);
      if (element) element.value = settings[settingId];
    });
  } catch (error) { console.error('Error updating select elements:', error); }

  try { applyTranslations(settings); } 
  catch (error) { console.error('Error applying translations:', error); }

  try { updateAllTimestamps(settings); } 
  catch (error) { console.error('Error updating timestamps:', error); }

  applyMaxMessagesLimit(settings);
  
  console.log('Settings application completed');
}

// Format timestamp based on settings
function formatTimestamp(timestamp, settings) {
  const date = new Date(timestamp);
  const options = {
    hour: settings.timestampFormat === '12hour' ? 'numeric' : '2-digit',
    minute: '2-digit',
    hour12: settings.timestampFormat === '12hour'
  };
  const locales = { en: 'en-US', de: 'de-DE', zh: 'zh-CN', hi: 'hi-IN', es: 'es-ES', ar: 'ar-SA', tr: 'tr-TR', fr: 'fr-FR', ru: 'ru-RU' };
  return new Intl.DateTimeFormat(locales[settings.language] || 'en-US', options).format(date);
}

// Update all timestamps in the chat
function updateAllTimestamps(settings) {
  const timestamps = document.querySelectorAll('.time');
  timestamps.forEach(tsElement => {
    const originalTime = tsElement.getAttribute('data-timestamp');
    if (originalTime) {
      tsElement.textContent = formatTimestamp(originalTime, settings);
    }
  });
}

function setupSettingsModal() {
  if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
  if (closeSettingsModalBtn) closeSettingsModalBtn.addEventListener('click', closeSettingsModal);

  const settingSelectIds = ['fontSize', 'messageSpacing', 'timestampFormat', 'maxMessages', 'language'];
  settingSelectIds.forEach(settingId => {
    const selectElement = document.getElementById(settingId);
    if (selectElement) {
      selectElement.addEventListener('change', (event) => {
        currentActiveSettings[settingId] = event.target.value;
        saveSettings(currentActiveSettings);
        applySettings(currentActiveSettings);
        
        if (settingId === 'language') {
            applyTranslations(currentActiveSettings);
            settingSelectIds.forEach(sId => {
                const el = document.getElementById(sId);
                if (el) el.value = currentActiveSettings[sId];
            });
        }
      });
    }
  });
}

function openSettingsModal() {
  if (settingsModal) {
    settingsModal.style.display = "block";
    applySettings(currentActiveSettings);
  }
}

function closeSettingsModal() {
  if (settingsModal) {
    settingsModal.style.display = "none";
  }
}

// Initialize settings on page load
document.addEventListener('DOMContentLoaded', () => {
  currentActiveSettings = loadSettings();
  applySettings(currentActiveSettings);
  
  const clearHistoryBtn = document.getElementById('clearHistory');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      const confirmMessage = translations[currentActiveSettings.language || 'en'].clearConfirm;
      if (confirm(confirmMessage)) {
        localStorage.removeItem('chats');
        localStorage.removeItem('chatHistory');
        chatList.innerHTML = '';
        chat.innerHTML = '';
        startNewChat();
        showNotification('All chats have been cleared.', 'info');
      }
    });
  }
});