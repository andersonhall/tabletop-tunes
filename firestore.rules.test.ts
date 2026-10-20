// Security-rules tests against the Firestore emulator. Run with
// `npm run test:rules` (needs Java 21+; see docs/backend.md).

import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-tabletop-tunes",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(() => env.cleanup());

// "andy" is allowlisted, "guest" signs in but isn't; both have some saved data.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "writers/andy"), {});
    for (const uid of ["andy", "guest"]) {
      await setDoc(doc(db, `users/${uid}`), { hiddenTracks: ["youtube:aaaaaaaaaaa"] });
      await setDoc(doc(db, `users/${uid}/playlists/cascadia`), { gameSlug: "cascadia", tracks: [] });
    }
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe("an allowlisted user", () => {
  it("can read and write their own data", async () => {
    const db = as("andy");
    await assertSucceeds(getDoc(doc(db, "users/andy")));
    await assertSucceeds(getDoc(doc(db, "users/andy/playlists/cascadia")));
    await assertSucceeds(setDoc(doc(db, "users/andy"), { hiddenTracks: [] }));
    await assertSucceeds(setDoc(doc(db, "users/andy/playlists/seti"), { gameSlug: "seti", tracks: [] }));
    await assertSucceeds(deleteDoc(doc(db, "users/andy/playlists/cascadia")));
  });

  it("can't read or write another user's data", async () => {
    const db = as("andy");
    await assertFails(getDoc(doc(db, "users/guest")));
    await assertFails(getDoc(doc(db, "users/guest/playlists/cascadia")));
    await assertFails(setDoc(doc(db, "users/guest"), { hiddenTracks: [] }));
    await assertFails(setDoc(doc(db, "users/guest/playlists/seti"), { tracks: [] }));
    await assertFails(deleteDoc(doc(db, "users/guest/playlists/cascadia")));
  });
});

describe("a signed-in user who isn't allowlisted", () => {
  it("can read their own data but not write it", async () => {
    const db = as("guest");
    await assertSucceeds(getDoc(doc(db, "users/guest")));
    await assertFails(setDoc(doc(db, "users/guest"), { hiddenTracks: [] }));
    await assertFails(setDoc(doc(db, "users/guest/playlists/seti"), { tracks: [] }));
    await assertFails(deleteDoc(doc(db, "users/guest/playlists/cascadia")));
  });

  it("can't read or write another user's data", async () => {
    const db = as("guest");
    await assertFails(getDoc(doc(db, "users/andy")));
    await assertFails(getDoc(doc(db, "users/andy/playlists/cascadia")));
    await assertFails(setDoc(doc(db, "users/andy"), { hiddenTracks: [] }));
  });
});

describe("the writers allowlist", () => {
  it("lets each user check only their own entry", async () => {
    await assertSucceeds(getDoc(doc(as("andy"), "writers/andy")));
    await assertSucceeds(getDoc(doc(as("guest"), "writers/guest"))); // missing doc, still allowed to ask
    await assertFails(getDoc(doc(as("guest"), "writers/andy")));
  });

  it("can't be changed from the app, so nobody can add themselves", async () => {
    await assertFails(setDoc(doc(as("guest"), "writers/guest"), {}));
    await assertFails(setDoc(doc(as("andy"), "writers/guest"), {}));
    await assertFails(deleteDoc(doc(as("andy"), "writers/andy")));
  });
});

describe("someone not signed in", () => {
  it("can't read or write anything", async () => {
    const db = anon();
    await assertFails(getDoc(doc(db, "users/andy")));
    await assertFails(getDoc(doc(db, "users/andy/playlists/cascadia")));
    await assertFails(setDoc(doc(db, "users/andy"), { hiddenTracks: [] }));
    await assertFails(getDoc(doc(db, "writers/andy")));
    await assertFails(setDoc(doc(db, "writers/anyone"), {}));
  });
});

describe("anything outside users/ and writers/", () => {
  it("is denied", async () => {
    await assertFails(getDoc(doc(as("andy"), "other/x")));
    await assertFails(setDoc(doc(as("andy"), "other/x"), { a: 1 }));
  });
});
