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
            logoutBtn.addEventListener('click', () => this.logout());
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

    logout() {
        localStorage.clear();
        window.location.href = '/login.html';
    }
}

window.authManager = new AuthManager();


document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();

            try {
                // Call backend logout (if exists)
                await fetch(`${API_BASE_URL}/auth/logout`, {
                    method: "POST",
                    credentials: "include"
                });
            } catch (err) {
                console.warn("Backend logout failed, clearing client session");
            }

            // Clear client-side auth
            localStorage.clear();
            sessionStorage.clear();

            // Redirect to login page
            window.location.href = "login.html";
        });
    }
});
