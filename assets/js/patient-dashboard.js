// Check authentication state
firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Verify if user is patient
    const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    if (userData.role !== 'patient') {
        window.location.href = 'index.html';
        return;
    }

    // Load dashboard data
    loadDashboardData();
});

// Load dashboard data
async function loadDashboardData() {
    try {
        // Load doctor count
        const doctorsSnapshot = await firebase.firestore().collection('users')
            .where('role', '==', 'doctor')
            .get();
        
        document.getElementById('doctorCount').textContent = doctorsSnapshot.size;
        
        // Load message count
        const currentUser = firebase.auth().currentUser;
        const conversationsSnapshot = await firebase.firestore().collection('conversations')
            .where('patientId', '==', currentUser.uid)
            .get();
        
        document.getElementById('messageCount').textContent = conversationsSnapshot.size;
        
        // Load blood pressure readings count
        const bpReadingsSnapshot = await firebase.firestore().collection('bloodPressureReadings')
            .where('patientId', '==', currentUser.uid)
            .get();
        
        document.getElementById('bpCount').textContent = bpReadingsSnapshot.size;
        
        // Load recent activity
        loadRecentActivity();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const currentUser = firebase.auth().currentUser;
        const recentActivityElement = document.getElementById('recentActivity');
        
        // Get recent conversations
        const conversationsSnapshot = await firebase.firestore().collection('conversations')
            .where('patientId', '==', currentUser.uid)
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();
        
        if (conversationsSnapshot.empty) {
            recentActivityElement.innerHTML = '<div class="no-activity">No recent activity</div>';
            return;
        }
        
        let activityHTML = '';
        
        for (const doc of conversationsSnapshot.docs) {
            const conversation = doc.data();
            
            // Get doctor name
            const doctorDoc = await firebase.firestore().collection('users').doc(conversation.doctorId).get();
            const doctorData = doctorDoc.data();
            const doctorName = doctorData.username || doctorData.email || 'Unknown Doctor';
            
            // Get last message
            const messagesSnapshot = await firebase.firestore().collection('conversations')
                .doc(doc.id)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();
            
            let lastMessage = 'No messages';
            if (!messagesSnapshot.empty) {
                lastMessage = messagesSnapshot.docs[0].data().text;
            }
            
            // Format timestamp
            const timestamp = conversation.timestamp ? new Date(conversation.timestamp.toDate()).toLocaleString() : 'Unknown time';
            
            activityHTML += `
                <div class="activity-item">
                    <h4>Conversation with ${doctorName}</h4>
                    <p>${lastMessage}</p>
                    <p class="timestamp">${timestamp}</p>
                </div>
            `;
        }
        
        recentActivityElement.innerHTML = activityHTML;
    } catch (error) {
        console.error('Error loading recent activity:', error);
        document.getElementById('recentActivity').innerHTML = '<div class="error">Error loading recent activity</div>';
    }
} 