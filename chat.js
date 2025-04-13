let currentUser = null;
let currentUserRole = null;
let currentChat = null;

// Check authentication state
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    currentUser = user;
    
    // Get user role
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    currentUserRole = userData.role;

    // Load conversations
    loadConversations();
});

// Load conversations
async function loadConversations() {
    const conversationsList = document.querySelector('.conversations-list');
    conversationsList.innerHTML = '';

    try {
        let conversationsQuery;
        
        if (currentUserRole === 'doctor') {
            conversationsQuery = await db.collection('conversations')
                .where('doctorId', '==', currentUser.uid)
                .get();
        } else {
            conversationsQuery = await db.collection('conversations')
                .where('patientId', '==', currentUser.uid)
                .get();
        }

        conversationsQuery.forEach(doc => {
            const conversation = doc.data();
            const conversationElement = createConversationElement(doc.id, conversation);
            conversationsList.appendChild(conversationElement);
        });
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

// Create conversation element
function createConversationElement(conversationId, conversation) {
    const div = document.createElement('div');
    div.className = 'conversation-item';
    div.onclick = () => selectConversation(conversationId, conversation);
    
    // Get the other user's name
    const otherUserId = currentUserRole === 'doctor' ? conversation.patientId : conversation.doctorId;
    
    db.collection('users').doc(otherUserId).get().then(doc => {
        const userData = doc.data();
        div.textContent = userData.username;
    });

    return div;
}

// Select conversation
function selectConversation(conversationId, conversation) {
    currentChat = conversationId;
    
    // Update UI
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update header
    const otherUserId = currentUserRole === 'doctor' ? conversation.patientId : conversation.doctorId;
    db.collection('users').doc(otherUserId).get().then(doc => {
        const userData = doc.data();
        document.querySelector('.chat-header h2').textContent = `Chat with ${userData.username}`;
    });
    
    // Load messages
    loadMessages(conversationId);
}

// Load messages
async function loadMessages(conversationId) {
    const messagesContainer = document.querySelector('.messages');
    messagesContainer.innerHTML = '';

    try {
        const messagesSnapshot = await db.collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .get();

        messagesSnapshot.forEach(doc => {
            const message = doc.data();
            const messageElement = createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Create message element
function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`;
    div.textContent = message.text;
    return div;
}

// Send message
async function sendMessage() {
    if (!currentChat) {
        alert('Please select a conversation first');
        return;
    }

    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (!message) return;

    try {
        await db.collection('conversations')
            .doc(currentChat)
            .collection('messages')
            .add({
                text: message,
                senderId: currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

        messageInput.value = '';
        loadMessages(currentChat);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Start new conversation
async function startNewConversation(otherUserId) {
    try {
        const conversationRef = await db.collection('conversations').add({
            doctorId: currentUserRole === 'doctor' ? currentUser.uid : otherUserId,
            patientId: currentUserRole === 'patient' ? currentUser.uid : otherUserId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        loadConversations();
        return conversationRef.id;
    } catch (error) {
        console.error('Error starting conversation:', error);
    }
}

// Logout function
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Error signing out:', error);
    });
} 