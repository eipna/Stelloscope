// Check authentication state
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Verify if user is admin
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    if (userData.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }

    // Load users
    loadUsers();
});

// Load users from Firestore
async function loadUsers() {
    try {
        // Load doctors
        const doctorsSnapshot = await db.collection('users')
            .where('role', '==', 'doctor')
            .get();
        
        const doctorsContainer = document.querySelector('#doctorsList .users-container');
        doctorsContainer.innerHTML = '';
        
        doctorsSnapshot.forEach(doc => {
            const doctor = doc.data();
            doctorsContainer.appendChild(createUserCard(doctor));
        });

        // Load patients
        const patientsSnapshot = await db.collection('users')
            .where('role', '==', 'patient')
            .get();
        
        const patientsContainer = document.querySelector('#patientsList .users-container');
        patientsContainer.innerHTML = '';
        
        patientsSnapshot.forEach(doc => {
            const patient = doc.data();
            patientsContainer.appendChild(createUserCard(patient));
        });
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Create user card element
function createUserCard(user) {
    const card = document.createElement('div');
    card.className = 'user-card';
    card.innerHTML = `
        <h3>${user.username}</h3>
        <p class="email">${user.email}</p>
        <p>Role: ${user.role}</p>
    `;
    return card;
}

// Show user tab
function showUserTab(tabName) {
    const doctorsList = document.getElementById('doctorsList');
    const patientsList = document.getElementById('patientsList');
    const tabs = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[onclick="showUserTab('${tabName}')"]`).classList.add('active');
    
    if (tabName === 'doctors') {
        doctorsList.classList.add('active');
        patientsList.classList.remove('active');
    } else {
        doctorsList.classList.remove('active');
        patientsList.classList.add('active');
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