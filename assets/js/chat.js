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
const contactsListElement = document.getElementById('contactsList');
const chatPartnerElement = document.getElementById('chatPartner');
const partnerStatusElement = document.getElementById('partnerStatus');
const chatMessagesElement = document.getElementById('chatMessages');
const messageInputElement = document.getElementById('messageInput');
const searchContactsElement = document.getElementById('searchContacts');

// Navigation links
const adminLink = document.getElementById('adminLink');
const doctorLink = document.getElementById('doctorLink');
const patientLink = document.getElementById('patientLink');

// Check authentication state
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserProfile();
        loadContacts();
    } else {
        window.location.href = 'login.html';
    }
});

// Load user profile and role
async function loadUserProfile() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            currentUserRole = userData.role;
            currentUserElement.textContent = userData.name || userData.email;
            
            // Show/hide navigation links based on role
            if (currentUserRole === 'admin') {
                adminLink.style.display = 'flex';
            } else if (currentUserRole === 'doctor') {
                doctorLink.style.display = 'flex';
            } else if (currentUserRole === 'patient') {
                patientLink.style.display = 'flex';
            }
            
            // Update user status
            await db.collection('users').doc(currentUser.uid).update({
                status: 'online',
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

// Load contacts based on user role
async function loadContacts() {
    try {
        contactsListElement.innerHTML = '<div class="loading-contacts"><i class="fas fa-spinner fa-spin"></i> Loading contacts...</div>';
        
        let contactsQuery;
        if (currentUserRole === 'doctor') {
            // Doctors can see their patients
            contactsQuery = await db.collection('appointments')
                .where('doctorId', '==', currentUser.uid)
                .get();
            
            const patientIds = new Set();
            contactsQuery.forEach(doc => {
                patientIds.add(doc.data().patientId);
            });
            
            const patients = await db.collection('users')
                .where('role', '==', 'patient')
                .where(firebase.firestore.FieldPath.documentId(), 'in', Array.from(patientIds))
                .get();
                
            displayContacts(patients.docs);
            
        } else if (currentUserRole === 'patient') {
            // Patients can see their doctors
            contactsQuery = await db.collection('appointments')
                .where('patientId', '==', currentUser.uid)
                .get();
            
            const doctorIds = new Set();
            contactsQuery.forEach(doc => {
                doctorIds.add(doc.data().doctorId);
            });
            
            const doctors = await db.collection('users')
                .where('role', '==', 'doctor')
                .where(firebase.firestore.FieldPath.documentId(), 'in', Array.from(doctorIds))
                .get();
                
            displayContacts(doctors.docs);
        }
    } catch (error) {
        console.error('Error loading contacts:', error);
        contactsListElement.innerHTML = '<div class="error">Error loading contacts. Please try again.</div>';
    }
}

// Display contacts in the list
function displayContacts(contacts) {
    if (contacts.length === 0) {
        contactsListElement.innerHTML = '<div class="no-contacts">No contacts available</div>';
        return;
    }
    
    contactsListElement.innerHTML = '';
    contacts.forEach(doc => {
        const contact = doc.data();
        const contactElement = document.createElement('div');
        contactElement.className = 'contact-item';
        contactElement.dataset.userId = doc.id;
        contactElement.innerHTML = `
            <div class="contact-avatar">
                <i class="fas fa-user-circle"></i>
            </div>
            <div class="contact-info">
                <h4>${contact.name || contact.email}</h4>
                <p>${contact.role === 'doctor' ? 'Doctor' : 'Patient'}</p>
            </div>
        `;
        
        contactElement.addEventListener('click', () => selectChatPartner(doc.id, contact));
        contactsListElement.appendChild(contactElement);
    });
}

// Select a chat partner
async function selectChatPartner(userId, userData) {
    selectedChatPartner = userId;
    
    // Update UI
    document.querySelectorAll('.contact-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.userId === userId) {
            item.classList.add('active');
        }
    });
    
    chatPartnerElement.textContent = userData.name || userData.email;
    partnerStatusElement.textContent = userData.status || 'Offline';
    
    // Clear previous chat listener
    if (chatListener) {
        chatListener();
    }
    
    // Load chat messages
    loadChatMessages(userId);
}

// Load chat messages
function loadChatMessages(partnerId) {
    chatMessagesElement.innerHTML = '';
    
    // Create a unique chat ID for the conversation
    const chatId = [currentUser.uid, partnerId].sort().join('_');
    
    // Listen to messages in real-time
    chatListener = db.collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const message = change.doc.data();
                    displayMessage(message);
                }
            });
            
            // Scroll to bottom
            chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
        });
}

// Display a message in the chat
function displayMessage(message) {
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
    if (!selectedChatPartner || !messageInputElement.value.trim()) return;
    
    const messageText = messageInputElement.value.trim();
    messageInputElement.value = '';
    
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
            
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Search contacts
searchContactsElement.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
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

// Logout function
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('Error signing out:', error);
    });
} 