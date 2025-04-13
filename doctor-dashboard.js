// Check authentication state
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Verify if user is doctor
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    if (userData.role !== 'doctor') {
        window.location.href = 'index.html';
        return;
    }

    // Load dashboard data
    loadDashboardData(user.uid);
});

// Load dashboard data
async function loadDashboardData(userId) {
    try {
        // Count active patients (patients with conversations)
        const conversationsSnapshot = await db.collection('conversations')
            .where('doctorId', '==', userId)
            .get();
        
        const activePatientsCount = conversationsSnapshot.size;
        document.getElementById('activePatientsCount').textContent = activePatientsCount;
        
        // Count pending messages
        let pendingMessagesCount = 0;
        for (const doc of conversationsSnapshot.docs) {
            const messagesSnapshot = await db.collection('conversations')
                .doc(doc.id)
                .collection('messages')
                .where('senderId', '!=', userId)
                .where('read', '==', false)
                .get();
            
            pendingMessagesCount += messagesSnapshot.size;
        }
        
        document.getElementById('pendingMessagesCount').textContent = pendingMessagesCount;
        
        // Load recent activity
        loadRecentActivity(userId);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Load recent activity
async function loadRecentActivity(userId) {
    try {
        const activityList = document.getElementById('recentActivityList');
        activityList.innerHTML = '';
        
        // Get recent conversations
        const conversationsSnapshot = await db.collection('conversations')
            .where('doctorId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();
        
        for (const doc of conversationsSnapshot.docs) {
            const conversation = doc.data();
            
            // Get patient name
            const patientDoc = await db.collection('users').doc(conversation.patientId).get();
            const patientData = patientDoc.data();
            
            // Get last message
            const messagesSnapshot = await db.collection('conversations')
                .doc(doc.id)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();
            
            let lastMessage = 'No messages yet';
            if (!messagesSnapshot.empty) {
                lastMessage = messagesSnapshot.docs[0].data().text;
            }
            
            // Create activity item
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <h4>${patientData.username}</h4>
                <p>${lastMessage}</p>
                <a href="chat.html?conversation=${doc.id}">View Conversation</a>
            `;
            
            activityList.appendChild(activityItem);
        }
    } catch (error) {
        console.error('Error loading recent activity:', error);
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