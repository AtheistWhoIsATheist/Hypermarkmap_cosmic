import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type Auth,
  type User
} from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

// Narrowed, secure Google Workspace scopes for Drive & Docs integration
export const GOOGLE_WORKSPACE_SCOPES: string[] = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents'
];

const rawConfig = (firebaseConfig as Record<string, string>) || {};
const env = typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: Record<string, string> }).env : undefined;
const resolvedFirebaseConfig = {
  apiKey: env?.VITE_FIREBASE_API_KEY || rawConfig.apiKey || '',
  authDomain: env?.VITE_FIREBASE_AUTH_DOMAIN || rawConfig.authDomain || '',
  projectId: env?.VITE_FIREBASE_PROJECT_ID || rawConfig.projectId || '',
  storageBucket: env?.VITE_FIREBASE_STORAGE_BUCKET || rawConfig.storageBucket || '',
  messagingSenderId: env?.VITE_FIREBASE_MESSAGING_SENDER_ID || rawConfig.messagingSenderId || '',
  appId: env?.VITE_FIREBASE_APP_ID || rawConfig.appId || ''
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(resolvedFirebaseConfig);
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);

const provider = new GoogleAuthProvider();
GOOGLE_WORKSPACE_SCOPES.forEach((scope) => {
  provider.addScope(scope);
});
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline'
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cached access token in memory (never in localStorage per security requirements)
let cachedAccessToken: string | null = null;

// Auth state listeners
type AuthCallback = (user: User | null, token: string | null) => void;
const listeners = new Set<AuthCallback>();

export const subscribeAuthState = (callback: AuthCallback): (() => void) => {
  listeners.add(callback);
  callback(auth.currentUser, cachedAccessToken);
  return () => {
    listeners.delete(callback);
  };
};

const notifyListeners = (user: User | null, token: string | null) => {
  listeners.forEach((cb) => {
    try {
      cb(user, token);
    } catch (err) {
      console.error('[authService] listener error:', err);
    }
  });
};

/**
 * Initialize auth state listener. Call this on app load.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
): (() => void) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        notifyListeners(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // User is known to firebase but we need a valid OAuth access token for Google Workspace APIs
        notifyListeners(user, null);
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      notifyListeners(null, null);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Must be triggered from a button click or user interaction.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve OAuth access token from Firebase credential');
    }

    cachedAccessToken = credential.accessToken;
    notifyListeners(result.user, cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    console.error('[authService] Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Returns the in-memory cached OAuth access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Returns current authenticated Firebase user.
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Signs the user out and clears the in-memory cached token.
 */
export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
    cachedAccessToken = null;
    notifyListeners(null, null);
  } catch (err) {
    console.error('[authService] Logout error:', err);
    throw err;
  }
};
