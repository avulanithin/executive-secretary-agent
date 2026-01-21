// frontend/js/auth.js
// Authentication logic – relies on config.js

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        console.log('[auth] AuthManager initialized');
    }

    // -----------------------------
    // Google OAuth Login
    // -----------------------------
    async loginWithGoogle() {
        try {
            console.log('[auth] Requesting Google OAuth URL...');

            const response = await fetch(
                `${window.API_BASE}/api/auth/google/url`
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (!data.url) {
                throw new Error('OAuth URL not returned by backend');
            }

            console.log('[auth] Redirecting to Google OAuth');
            window.location.href = data.url;

        } catch (error) {
            console.error('[auth] Google login failed:', error);
            alert('Failed to start Google login. Check console.');
        }
    }

    // -----------------------------
    // Logout (frontend only for now)
    // -----------------------------
    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.currentUser = null;

        window.location.href = '/login.html';
    }
}

// --------------------------------------------------
// Global instance (IMPORTANT)
// --------------------------------------------------
window.authManager = new AuthManager();
