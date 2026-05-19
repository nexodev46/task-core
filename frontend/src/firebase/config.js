import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDKoZ9PrlvsU7FYhNPcpqzYVjCQereC9YA",
  authDomain: "task-core-edc41.firebaseapp.com",
  projectId: "task-core-edc41",
  storageBucket: "task-core-edc41.firebasestorage.app",
  messagingSenderId: "548306614584",
  appId: "1:548306614584:web:2bda1a83fdda207e9b29cd"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar servicios necesarios
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
