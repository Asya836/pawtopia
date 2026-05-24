// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBku3LXxlM3zcPEfuYSPFkinHPhP2xWzVQ",
    authDomain: "pawtopia-d5408.firebaseapp.com",
    projectId: "pawtopia-d5408",
    storageBucket: "pawtopia-d5408.appspot.com",
    messagingSenderId: "849056696403",
    appId: "1:849056696403:web:92c289f57bb265f3e95ea6",
    measurementId: "G-E3L7ME7LMB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics;
try {
    analytics = getAnalytics(app);
} catch (e) {
    // analytics may fail in some environments (Expo); ignore
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, analytics, auth, db, storage };