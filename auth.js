import { auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// If already logged in, go straight to the app
onAuthStateChanged(auth, user => {
  if (user) window.location.href = 'app.html';
});

// ─── TABS ────────────────────────────────────────────────
let mode = 'login'; // 'login' or 'signup'

document.getElementById('tab-login').addEventListener('click', () => {
  mode = 'login';
  document.getElementById('tab-login').classList.add('active');
  document.getElementById('tab-signup').classList.remove('active');
  document.getElementById('btn-email-auth').textContent = 'Sign in';
  document.getElementById('auth-name').style.display = 'none';
  document.getElementById('auth-password').placeholder = 'Password';
  clearError();
});

document.getElementById('tab-signup').addEventListener('click', () => {
  mode = 'signup';
  document.getElementById('tab-signup').classList.add('active');
  document.getElementById('tab-login').classList.remove('active');
  document.getElementById('btn-email-auth').textContent = 'Create account';
  document.getElementById('auth-name').style.display = 'block';
  document.getElementById('auth-password').placeholder = 'Password (min 6 characters)';
  clearError();
});

// ─── EMAIL AUTH ──────────────────────────────────────────
document.getElementById('btn-email-auth').addEventListener('click', async () => {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const name     = document.getElementById('auth-name').value.trim();

  if (!email || !password) return showError('Please fill in all fields.');
  if (mode === 'signup' && !name) return showError('Please enter your name.');

  setLoading(true);

  try {
    if (mode === 'login') {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
    }
window.location.href = 'dashboard.html';
  } catch (err) {
    setLoading(false);
    showError(friendlyError(err.code));
  }
});

// ─── GOOGLE AUTH ─────────────────────────────────────────
document.getElementById('btn-google').addEventListener('click', async () => {
  setLoading(true);
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
window.location.href = 'dashboard.html';
  } catch (err) {
    setLoading(false);
    showError(friendlyError(err.code));
  }
});

// ─── HELPERS ─────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function clearError() {
  const el = document.getElementById('auth-error');
  el.textContent = '';
  el.style.display = 'none';
}

function setLoading(on) {
  document.getElementById('btn-email-auth').disabled = on;
  document.getElementById('btn-google').disabled = on;
  document.getElementById('btn-email-auth').textContent =
    on ? 'Please wait...' : (mode === 'login' ? 'Sign in' : 'Create account');
}

function friendlyError(code) {
  const map = {
    'auth/user-not-found':       'No account found with this email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/invalid-credential':   'Incorrect email or password.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}