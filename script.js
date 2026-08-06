/**
 * Omkar AI - Modern Client Script 
 * Handles DOM orchestration, State, LocalStorage persistence, and Serverless Chat Streaming.
 */

// Application State Structure
const state = {
    chats: [],
    currentChatId: null,
    settings: {
        model: 'openai/gpt-5-nano',
        temperature: 0.7,
        maxTokens: 1024,
        theme: 'dark',
        fontSize: 'medium'
    },
    isGenerating: false,
    abortController: null
};

// DOM Elements Reference Cache
const DOM = {
    sidebar: document.getElementById('sidebar'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    sidebarToggleBtn: document.getElementById('sidebarToggleBtn'),
    mobileCloseBtn: document.getElementById('mobileCloseBtn'),
    newChatBtn: document.getElementById('newChatBtn'),
    newChatTopBtn: document.getElementById('newChatTopBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    historyList: document.getElementById('historyList'),
    chatViewport: document.getElementById('chatViewport'),
    welcomeScreen: document.getElementById('welcomeScreen'),
    messagesList: document.getElementById('messagesList'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    modelSelectHeader: document.getElementById('modelSelectHeader'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    settingsModelSelect: document.getElementById('settingsModelSelect'),
    tempRange: document.getElementById('tempRange'),
    tempVal: document.getElementById('tempVal'),
    tokensInput: document.getElementById('tokensInput'),
    themeSelect: document.getElementById('themeSelect'),
    fontSizeSelect: document.getElementById('fontSizeSelect'),
    streamingControls: document.getElementById('streamingControls'),
    stopGenBtn: document.getElementById('stopGenBtn')
};

// Initialization entry point
document.addEventListener('DOMContentLoaded', () => {
    loadSettingsFromStorage();
    loadChatsFromStorage();
    setupEventListeners();
    applySettingsToDOM();
    
    if (state.chats.length === 0) {
        createNewChat(false);
    } else {
        loadChat(state.chats[0].id);
    }
});

// Load and Save LocalStorage routines
function loadSettingsFromStorage() {
    const saved = localStorage.getItem('omkar_ai_settings');
    if (saved) {
        try { state.settings = { ...state.settings, ...JSON.parse(saved) }; } catch(e){}
    }
}

function saveSettingsToStorage() {
    localStorage.setItem('omkar_ai_settings', JSON.stringify(state.settings));
}

function loadChatsFromStorage() {
    const saved = localStorage.getItem('omkar_ai_chats');
    if (saved) {
        try { state.chats = JSON.parse(saved); } catch(e){}
    }
}

function saveChatsToStorage() {
    localStorage.setItem('omkar_ai_chats', JSON.stringify(state.chats));
}

// Event bindings configuration
function setupEventListeners() {
    // Sidebar toggles
    DOM.sidebarToggleBtn.addEventListener('click', toggleSidebar);
    DOM.mobileCloseBtn.addEventListener('click', toggleSidebar);
    DOM.sidebarBackdrop.addEventListener('click', toggleSidebar);

    // Chat management
    DOM.newChatBtn.addEventListener('click', () => createNewChat(true));
    DOM.newChatTopBtn.addEventListener('click', () => createNewChat(true));
    DOM.clearAllBtn.addEventListener('click', clearAllConversations);

    // Input handlers
    DOM.userInput.addEventListener('input', handleTextareaInput);
    DOM.userInput.addEventListener('keydown', handleTextareaKeyDown);
    DOM.sendBtn.addEventListener('click', handleSendMessage);
    DOM.stopGenBtn.addEventListener('click', stopGeneration);

    // Suggestion grid click bindings
    document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            const promptText = card.getAttribute('data-prompt');
            DOM.userInput.value = promptText;
            handleTextareaInput();
            handleSendMessage();
        });
    });

    // Model selection sync
    DOM.modelSelectHeader.addEventListener('change', (e) => {
        state.settings.model = e.target.value;
        DOM.settingsModelSelect.value = state.settings.model;
        saveSettingsToStorage();
    });

    // Settings Modal bindings
    DOM.settingsBtn.addEventListener('click', openSettingsModal);
    DOM.closeModalBtn.addEventListener('click', closeSettingsModal);
    DOM.settingsModal.addEventListener('click', (e) => {
        if (e.target === DOM.settingsModal) closeSettingsModal();
    });
    DOM.saveSettingsBtn.addEventListener('click', saveSettingsFromModal);
    
    DOM.tempRange.addEventListener('input', (e) => {
        DOM.tempVal.textContent = e.target.value;
    });
}

// UI Sidebar Toggle
function toggleSidebar() {
    DOM.sidebar.classList.toggle('open');
    DOM.sidebarBackdrop.classList.toggle('open');
}

// Textarea auto resizing
function handleTextareaInput() {
    const input = DOM.userInput;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';
    DOM.sendBtn.disabled = input.value.trim().length === 0;
}

function handleTextareaKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!DOM.sendBtn.disabled && !state.isGenerating) {
            handleSendMessage();
        }
    }
}

// Conversation handling
function createNewChat(switchView = true) {
    const newChat = {
        id: 'chat_' + Date.now(),
        title: 'New Conversation',
        messages: []
    };
    state.chats.unshift(newChat);
    saveChatsToStorage();
    renderHistoryList();
    loadChat(newChat.id);
    if (window.innerWidth <= 768 && DOM.sidebar.classList.contains('open')) {
        toggleSidebar();
    }
}

function loadChat(chatId) {
    state.currentChatId = chatId;
    renderHistoryList();
    renderCurrentMessages();
}

function clearAllConversations() {
    if (confirm('Are you sure you want to delete all saved chat histories?')) {
        state.chats = [];
        saveChatsToStorage();
        createNewChat(true);
    }
}

// Render History List in Sidebar
function renderHistoryList() {
    DOM.historyList.innerHTML = '';
    state.chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = `history-item ${chat.id === state.currentChatId ? 'active' : ''}`;
        
        const titleSpan = document.createElement('div');
        titleSpan.className = 'history-item-title';
        titleSpan.textContent = chat.title;
        titleSpan.addEventListener('click', () => {
            loadChat(chat.id);
            if (window.innerWidth <= 768) toggleSidebar();
        });

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'history-actions';

        // Rename Action
        const renameBtn = document.createElement('button');
        renameBtn.className = 'history-action-btn';
        renameBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
        renameBtn.title = "Rename Chat";
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newTitle = prompt("Enter new chat title:", chat.title);
            if (newTitle && newTitle.trim()) {
                chat.title = newTitle.trim();
                saveChatsToStorage();
                renderHistoryList();
            }
        });

        // Delete Action
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'history-action-btn';
        deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        deleteBtn.title = "Delete Chat";
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });

        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(deleteBtn);
        item.appendChild(titleSpan);
        item.appendChild(actionsDiv);
        DOM.historyList.appendChild(item);
    });
}

function deleteChat(chatId) {
    state.chats = state.chats.filter(c => c.id !== chatId);
    saveChatsToStorage();
    if (state.currentChatId === chatId) {
        if (state.chats.length > 0) {
            loadChat(state.chats[0].id);
        } else {
            createNewChat(true);
        }
    } else {
        renderHistoryList();
    }
}

// Render Messages in Viewport
function renderCurrentMessages() {
    const chat = state.chats.find(c => c.id === state.currentChatId);
    DOM.messagesList.innerHTML = '';
    
    if (!chat || chat.messages.length === 0) {
        DOM.welcomeScreen.style.display = 'flex';
        return;
    }
    
    DOM.welcomeScreen.style.display = 'none';
    chat.messages.forEach((msg, index) => {
        appendMessageElement(msg.role, msg.content, index);
    });
    scrollToBottom();
}

function appendMessageElement(role, content, index) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'U' : '✨';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (role === 'assistant') {
        contentDiv.innerHTML = parseMarkdownWithCodeCopy(content);
    } else {
        contentDiv.textContent = content; // Keep safe plain text for user inputs
    }

    bubble.appendChild(avatar);
    bubble.appendChild(contentDiv);
    row.appendChild(bubble);

    // If assistant message, add action options (copy/regenerate)
    if (role === 'assistant') {
        const actionsRow = document.createElement('div');
        actionsRow.className = 'message-actions';
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-chip';
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(content);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`, 2000);
        });
        actionsRow.appendChild(copyBtn);

        // Add regenerate if it's the latest message
        const chat = state.chats.find(c => c.id === state.currentChatId);
        if (chat && index === chat.messages.length - 1) {
            const regenBtn = document.createElement('button');
            regenBtn.className = 'action-chip';
            regenBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg> Regenerate`;
            regenBtn.addEventListener('click', () => handleRegenerate());
            actionsRow.appendChild(regenBtn);
        }

        row.appendChild(actionsRow);
    }

    DOM.messagesList.appendChild(row);
}

// Markdown parser hook with code snippet copy buttons wrapper
function parseMarkdownWithCodeCopy(markdownText) {
    if (typeof marked === 'undefined') return markdownText;
    
    // Custom renderer for code blocks
    const renderer = new marked.Renderer();
    renderer.code = function(code, language) {
        const validLang = language || 'text';
        // Unique ID for copy tracking reference
        const encodedCode = encodeURIComponent(code);
        return `
            <div class="code-block-wrapper">
                <button class="code-copy-btn" onclick="navigator.clipboard.decodeURIComponent ? navigator.clipboard.writeText(decodeURIComponent('${encodedCode}')) : navigator.clipboard.writeText(atob('${b56Encode(code)}'))">Copy</button>
                <pre><code class="language-${validLang}">${escapeHtml(code)}</code></pre>
            </div>
        `;
    };
    
    marked.setOptions({ renderer: renderer });
    return marked.parse(markdownText);
}

// Simple helper fallback text conversions
function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function b56Encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

// Send Message Handler (Fetch API POST route /api/chat)
async function handleSendMessage() {
    const text = DOM.userInput.value.trim();
    if (!text || state.isGenerating) return;

    DOM.userInput.value = '';
    handleTextareaInput();

    const chat = state.chats.find(c => c.id === state.currentChatId);
    if (!chat) return;

    // Update auto title if first message
    if (chat.messages.length === 0) {
        chat.title = text.length > 30 ? text.substring(0, 30) + '...' : text;
        renderHistoryList();
    }

    // Append user message
    chat.messages.push({ role: 'user', content: text });
    saveChatsToStorage();
    renderCurrentMessages();

    // Prepare assistant placeholder message
    chat.messages.push({ role: 'assistant', content: '' });
    renderCurrentMessages();

    state.isGenerating = true;
    DOM.streamingControls.style.display = 'flex';
    DOM.sendBtn.disabled = true;

    state.abortController = new AbortController();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: state.settings.model,
                messages: chat.messages.slice(0, -1), // exclude current empty slot
                temperature: parseFloat(state.settings.temperature),
                max_tokens: parseInt(state.settings.maxTokens)
            }),
            signal: state.abortController.signal
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server error: ${response.status}`);
        }

        // Handle text streaming response chunking
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantReply = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            assistantReply += chunk;
            
            // Update state in real-time
            chat.messages[chat.messages.length - 1].content = assistantReply;
            updateLastAssistantMessageDOM(assistantReply);
        }

        saveChatsToStorage();
        renderCurrentMessages(); // final re-render to attach clean actions

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Stream generation aborted by user.');
        } else {
            console.error('Chat error:', error);
            const errMessage = `⚠️ **Error communicating with AI endpoint**: ${error.message}. Please retry.`;
            chat.messages[chat.messages.length - 1].content = errMessage;
            saveChatsToStorage();
            renderCurrentMessages();
        }
    } finally {
        state.isGenerating = false;
        DOM.streamingControls.style.display = 'none';
        handleTextareaInput();
    }
}

function updateLastAssistantMessageDOM(content) {
    const rows = DOM.messagesList.querySelectorAll('.message-row.assistant');
    if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        const contentDiv = lastRow.querySelector('.message-content');
        if (contentDiv) {
            contentDiv.innerHTML = parseMarkdownWithCodeCopy(content);
            scrollToBottom();
        }
    }
}

function stopGeneration() {
    if (state.abortController) {
        state.abortController.abort();
    }
    state.isGenerating = false;
    DOM.streamingControls.style.display = 'none';
    handleTextareaInput();
}

function handleRegenerate() {
    const chat = state.chats.find(c => c.id === state.currentChatId);
    if (!chat || chat.messages.length < 2 || state.isGenerating) return;

    // Remove the last assistant message
    if (chat.messages[chat.messages.length - 1].role === 'assistant') {
        chat.messages.pop();
    }
    saveChatsToStorage();
    renderCurrentMessages();

    // Trigger re-generation cycle using last message stack
    triggerContinuationRequest();
}

async function triggerContinuationRequest() {
    const chat = state.chats.find(c => c.id === state.currentChatId);
    if (!chat) return;

    chat.messages.push({ role: 'assistant', content: '' });
    renderCurrentMessages();

    state.isGenerating = true;
    DOM.streamingControls.style.display = 'flex';
    DOM.sendBtn.disabled = true;
    state.abortController = new AbortController();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: state.settings.model,
                messages: chat.messages.slice(0, -1),
                temperature: parseFloat(state.settings.temperature),
                max_tokens: parseInt(state.settings.maxTokens)
            }),
            signal: state.abortController.signal
        });

        if (!response.ok) throw new Error('Failed to regenerate response.');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantReply = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            assistantReply += decoder.decode(value, { stream: true });
            chat.messages[chat.messages.length - 1].content = assistantReply;
            updateLastAssistantMessageDOM(assistantReply);
        }

        saveChatsToStorage();
        renderCurrentMessages();
    } catch (error) {
        if (error.name !== 'AbortError') {
            chat.messages[chat.messages.length - 1].content = '⚠️ **Regeneration failed.**';
            saveChatsToStorage();
            renderCurrentMessages();
        }
    } finally {
        state.isGenerating = false;
        DOM.streamingControls.style.display = 'none';
        handleTextareaInput();
    }
}

function scrollToBottom() {
    DOM.chatViewport.scrollTop = DOM.chatViewport.scrollHeight;
}

// Settings Modal Operations
function openSettingsModal() {
    DOM.settingsModelSelect.value = state.settings.model;
    DOM.tempRange.value = state.settings.temperature;
    DOM.tempVal.textContent = state.settings.temperature;
    DOM.tokensInput.value = state.settings.maxTokens;
    DOM.themeSelect.value = state.settings.theme;
    DOM.fontSizeSelect.value = state.settings.fontSize;
    DOM.settingsModal.classList.add('open');
}

function closeSettingsModal() {
    DOM.settingsModal.classList.remove('open');
}

function saveSettingsFromModal() {
    state.settings.model = DOM.settingsModelSelect.value;
    state.settings.temperature = parseFloat(DOM.tempRange.value);
    state.settings.maxTokens = parseInt(DOM.tokensInput.value);
    state.settings.theme = DOM.themeSelect.value;
    state.settings.fontSize = DOM.fontSizeSelect.value;
    
    saveSettingsToStorage();
    applySettingsToDOM();
    closeSettingsModal();
}

function applySettingsToDOM() {
    DOM.modelSelectHeader.value = state.settings.model;
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    document.documentElement.setAttribute('data-font-size', state.settings.fontSize);
}
