// Global variables
let currentUser = null;
let currentUserRole = null;
let currentChatPartner = null;
let currentConversationId = null;

// Check authentication state
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = '../index.html';
        return;
    }

    // Get user data
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    currentUser = user;
    currentUserRole = userData.role;
    
    // Display user info
    document.getElementById('currentUser').textContent = userData.username;
    
    // Show appropriate dashboard link
    if (currentUserRole === 'admin') {
        document.getElementById('adminLink').style.display = 'block';
    } else if (currentUserRole === 'doctor') {
        document.getElementById('doctorLink').style.display = 'block';
    } else if (currentUserRole === 'patient') {
        document.getElementById('patientLink').style.display = 'block';
    }
    
    // Load contacts based on user role
    loadContacts();
});

// Load contacts (doctors or patients) based on user role
async function loadContacts() {
    const contactsList = document.getElementById('contactsList');
    const contactsTitle = document.getElementById('contactsTitle');
    contactsList.innerHTML = '';
    
    try {
        if (currentUserRole === 'doctor') {
            // For doctors, load their patients
            contactsTitle.textContent = 'My Patients';
            
            // Get conversations where the current user is the doctor
            const conversationsSnapshot = await db.collection('conversations')
                .where('doctorId', '==', currentUser.uid)
                .get();
            
            if (conversationsSnapshot.empty) {
                contactsList.innerHTML = '<p>No patients yet</p>';
                return;
            }
            
            // Get patient details for each conversation
            for (const doc of conversationsSnapshot.docs) {
                const conversation = doc.data();
                const patientDoc = await db.collection('users').doc(conversation.patientId).get();
                const patientData = patientDoc.data();
                
                // Create contact item
                const contactItem = document.createElement('div');
                contactItem.className = 'contact-item';
                contactItem.dataset.userId = patientData.uid;
                contactItem.dataset.conversationId = doc.id;
                contactItem.innerHTML = `
                    <h4>${patientData.username}</h4>
                    <p>${patientData.email}</p>
                `;
                
                // Add click event to start conversation
                contactItem.addEventListener('click', () => {
                    startConversation(doc.id, patientData);
                });
                
                contactsList.appendChild(contactItem);
            }
        } else if (currentUserRole === 'patient') {
            // For patients, load their doctors
            contactsTitle.textContent = 'My Doctors';
            
            // Get conversations where the current user is the patient
            const conversationsSnapshot = await db.collection('conversations')
                .where('patientId', '==', currentUser.uid)
                .get();
            
            if (conversationsSnapshot.empty) {
                contactsList.innerHTML = '<p>No doctors yet</p>';
                return;
            }
            
            // Get doctor details for each conversation
            for (const doc of conversationsSnapshot.docs) {
                const conversation = doc.data();
                const doctorDoc = await db.collection('users').doc(conversation.doctorId).get();
                const doctorData = doctorDoc.data();
                
                // Create contact item
                const contactItem = document.createElement('div');
                contactItem.className = 'contact-item';
                contactItem.dataset.userId = doctorData.uid;
                contactItem.dataset.conversationId = doc.id;
                contactItem.innerHTML = `
                    <h4>${doctorData.username}</h4>
                    <p>${doctorData.email}</p>
                `;
                
                // Add click event to start conversation
                contactItem.addEventListener('click', () => {
                    startConversation(doc.id, doctorData);
                });
                
                contactsList.appendChild(contactItem);
            }
        }
    } catch (error) {
        console.error('Error loading contacts:', error);
        contactsList.innerHTML = '<p>Error loading contacts</p>';
    }
}

// Start a conversation with a user
function startConversation(conversationId, partnerData) {
    // Update UI to show active conversation
    currentChatPartner = partnerData;
    currentConversationId = conversationId;
    
    // Update chat partner name
    document.getElementById('chatPartner').textContent = partnerData.username;
    
    // Highlight active contact
    const contactItems = document.querySelectorAll('.contact-item');
    contactItems.forEach(item => {
        if (item.dataset.conversationId === conversationId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Load messages
    loadMessages(conversationId);
}

// Load messages for a conversation
async function loadMessages(conversationId) {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    try {
        // Get messages for the conversation
        const messagesSnapshot = await db.collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .get();
        
        if (messagesSnapshot.empty) {
            chatMessages.innerHTML = '<p class="no-messages">No messages yet. Start the conversation!</p>';
            return;
        }
        
        // Display each message
        messagesSnapshot.forEach(doc => {
            const message = doc.data();
            const isSent = message.senderId === currentUser.uid;
            
            const messageElement = document.createElement('div');
            messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
            
            // Format timestamp
            const timestamp = message.timestamp.toDate();
            const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            messageElement.innerHTML = `
                <div class="message-content">${message.text}</div>
                <div class="message-time">${timeString}</div>
            `;
            
            chatMessages.appendChild(messageElement);
        });
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Mark messages as read
        markMessagesAsRead(conversationId);
    } catch (error) {
        console.error('Error loading messages:', error);
        chatMessages.innerHTML = '<p>Error loading messages</p>';
    }
}

// Send a message
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();
    
    if (!messageText || !currentConversationId) return;
    
    try {
        // Add message to Firestore
        await db.collection('conversations')
            .doc(currentConversationId)
            .collection('messages')
            .add({
                text: messageText,
                senderId: currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        
        // Update conversation timestamp
        await db.collection('conversations')
            .doc(currentConversationId)
            .update({
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        // Clear input
        messageInput.value = '';
        
        // Reload messages
        loadMessages(currentConversationId);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Mark messages as read
async function markMessagesAsRead(conversationId) {
    try {
        // Get unread messages
        const messagesSnapshot = await db.collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .where('senderId', '!=', currentUser.uid)
            .where('read', '==', false)
            .get();
        
        // Mark each message as read
        const batch = db.batch();
        messagesSnapshot.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        
        await batch.commit();
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

// Logout function
function logout() {
    auth.signOut().then(() => {
        window.location.href = '../index.html';
    }).catch((error) => {
        console.error('Error signing out:', error);
    });
}

// Add event listener for Enter key in message input
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}); 