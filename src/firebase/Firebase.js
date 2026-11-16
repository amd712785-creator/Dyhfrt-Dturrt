import { initializeApp } from "firebase/app";
import {
  getDatabase as firebaseGetDatabase,
  ref as firebaseRef,
  child as firebaseChild,
  get as firebaseGet,
  set as firebaseSet,
  update as firebaseUpdate,
  onValue as firebaseOnValue,
} from "firebase/database";
import {
  getAuth as firebaseGetAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
} from "firebase/auth";
import { setUser } from "../redux/google-slice";
import { firebaseConfig } from "./firebaseConfig";

const hasFirebaseConfig = Boolean(
  firebaseConfig && firebaseConfig.apiKey && firebaseConfig.databaseURL
);

// --- Real Firebase instances when configured ---
let realApp = null;
let realDb = null;
let realAuth = null;

if (hasFirebaseConfig) {
  realApp = initializeApp(firebaseConfig);
  realDb = firebaseGetDatabase(realApp);
  realAuth = firebaseGetAuth(realApp);
}

// --- LocalStorage-backed Realtime Database fallback when Firebase env is unset ---
const RTDB_STORAGE_KEY = "ashanime_mock_rtdb";
const USERS_STORAGE_KEY = "ashanime_mock_users";
const listeners = new Set();

function loadRtdb() {
  try {
    const raw = localStorage.getItem(RTDB_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRtdb(data) {
  try {
    localStorage.setItem(RTDB_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

function normalizeValue(val) {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val.map(normalizeValue);
  if (typeof val === "object") {
    const keys = Object.keys(val);
    if (keys.length > 0 && keys.every((k, i) => k === String(i))) {
      return keys.map((k) => normalizeValue(val[k]));
    }
    const out = {};
    for (const k of keys) {
      out[k] = normalizeValue(val[k]);
    }
    return out;
  }
  return val;
}

function getAtPath(root, path) {
  if (!path) return normalizeValue(root);
  const parts = path.split("/").filter(Boolean);
  let cur = root;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object" || !(part in cur)) {
      return null;
    }
    cur = cur[part];
  }
  return normalizeValue(cur);
}

function setAtPath(root, path, value) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return value ?? {};
  const next = root && typeof root === "object" ? { ...root } : {};
  let cur = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    cur[part] = cur[part] && typeof cur[part] === "object" ? { ...cur[part] } : {};
    cur = cur[part];
  }
  const last = parts[parts.length - 1];
  if (value === null || value === undefined) {
    delete cur[last];
  } else {
    cur[last] = value;
  }
  return next;
}

function notifyListeners(changedPath) {
  const root = loadRtdb();
  for (const entry of listeners) {
    if (
      changedPath === entry.path ||
      changedPath.startsWith(entry.path + "/") ||
      entry.path.startsWith(changedPath + "/") ||
      entry.path === ""
    ) {
      const val = getAtPath(root, entry.path);
      entry.callback({
        exists: () => val !== null && val !== undefined,
        val: () => val,
      });
    }
  }
}

const mockDb = { _isMockDb: true };
const mockAuth = { _isMockAuth: true };

export const db = hasFirebaseConfig ? realDb : mockDb;
export const auth = hasFirebaseConfig ? realAuth : mockAuth;

export function getDatabase() {
  return hasFirebaseConfig ? realDb : mockDb;
}

export function ref(database, path = "") {
  if (hasFirebaseConfig) {
    return firebaseRef(database, path);
  }
  const cleanPath = String(path || "").replace(/^\/+|\/+$/g, "");
  return { _isMockRef: true, path: cleanPath };
}

export function child(parentRef, subPath = "") {
  if (hasFirebaseConfig) {
    return firebaseChild(parentRef, subPath);
  }
  const base = parentRef?.path ? `${parentRef.path}/` : "";
  const cleanSub = String(subPath || "").replace(/^\/+|\/+$/g, "");
  return { _isMockRef: true, path: `${base}${cleanSub}`.replace(/\/+$/g, "") };
}

export async function get(dbRef) {
  if (hasFirebaseConfig) {
    return firebaseGet(dbRef);
  }
  const val = getAtPath(loadRtdb(), dbRef?.path || "");
  return {
    exists: () => val !== null && val !== undefined,
    val: () => val,
  };
}

export async function set(dbRef, value) {
  if (hasFirebaseConfig) {
    return firebaseSet(dbRef, value);
  }
  const path = dbRef?.path || "";
  const updated = setAtPath(loadRtdb(), path, value);
  saveRtdb(updated);
  notifyListeners(path);
}

export async function update(dbRef, updates) {
  if (hasFirebaseConfig) {
    return firebaseUpdate(dbRef, updates);
  }
  const path = dbRef?.path || "";
  const root = loadRtdb();
  const existing = getAtPath(root, path);
  const merged =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing, ...updates }
      : { ...updates };
  const updated = setAtPath(root, path, merged);
  saveRtdb(updated);
  notifyListeners(path);
}

export function onValue(dbRef, callback) {
  if (hasFirebaseConfig) {
    return firebaseOnValue(dbRef, callback);
  }
  const entry = { path: dbRef?.path || "", callback };
  listeners.add(entry);
  const val = getAtPath(loadRtdb(), entry.path);
  queueMicrotask(() => {
    callback({
      exists: () => val !== null && val !== undefined,
      val: () => val,
    });
  });
  return () => {
    listeners.delete(entry);
  };
}

export function getAuth() {
  return hasFirebaseConfig ? realAuth : mockAuth;
}

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUsers(users) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // Ignore
  }
}

export async function signInWithEmailAndPassword(authInstance, email, password) {
  if (hasFirebaseConfig) {
    return firebaseSignInWithEmailAndPassword(authInstance, email, password);
  }
  const users = loadUsers();
  const existing = users[email];
  if (!existing || existing.password !== password) {
    const err = new Error("Invalid email or password.");
    err.code = "auth/wrong-password";
    throw err;
  }
  return { user: existing.user };
}

export async function createUserWithEmailAndPassword(
  authInstance,
  email,
  password
) {
  if (hasFirebaseConfig) {
    return firebaseCreateUserWithEmailAndPassword(authInstance, email, password);
  }
  if (!email || !password) {
    const err = new Error("Email and password are required.");
    err.code = "auth/invalid-email";
    throw err;
  }
  const users = loadUsers();
  if (users[email]) {
    const err = new Error("Email already in use.");
    err.code = "auth/email-already-in-use";
    throw err;
  }
  const user = {
    uid: `local-${btoa(email).replace(/[^a-zA-Z0-9]/g, "")}`,
    email,
    displayName: email.split("@")[0],
    photoURL: "",
  };
  users[email] = { password, user };
  saveUsers(users);
  return { user };
}

export async function sendPasswordResetEmail(authInstance, email) {
  if (hasFirebaseConfig) {
    return firebaseSendPasswordResetEmail(authInstance, email);
  }
  if (!email) {
    const err = new Error("Please enter an email address.");
    err.code = "auth/invalid-email";
    throw err;
  }
  return;
}

const provider = hasFirebaseConfig ? new GoogleAuthProvider() : null;

export const SignInWithGoogle = (dispatch) => {
  if (!hasFirebaseConfig) {
    const user = {
      uid: "local-google-user",
      email: "guest@ashanime.local",
      displayName: "Anime Fan",
      photoURL: "",
    };
    localStorage.setItem("user", JSON.stringify(user));
    dispatch(setUser(user));
    return Promise.resolve(user);
  }
  return signInWithPopup(realAuth, provider)
    .then((result) => {
      const user = result.user;
      localStorage.setItem("user", JSON.stringify(user));
      dispatch(setUser(user));
    })
    .catch((error) => {
      console.log(error);
    });
};

export const SignInAnonymously = (dispatch) => {
  if (!hasFirebaseConfig) {
    const user = {
      uid: "local-anon-user",
      email: "",
      displayName: "Guest",
      photoURL: "",
    };
    localStorage.setItem("user", JSON.stringify(user));
    dispatch(setUser(user));
    return Promise.resolve(user);
  }
  return signInAnonymously(realAuth)
    .then((result) => {
      const user = result.user;
      localStorage.setItem("user", JSON.stringify(user));
      dispatch(setUser(user));
    })
    .catch((error) => {
      console.log(error);
    });
};
