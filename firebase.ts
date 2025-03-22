import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth,  } from 'firebase/auth';

import {getFirestore} from 'firebase/firestore';
import ReactNativeAsyncStorage, { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

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
export const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app)
export const FIREBASE_DB = getFirestore(app);


