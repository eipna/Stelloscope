// Your web app's Firebase configuration
const firebaseConfig = {
    // Replace with your Firebase config
    apiKey: "AIzaSyD8CoCpX7xu5rrhdqbbxD5jwZ4K1BGlz48",
    authDomain: "stelloscope.firebaseapp.com",
    projectId: "stelloscope",
    storageBucket: "stelloscope.firebasestorage.app",
    messagingSenderId: "279952580391",
    appId: "1:279952580391:web:870c13b9ab3f90bd86d302"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore(); 