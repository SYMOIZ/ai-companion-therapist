import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from "firebase/auth";

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
