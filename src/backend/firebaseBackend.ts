// Firebase implementation of the backend layer: Google sign-in (Auth) and
// per-user data (Firestore). Loaded lazily by BackendProvider so the rest of
// the app never depends on it. Data model and setup: docs/backend.md.

import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FbUser,
} from "firebase/auth";
import {
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { firebaseConfig } from "./firebaseConfig";
import { NotSignedInError, type AuthState, type Backend, type SavedPlaylist, type User } from "./Backend";
import { toBackendError } from "./firebaseErrors";
import { withTimeout } from "./withTimeout";

export function createFirebaseBackend(): Backend {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  // Default (memory) cache, no offline persistence: a save either reaches the
  // server or fails. It's never queued locally and lost.
  const db = getFirestore(app);

  /** Every server call goes through here: bounded in time, errors mapped. */
  async function call<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await withTimeout(op());
    } catch (e) {
      throw toBackendError(e);
    }
  }

  function uid(): string {
    const u = auth.currentUser;
    if (!u) throw new NotSignedInError();
    return u.uid;
  }

  async function writeAccess(u: FbUser): Promise<"write" | "readOnly" | "unreachable"> {
    try {
      const snap = await call(() => getDocFromServer(doc(db, "writers", u.uid)));
      return snap.exists() ? "write" : "readOnly";
    } catch {
      return "unreachable";
    }
  }

  const toUser = (u: FbUser): User => ({ uid: u.uid, name: u.displayName ?? u.email ?? "Signed in" });

  return {
    onAuthChange(cb) {
      let latest = 0;
      async function report(u: FbUser | null) {
        const run = ++latest;
        if (!u) return cb({ status: "signedOut" });
        const access = await writeAccess(u);
        // Ignore a slow check if the user changed meanwhile.
        if (run === latest) cb({ status: "signedIn", user: toUser(u), access } satisfies AuthState);
      }
      // Coming back online: re-check, so "saving unavailable" clears by itself.
      const onOnline = () => void report(auth.currentUser);
      cb({ status: "loading" });
      const unsubscribe = onAuthStateChanged(auth, (u) => void report(u));
      window.addEventListener("online", onOnline);
      return () => {
        unsubscribe();
        window.removeEventListener("online", onOnline);
      };
    },

    async signIn() {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (e) {
        const code = (e as { code?: string }).code;
        // Closing the popup isn't an error worth showing.
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
        throw toBackendError(e);
      }
    },

    signOut: () => fbSignOut(auth),

    userData: {
      async getPlaylist(slug) {
        const snap = await call(() => getDocFromServer(doc(db, "users", uid(), "playlists", slug)));
        if (!snap.exists()) return undefined;
        const { gameSlug, basedOn, tracks } = snap.data() as SavedPlaylist;
        return { gameSlug, basedOn, tracks };
      },

      async savePlaylist(p) {
        const data = { gameSlug: p.gameSlug, basedOn: p.basedOn, tracks: p.tracks, updatedAt: serverTimestamp() };
        await call(() => setDoc(doc(db, "users", uid(), "playlists", p.gameSlug), data));
      },

      async deletePlaylist(slug) {
        await call(() => deleteDoc(doc(db, "users", uid(), "playlists", slug)));
      },

      async getHiddenTracks() {
        const snap = await call(() => getDocFromServer(doc(db, "users", uid())));
        const hidden = snap.data()?.hiddenTracks;
        return Array.isArray(hidden) ? hidden.filter((k): k is string => typeof k === "string") : [];
      },

      async setHiddenTracks(keys) {
        const data = { hiddenTracks: [...keys], updatedAt: serverTimestamp() };
        await call(() => setDoc(doc(db, "users", uid()), data, { merge: true }));
      },

      async getSetting(name) {
        const snap = await call(() => getDocFromServer(doc(db, "users", uid())));
        const value = snap.data()?.[name];
        return typeof value === "boolean" ? value : undefined;
      },

      async setSetting(name, on) {
        const data = { [name]: on, updatedAt: serverTimestamp() };
        await call(() => setDoc(doc(db, "users", uid()), data, { merge: true }));
      },
    },
  };
}
