// /js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "DEINE APIKEY",
  authDomain: "hundepension.firebaseapp.com",
  projectId: "hundepension",
  storageBucket: "hundepension.appspot.com",
  messagingSenderId: "DEINE ID",
  appId: "DEINE APP ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Beispiel Login
export async function login(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}