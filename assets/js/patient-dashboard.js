// Check authentication state
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Verify if user is patient
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    if (userData.role !== 'patient') {
        window.location.href = 'index.html';
        return;
    }

    // Load dashboard data
    loadDashboardData(user.uid);
});

// Load dashboard data
async function loadDashboardData(userId) {
    try {
        // Count doctors (doctors with conversations)
        const conversationsSnapshot = await db.collection('conversations')
            .where('patientId', '==', userId)
            .get();
        
        const doctorsCount = conversationsSnapshot.size;
        document.getElementById('doctorsCount').textContent = doctorsCount;
        
        // Count unread messages
        let unreadMessagesCount = 0;
        for (const doc of conversationsSnapshot.docs) {
            const messagesSnapshot = await db.collection('conversations')
                .doc(doc.id)
                .collection('messages')
                .where('senderId', '!=', userId)
                .where('read', '==', false)
                .get();
            
            unreadMessagesCount += messagesSnapshot.size;
        }
        
        document.getElementById('unreadMessagesCount').textContent = unreadMessagesCount;
        
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
        activityList.innerHTML = '<div class="loading">Loading recent activity...</div>';
        
        // Get recent conversations
        const conversationsSnapshot = await db.collection('conversations')
            .where('patientId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();
        
        if (conversationsSnapshot.empty) {
            activityList.innerHTML = '<div class="no-activity">No recent activity</div>';
            return;
        }
        
        activityList.innerHTML = '';
        
        for (const doc of conversationsSnapshot.docs) {
            const conversation = doc.data();
            
            // Get doctor name
            const doctorDoc = await db.collection('users').doc(conversation.doctorId).get();
            const doctorData = doctorDoc.data();
            
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
                <h4>${doctorData.username}</h4>
                <p>${lastMessage}</p>
                <a href="pages/chat.html?conversation=${doc.id}">View Conversation</a>
            `;
            
            activityList.appendChild(activityItem);
        }
    } catch (error) {
        console.error('Error loading recent activity:', error);
        const activityList = document.getElementById('recentActivityList');
        
        if (error.code === 'failed-precondition') {
            activityList.innerHTML = `
                <div class="error">
                    <p>Unable to load recent activity. The database index is being created.</p>
                    <p>Please try again in a few minutes.</p>
                </div>
            `;
        } else {
            activityList.innerHTML = `
                <div class="error">
                    <p>Error loading recent activity. Please try again later.</p>
                    <p>Error details: ${error.message}</p>
                </div>
            `;
        }
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