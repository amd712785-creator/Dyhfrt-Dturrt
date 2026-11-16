export interface MockDataSnapshot {
  exists: () => boolean;
  val: () => any;
}

export interface MockUserCredential {
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  };
}

export const db: any;
export const auth: any;

export function getDatabase(): any;
export function ref(database: any, path?: string): any;
export function child(parentRef: any, subPath?: string): any;
export function get(dbRef: any): Promise<MockDataSnapshot>;
export function set(dbRef: any, value: any): Promise<void>;
export function update(dbRef: any, updates: any): Promise<void>;
export function onValue(
  dbRef: any,
  callback: (snapshot: MockDataSnapshot) => void
): () => void;

export function getAuth(): any;
export function signInWithEmailAndPassword(
  authInstance: any,
  email: string,
  password: string
): Promise<MockUserCredential>;
export function createUserWithEmailAndPassword(
  authInstance: any,
  email: string,
  password: string
): Promise<MockUserCredential>;
export function sendPasswordResetEmail(
  authInstance: any,
  email: string
): Promise<void>;

export function SignInWithGoogle(dispatch: any): Promise<any>;
export function SignInAnonymously(dispatch: any): Promise<any>;
