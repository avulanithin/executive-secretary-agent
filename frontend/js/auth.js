// Authentication Handler

const DEMO_MODE = window.DEMO_MODE === true;
const BASE_PATH = '/frontend';


class AuthManager {
    constructor() {
        this.currentUser = null;
        this.initializeAuth();
    }
    
    // Initialize authentication state
    async initializeAuth() {
        if (DEMO_MODE) {
            this.currentUser = {
                fullName: 'Demo User',
                email: 'demo@executive.ai'
            };
            Storage.set('user', this.currentUser);
            this.updateUI();
            console.log('DEMO MODE: Auth initialized with demo user');
            return;
        }

        const token = Storage.get('token');

        if (token) {
            apiClient.setToken(token);
            try {
                await this.loadCurrentUser();
            } catch (error) {
                console.error('Failed to load user:', error);
                this.logout();
            }
        }
    }

    
    // Load current user data
    async loadCurrentUser() {
        try {
            if (DEMO_MODE) {
            return this.currentUser;
    }

    const response = await apiClient.getCurrentUser();
            this.currentUser = response.user;
            Storage.set('user', this.currentUser);
            this.updateUI();
            return this.currentUser;
        } catch (error) {
            throw error;
        }
    }
    
    // Login
    async login(email, password, rememberMe = false) {
        try {
            if (DEMO_MODE) {
                this.currentUser = { fullName: 'Demo User', email };
                Storage.set('user', this.currentUser);
                this.updateUI();
                window.location.href = `${BASE_PATH}/index.html`;
                return;
            }

            const response = await apiClient.login(email, password);
            
            if (response.token) {
                this.currentUser = response.user;
                Storage.set('user', this.currentUser);
                this.updateUI();
                return response;
            }
            
            throw new Error('Login failed');
        } catch (error) {
            throw error;
        }
    }
    
    // Logout
    async logout() {
        if (!DEMO_MODE) {
            try {
                await apiClient.logout();
            } catch (error) {
                console.error('Logout error:', error);
            }
        }

        this.currentUser = null;
        Storage.remove('user');
        Storage.remove('token');
        window.location.href = `${BASE_PATH}/login.html`;
    }

    
    // Check if user is authenticated
    isAuthenticated() {
        return !!Storage.get('token');
    }
    
    // Get current user
    getCurrentUser() {
        if (!this.currentUser) {
            this.currentUser = Storage.get('user');
        }
        return this.currentUser;
    }
    
    // Require authentication (redirect if not authenticated)
    requireAuth() {
        if (DEMO_MODE) return true;

        if (!this.isAuthenticated()) {
            const currentPath = window.location.pathname;
            const redirectUrl = encodeURIComponent(currentPath + window.location.search);
            window.location.href = `${BASE_PATH}/login.html?redirect=${redirectUrl}`;
            return false;
        }
        return true;
    }

    
    // Update UI with user information
    updateUI() {
        const user = this.getCurrentUser();
        
        if (!user) return;
        
        // Update user name displays
        const userNameElements = document.querySelectorAll('#userName, [data-user-name]');
        userNameElements.forEach(el => {
            el.textContent = user.fullName || user.email || 'User';
        });
        
        // Update user avatar
        const avatarElements = document.querySelectorAll('#userAvatar, [data-user-avatar]');
        avatarElements.forEach(el => {
            if (user.avatar) {
                el.src = user.avatar;
            } else {
                // Generate avatar from initials
                el.src = this.generateAvatarDataURL(user.fullName || user.email);
            }
        });
    }
    
    // Generate avatar from initials
    generateAvatarDataURL(name) {
        const initials = this.getInitials(name);
        const canvas = document.createElement('canvas');
        canvas.width = 40;
        canvas.height = 40;
        
        const ctx = canvas.getContext('2d');
        
        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, 40, 40);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 40, 40);
        
        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, 20, 20);
        
        return canvas.toDataURL();
    }
    
    // Get initials from name
    getInitials(name) {
        if (!name) return '?';
        
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    
    // Setup logout buttons
    setupLogoutHandlers() {
        document.querySelectorAll('#logoutBtn, [data-logout]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.confirmLogout();
            });
        });
    }
    
    // Confirm logout
    confirmLogout() {
        if (confirm('Are you sure you want to logout?')) {
            this.logout();
        }
    }
}

// Create global instance
const authManager = new AuthManager();

// Setup logout handlers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    authManager.setupLogoutHandlers();
});

// Check authentication on protected pages
if (!DEMO_MODE) {
    if (!window.location.pathname.includes('login')) {
        document.addEventListener('DOMContentLoaded', () => {
            authManager.requireAuth();
        });
    }
}


// Handle OAuth callback
if (!DEMO_MODE && window.location.search.includes('code=')) {
 
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code) {
        Loading.show();
        
        // Exchange code for token
        fetch('/api/auth/oauth/callback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code, state })
        })
        .then(response => response.json())
        .then(data => {
            if (data.token) {
                apiClient.setToken(data.token);
                Storage.set('user', data.user);
                
                // Get redirect URL from state or default to dashboard
                const redirectUrl = state ? decodeURIComponent(state) : '/index.html';
                window.location.href = redirectUrl;
            } else {
                throw new Error('OAuth authentication failed');
            }
        })
        .catch(error => {
            console.error('OAuth error:', error);
            Toast.error('Authentication failed. Please try again.');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
        })
        .finally(() => {
            Loading.hide();
        });
    }
}

// Export for global use
window.authManager = authManager;