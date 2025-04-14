// Tab switching functionality
function showTab(tabName) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabs = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
    
    if (tabName === 'login') {
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    } else {
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
    }
}

// Create default admin account
async function createDefaultAdmin() {
    const adminData = {
        username: 'admin',
        email: 'admin@statuscope.com',
        password: 'admin123',
        role: 'admin'
    };

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(adminData.email, adminData.password);
        await db.collection('users').doc(userCredential.user.uid).set({
            username: adminData.username,
            email: adminData.email,
            role: adminData.role
        });
        console.log('Default admin account created');
    } catch (error) {
        console.log('Admin account already exists or error:', error);
    }
}

// Handle registration
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const userType = document.getElementById('userType').value;

    try {
        // Check if user already exists
        const userSnapshot = await db.collection('users')
            .where('email', '==', email)
            .get();

        if (!userSnapshot.empty) {
            showMessage('User already exists', 'error');
            return;
        }

        // Create user account
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Store user data in Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            username,
            email,
            role: userType
        });

        showMessage('Registration successful!', 'success');
        showTab('login');
    } catch (error) {
        showMessage(error.message, 'error');
    }
});

// Handle login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const userDoc = await db.collection('users').doc(userCredential.user.uid).get();
        const userData = userDoc.data();

        // Store user info in localStorage
        localStorage.setItem('currentUser', JSON.stringify({
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            role: userData.role
        }));

        // Redirect based on user role
        if (userData.role === 'admin') {
            window.location.href = 'admin-dashboard.html';
        } else {
            window.location.href = 'pages/chat.html';
        }
    } catch (error) {
        showMessage(error.message, 'error');
    }
});

// Utility function to show messages
function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `${type}-message`;
    messageDiv.textContent = message;
    
    const formContainer = document.querySelector('.form-container');
    formContainer.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// Create default admin account on page load
createDefaultAdmin(); 