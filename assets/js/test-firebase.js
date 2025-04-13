// Test Firebase connection
console.log('Testing Firebase connection...');

// Initialize Firebase Auth and Firestore
const auth = firebase.auth();
const db = firebase.firestore();

// Check if Firebase is initialized
console.log('Firebase initialized:', !!firebase.apps.length);

// Test authentication
auth.onAuthStateChanged(user => {
    console.log('Auth state changed:', user ? 'User logged in' : 'No user');
    
    if (user) {
        console.log('User ID:', user.uid);
        console.log('User email:', user.email);
        
        // Test Firestore
        testFirestore(user.uid);
    } else {
        console.log('No user logged in');
    }
});

// Test Firestore
async function testFirestore(userId) {
    try {
        console.log('Testing Firestore...');
        
        // Get user document
        const userDoc = await db.collection('users').doc(userId).get();
        console.log('User document exists:', userDoc.exists);
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('User data:', userData);
            
            // Test query
            const usersSnapshot = await db.collection('users').get();
            console.log('Total users:', usersSnapshot.size);
            
            // Count users by role
            const doctors = usersSnapshot.docs.filter(doc => doc.data().role === 'doctor');
            const patients = usersSnapshot.docs.filter(doc => doc.data().role === 'patient');
            
            console.log('Doctors:', doctors.length);
            console.log('Patients:', patients.length);
        }
        
        console.log('Firestore test completed successfully');
    } catch (error) {
        console.error('Error testing Firestore:', error);
    }
} 