document.addEventListener('DOMContentLoaded', () => {
    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const clearChat = document.getElementById('clearChat');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    // Track current phone/user session
    let currentUser = 'web-' + Date.now();

    // Function to show loading indicator
    function showLoading() {
        loadingIndicator.classList.remove('hidden');
    }

    // Function to hide loading indicator
    function hideLoading() {
        loadingIndicator.classList.add('hidden');
    }

    // Function to create a message bubble
    function appendMessage(sender, message) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'flex', 'items-start', 'space-x-3');
        
        if (sender === 'user') {
            messageDiv.innerHTML = `
                <div class="flex-1"></div>
                <div class="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl rounded-tr-none p-4 shadow-md max-w-xs md:max-w-md">
                    <p>${message}</p>
                </div>
                <div class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-user text-gray-600 text-sm"></i>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-seedling text-white text-sm"></i>
                </div>
                <div class="bg-white rounded-2xl rounded-tl-none p-4 shadow-md max-w-xs md:max-w-md">
                    <p class="text-gray-800">${formatMessage(message)}</p>
                </div>
                <div class="flex-1"></div>
            `;
        }
        
        chatbox.appendChild(messageDiv);
        chatbox.scrollTop = chatbox.scrollHeight;
    }

    // Function to format messages with emojis and line breaks
    function formatMessage(text) {
        // Convert numbered lists to proper format
        let formatted = text.replace(/\n/g, '<br>');
        // Wrap emoji codes in spans for better rendering
        formatted = formatted.replace(/(🌾|🌽|🌱|🌿|🔶|⚠️|✅|❌|💰|📊)/g, '<span class="text-xl">$1</span>');
        return formatted;
    }

    // Function to send a message
    async function sendMessage() {
        const userText = userInput.value.trim();
        if (userText === '') return;

        // Disable input and button
        sendButton.disabled = true;
        userInput.disabled = true;
        
        // Add user message to chat
        appendMessage('user', userText);
        userInput.value = '';
        
        // Show typing indicator
        const typingIndicator = createTypingIndicator();
        chatbox.appendChild(typingIndicator);
        chatbox.scrollTop = chatbox.scrollHeight;

        try {
            showLoading();
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: userText, user: currentUser })
            });

            const data = await response.json();
            
            hideLoading();
            chatbox.removeChild(typingIndicator);
            
            appendMessage('bot', data.message);
            
        } catch (error) {
            console.error('Error:', error);
            chatbox.removeChild(typingIndicator);
            appendMessage('bot', 'Sorry, something went wrong. Please try again.');
        } finally {
            sendButton.disabled = false;
            userInput.disabled = false;
            userInput.focus();
        }
    }

    // Function to create typing indicator
    function createTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.classList.add('flex', 'items-start', 'space-x-3');
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <i class="fas fa-seedling text-white text-sm"></i>
            </div>
            <div class="bg-white rounded-2xl rounded-tl-none p-4 shadow-md">
                <div class="flex space-x-1">
                    <div class="w-2 h-2 bg-gray-400 rounded-full loading"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full loading" style="animation-delay: 0.2s;"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full loading" style="animation-delay: 0.4s;"></div>
                </div>
            </div>
        `;
        return typingDiv;
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Clear chat functionality
    clearChat.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the chat?')) {
            chatbox.innerHTML = `
                <div class="flex items-start space-x-3 bot-message">
                    <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-seedling text-white text-sm"></i>
                    </div>
                    <div class="bg-white rounded-2xl rounded-tl-none p-4 shadow-md max-w-xs md:max-w-md">
                        <p class="text-gray-800">
                            <strong>Chat cleared! 💬</strong><br><br>
                            What would you like to know about agriculture today?
                        </p>
                    </div>
                </div>
            `;
        }
    });

    // Quick suggestion buttons
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const suggestionText = btn.querySelector('span').textContent;
            userInput.value = suggestionText;
            userInput.focus();
            sendMessage();
        });
    });

    // Load chat history (if any)
    async function loadChatHistory() {
        try {
            const response = await fetch(`/api/history?user=${currentUser}`);
            const data = await response.json();
            
            if (data.history && data.history.length > 0) {
                // Remove welcome message
                chatbox.innerHTML = '';
                
                data.history.forEach(entry => {
                    appendMessage('user', entry.question);
                    appendMessage('bot', entry.answer);
                });
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    // Load history on page load
    // Commented out to start fresh each time
    // loadChatHistory();
});