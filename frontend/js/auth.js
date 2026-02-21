// frontend/js/auth.js
// SAFE authentication logic

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        console.log('[auth] AuthManager initialized');

        // 🔒 SAFE logout binding
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }

    // -----------------------------
    // Google OAuth Login
    // -----------------------------
    async loginWithGoogle() {
        try {
            console.log('[auth] Requesting Google OAuth URL...');

            const response = await fetch(
                `${window.API_BASE}/api/auth/google/url`,
                { credentials: 'include' }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (!data.url) {
                throw new Error('OAuth URL not returned');
            }

            window.location.href = data.url;

        } catch (err) {
            console.error('[auth] Google login failed:', err);
            alert('Google login failed. See console.');
        }
    }

    async logout() {
        const apiBase = window.API_BASE || 'http://localhost:5000';

        try {
            // Call backend logout (if exists)
            await fetch(`${apiBase}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (err) {
            console.warn('[auth] Backend logout failed, clearing client session');
        }

        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}

window.authManager = new AuthManager();
