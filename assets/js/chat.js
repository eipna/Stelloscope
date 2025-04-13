// Initialize Firebase Auth and Firestore
const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentUser = null;
let currentUserRole = null;
let selectedChatPartner = null;
let chatListener = null;

// DOM Elements
const currentUserElement = document.getElementById('currentUser');
const userStatusElement = document.getElementById('userStatus');
const contactsTitleElement = document.getElementById('contactsTitle');
const contactsListElement = document.getElementById('contactsList');
const chatPartnerElement = document.getElementById('chatPartner');
const partnerStatusElement = document.getElementById('partnerStatus');
const chatMessagesElement = document.getElementById('chatMessages');
const messageInputElement = document.getElementById('messageInput');
const searchContactsElement = document.getElementById('searchContacts');

// Navigation elements
const messagesLink = document.getElementById('messagesLink');
const dashboardLink = document.getElementById('dashboardLink');
const logoutLink = document.getElementById('logoutLink');

// Debug function
function debug(message) {
    console.log(`[DEBUG] ${message}`);
}

// Check authentication state
auth.onAuthStateChanged(async (user) => {
    debug(`Auth state changed: ${user ? 'User logged in' : 'No user'}`);
    
    if (user) {
        currentUser = user;
        debug(`User ID: ${user.uid}`);
        
        try {
            await loadUserProfile();
            setupNavigation();
            loadContacts();
        } catch (error) {
            console.error('Error initializing chat:', error);
            alert('Error initializing chat. Please try again.');
        }
    } else {
        debug('No user logged in, redirecting to login page');
        window.location.href = '../index.html';
    }
});

// Load user profile
async function loadUserProfile() {
    debug('Loading user profile');
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        
        if (!userDoc.exists) {
            debug('User document does not exist');
            throw new Error('User profile not found');
        }
        
        const userData = userDoc.data();
        debug(`User data loaded: ${JSON.stringify(userData)}`);
        
        currentUserRole = userData.role;
        debug(`User role: ${currentUserRole}`);
        
        // Update UI with user info
        currentUserElement.textContent = userData.username || userData.email || 'Unknown User';
        userStatusElement.textContent = userData.status || 'Offline';
        
        // Update contacts title based on role
        contactsTitleElement.textContent = currentUserRole === 'doctor' ? 'Patients' : 'Doctors';
        
        // Update user status to online
        await db.collection('users').doc(currentUser.uid).update({
            status: 'online',
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        debug('User profile loaded successfully');
    } catch (error) {
        console.error('Error loading user profile:', error);
        throw error;
    }
}

// Setup navigation
function setupNavigation() {
    debug('Setting up navigation');
    
    // Set dashboard link based on role
    if (currentUserRole === 'doctor') {
        dashboardLink.href = '../doctor-dashboard.html';
        debug('Dashboard link set to doctor dashboard');
    } else if (currentUserRole === 'patient') {
        dashboardLink.href = '../patient-dashboard.html';
        debug('Dashboard link set to patient dashboard');
    } else {
        debug(`Unknown role: ${currentUserRole}`);
        dashboardLink.href = '../index.html';
    }
    
    // Setup logout
    logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        debug('Logout clicked');
        
        try {
            await auth.signOut();
            debug('User signed out');
            window.location.href = '../index.html';
        } catch (error) {
            console.error('Error signing out:', error);
            alert('Error signing out. Please try again.');
        }
    });
    
    debug('Navigation setup complete');
}

// Load contacts based on user role
async function loadContacts() {
    debug('Loading contacts');
    
    try {
        contactsListElement.innerHTML = '<div class="loading-contacts"><i class="fas fa-spinner fa-spin"></i> Loading contacts...</div>';
        
        let contactsSnapshot;
        if (currentUserRole === 'doctor') {
            debug('Loading patients for doctor');
            // Load all patients
            contactsSnapshot = await db.collection('users')
                .where('role', '==', 'patient')
                .get();
        } else if (currentUserRole === 'patient') {
            debug('Loading doctors for patient');
            // Load all doctors
            contactsSnapshot = await db.collection('users')
                .where('role', '==', 'doctor')
                .get();
        } else {
            debug(`Invalid role: ${currentUserRole}`);
            contactsListElement.innerHTML = '<div class="error">Invalid user role. Please contact support.</div>';
            return;
        }
        
        debug(`Contacts snapshot size: ${contactsSnapshot.size}`);
        
        if (contactsSnapshot && contactsSnapshot.docs && contactsSnapshot.docs.length > 0) {
            displayContacts(contactsSnapshot.docs);
        } else {
            debug('No contacts found');
            contactsListElement.innerHTML = '<div class="no-contacts">No contacts available</div>';
        }
        
    } catch (error) {
        console.error('Error loading contacts:', error);
        contactsListElement.innerHTML = '<div class="error">Error loading contacts. Please try again.</div>';
    }
}

// Display contacts in the list
function displayContacts(contacts) {
    debug(`Displaying ${contacts.length} contacts`);
    
    if (!contacts || contacts.length === 0) {
        debug('No contacts to display');
        contactsListElement.innerHTML = '<div class="no-contacts">No contacts available</div>';
        return;
    }
    
    contactsListElement.innerHTML = '';
    contacts.forEach(doc => {
        const contact = doc.data();
        debug(`Contact: ${contact.username || contact.email}`);
        
        const contactElement = document.createElement('div');
        contactElement.className = 'contact-item';
        contactElement.dataset.userId = doc.id;
        contactElement.innerHTML = `
            <div class="contact-avatar">
                <i class="fas fa-user-circle"></i>
            </div>
            <div class="contact-info">
                <h4>${contact.username || contact.email || 'Unknown User'}</h4>
                <p>${contact.role === 'doctor' ? 'Doctor' : 'Patient'}</p>
            </div>
        `;
        
        contactElement.addEventListener('click', () => selectChatPartner(doc.id, contact));
        contactsListElement.appendChild(contactElement);
    });
    
    debug('Contacts displayed successfully');
}

// Select a chat partner
async function selectChatPartner(userId, userData) {
    debug(`Selected chat partner: ${userId}`);
    
    selectedChatPartner = userId;
    
    // Update UI
    document.querySelectorAll('.contact-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.userId === userId) {
            item.classList.add('active');
        }
    });
    
    chatPartnerElement.textContent = userData.username || userData.email || 'Unknown User';
    partnerStatusElement.textContent = userData.status || 'Offline';
    
    // Clear previous chat listener
    if (chatListener) {
        debug('Clearing previous chat listener');
        chatListener();
    }
    
    // Load chat messages
    loadChatMessages(userId);
}

// Load chat messages
function loadChatMessages(partnerId) {
    debug(`Loading chat messages for partner: ${partnerId}`);
    
    chatMessagesElement.innerHTML = '';
    
    // Create a unique chat ID for the conversation
    const chatId = [currentUser.uid, partnerId].sort().join('_');
    debug(`Chat ID: ${chatId}`);
    
    // Listen to messages in real-time
    chatListener = db.collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            debug(`Received ${snapshot.docChanges().length} message changes`);
            
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const message = change.doc.data();
                    displayMessage(message);
                }
            });
            
            // Scroll to bottom
            chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
        }, error => {
            console.error('Error loading messages:', error);
            chatMessagesElement.innerHTML = '<div class="error">Error loading messages. Please try again.</div>';
        });
}

// Display a message in the chat
function displayMessage(message) {
    debug(`Displaying message: ${message.text.substring(0, 20)}...`);
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`;
    
    const time = message.timestamp ? new Date(message.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    
    messageElement.innerHTML = `
        <div class="message-content">${message.text}</div>
        <div class="message-time">${time}</div>
    `;
    
    chatMessagesElement.appendChild(messageElement);
}

// Send a message
async function sendMessage() {
    if (!selectedChatPartner || !messageInputElement.value.trim()) {
        debug('Cannot send message: No partner selected or empty message');
        return;
    }
    
    const messageText = messageInputElement.value.trim();
    messageInputElement.value = '';
    
    debug(`Sending message to ${selectedChatPartner}: ${messageText.substring(0, 20)}...`);
    
    try {
        const chatId = [currentUser.uid, selectedChatPartner].sort().join('_');
        
        await db.collection('chats')
            .doc(chatId)
            .collection('messages')
            .add({
                text: messageText,
                senderId: currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
        debug('Message sent successfully');
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Search contacts
searchContactsElement.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    debug(`Searching contacts with term: ${searchTerm}`);
    
    const contactItems = document.querySelectorAll('.contact-item');
    
    contactItems.forEach(item => {
        const contactName = item.querySelector('h4').textContent.toLowerCase();
        if (contactName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
});

// Handle message input
messageInputElement.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Update user status when leaving
window.addEventListener('beforeunload', async () => {
    if (currentUser) {
        debug('Updating user status to offline');
        try {
            await db.collection('users').doc(currentUser.uid).update({
                status: 'offline',
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating user status:', error);
        }
    }
}); 