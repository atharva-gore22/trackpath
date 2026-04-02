// Firebase config and initialization
// This file is imported by both auth.js and app.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDoOleL-zZi59HLDn8lTXwZbbZLgG7ljyw",
  authDomain: "trackpath-e8e96.firebaseapp.com",
  projectId: "trackpath-e8e96",
  storageBucket: "trackpath-e8e96.firebasestorage.app",
  messagingSenderId: "1012999721239",
  appId: "1:1012999721239:web:2ddf701697effd143e2752"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);