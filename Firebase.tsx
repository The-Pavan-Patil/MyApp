import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyABi7EDEyJv6dGE_bWCXKlILLIZL1NhsOY",
  authDomain: "vitallinks-285a1.firebaseapp.com",
  projectId: "vitallinks-285a1",
  storageBucket: "vitallinks-285a1.firebasestorage.app",
  messagingSenderId: "860108895241",
  appId: "1:860108895241:web:b667cb37dd01ee85eab4d8",
  measurementId: "G-XK2F2JB9SF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


