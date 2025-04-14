// Global variables
let currentUser = null;
let currentUserRole = null;

// DOM Elements
const currentUserElement = document.getElementById('currentUser');
const userStatusElement = document.getElementById('userStatus');
const logoutLink = document.getElementById('logoutLink');

// Debug function
function debug(message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[DEBUG][${timestamp}] ${message}`;
    console.log(logMessage);
    if (data) {
        console.log('Data:', data);
    }
}

// Check if all DOM elements are found
function checkDOMElements() {
    debug('Checking DOM elements...');
    const elements = {
        currentUserElement,
        userStatusElement,
        logoutLink
    };
    
    let allFound = true;
    for (const [name, element] of Object.entries(elements)) {
        if (!element) {
            debug(`ERROR: ${name} not found in DOM`, null);
            allFound = false;
        }
    }
    
    debug(`DOM elements check ${allFound ? 'passed' : 'failed'}`);
    return allFound;
}

// Check authentication state
firebase.auth().onAuthStateChanged(async (user) => {
    debug(`Auth state changed: ${user ? 'User logged in' : 'No user'}`);
    
    if (user) {
        currentUser = user;
        debug(`User ID: ${user.uid}`);
        debug(`User email: ${user.email}`);
        
        try {
            // Check DOM elements first
            if (!checkDOMElements()) {
                throw new Error('Required DOM elements not found');
            }
            
            await loadUserProfile();
            setupNavigation();
        } catch (error) {
            console.error('Error initializing page:', error);
            debug(`Error initializing page: ${error.message}`);
            alert('Error initializing page. Please try again.');
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
        const userDoc = await firebase.firestore().collection('users').doc(currentUser.uid).get();
        
        if (!userDoc.exists) {
            debug('User document does not exist');
            throw new Error('User profile not found');
        }
        
        const userData = userDoc.data();
        debug(`User data loaded:`, userData);
        
        currentUserRole = userData.role;
        debug(`User role: ${currentUserRole}`);
        
        // Check if user is a patient
        if (currentUserRole !== 'patient') {
            debug('User is not a patient, redirecting to chat');
            window.location.href = 'chat.html';
            return;
        }
        
        // Update UI with user info
        currentUserElement.textContent = userData.username || userData.email || 'Unknown User';
        userStatusElement.textContent = userData.status || 'Offline';
        
        // Update user status to online
        await firebase.firestore().collection('users').doc(currentUser.uid).update({
            status: 'online',
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        debug('User profile loaded successfully');
    } catch (error) {
        console.error('Error loading user profile:', error);
        debug(`Error loading user profile: ${error.message}`);
        throw error;
    }
}

// Setup navigation
function setupNavigation() {
    debug('Setting up navigation');
    
    // Setup logout
    logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        debug('Logging out');
        
        try {
            // Update user status to offline
            if (currentUser) {
                await firebase.firestore().collection('users').doc(currentUser.uid).update({
                    status: 'offline',
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                });
                debug('User status updated to offline');
            }
            
            // Sign out
            await firebase.auth().signOut();
            debug('User signed out successfully');
            
            // Redirect to login page
            window.location.href = '../index.html';
        } catch (error) {
            console.error('Error during logout:', error);
            debug(`Error during logout: ${error.message}`);
            alert('Error during logout. Please try again.');
        }
    });
    
    debug('Navigation setup completed');
}

// Update user status when leaving
window.addEventListener('beforeunload', async () => {
    if (currentUser) {
        debug('Updating user status to offline');
        try {
            await firebase.firestore().collection('users').doc(currentUser.uid).update({
                status: 'offline',
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
            debug('User status updated to offline');
        } catch (error) {
            console.error('Error updating user status:', error);
            debug(`Error updating user status: ${error.message}`);
        }
    }
}); 