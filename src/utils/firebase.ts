import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, setLogLevel } from "firebase/firestore";

const firebaseConfig = {
  projectId: "extended-discipline-s9ffs",
  appId: "1:476538380502:web:c9ff2a2023e6729849e977",
  apiKey: "AIzaSyDdymZWBogqMpXpCQvW6-q1ap-D93SsXBc",
  authDomain: "extended-discipline-s9ffs.firebaseapp.com",
  storageBucket: "extended-discipline-s9ffs.firebasestorage.app",
  messagingSenderId: "476538380502"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Silence verbose connection warnings and channel timeout messages in the console.
// This prevents benign idle-stream closures from appearing as errors in sandbox logs.
setLogLevel("error");

// Initialize Firestore with custom settings to handle proxy environment limits.
// We force HTTP long polling to completely eliminate the gRPC/WebSocket stream timeout errors 
// ("CANCELLED: Disconnecting idle stream. Timed out waiting for new targets") 

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, "An_AI_model_for_child_Malnutrition_prediction_in_Yemen");

export default app;

