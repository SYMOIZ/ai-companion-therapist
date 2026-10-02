import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from "firebase/auth";

const firebaseConfig = {
  authDomain: "sukoon-e8df7.firebaseapp.com",
  projectId: "sukoon-e8df7",
  storageBucket: "sukoon-e8df7.firebasestorage.app",
  messagingSenderId: "378884503542",
  appId: "1:378884503542:web:f39f503a187187668239d7",
  measurementId: "G-TQJ9FS5BBN"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();

  const result = await signInWithPopup(auth, provider);

  return result.user;
}

export async function resetPassword(email: string) {
  return await sendPasswordResetEmail(auth, email);
}
