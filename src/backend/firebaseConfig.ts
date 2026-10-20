// Public Firebase web config. These values identify the project; they aren't
// secrets (security comes from firestore.rules). See docs/backend.md for
// where to find them. While apiKey is empty, sign-in is turned off and the
// app runs as before.
export const firebaseConfig = {
  apiKey: "AIzaSyCv-TEHLX68mh41NIPsEW3NVnMOKlPMOao",
  authDomain: "tabletop-tunes.firebaseapp.com",
  projectId: "tabletop-tunes",
  storageBucket: "tabletop-tunes.firebasestorage.app",
  messagingSenderId: "929738158646",
  appId: "1:929738158646:web:8de39bca6d7c2c824a9e97",
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== "";
