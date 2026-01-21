// API Client for Executive Secretary Backend

// IMPORTANT:
// DEMO_MODE must be defined ONLY ONCE globally (auth.js already does this)
const IS_DEMO = window.DEMO_MODE === true;

// Backend API base (frontend runs on :8000, backend on :5000)
const API_BASE = IS_DEMO ? null : 'http://localhost:5000/api';

class APIClient {

    constructor() {
        this.baseURL = API_BASE;
        this.token = null;
    }

    // -----------------------------
    // Token handling
    // -----------------------------
    setToken(token) {
        this.token = token;
        if (token) {
            Storage.set('token', token);
        } else {
            Storage.remove('token');
        }
    }

    getToken() {
        if (!this.token) {
            this.token = Storage.get('token');
        }
        return this.token;
    }

    getHeaders(extra = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...extra
        };

        const token = this.getToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        return headers;
    }

    // -----------------------------
    // Core request handler
    // -----------------------------
    async request(endpoint, options = {}) {
        if (IS_DEMO) {
            console.log(`DEMO MODE → ${endpoint}`);
            return {};
        }

        const url = `${this.baseURL}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: this.getHeaders(options.headers)
        });

        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    this.setToken(null);
                    window.location.href = '/login.html';
                }
                throw new Error(data.error || data.message || 'API error');
            }

            return data;
        }

        throw new Error(`Invalid response from server (${response.status})`);
    }

    // -----------------------------
    // HTTP helpers
    // -----------------------------
    get(endpoint, params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request(qs ? `${endpoint}?${qs}` : endpoint, {
            method: 'GET'
        });
    }

    post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    patch(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // -----------------------------
    // Auth APIs
    // -----------------------------
    login(email, password) {
        if (IS_DEMO) {
            return Promise.resolve({
                token: 'demo-token',
                user: { email, fullName: 'Demo User' }
            });
        }
        return this.post('/auth/login', { email, password });
    }

    logout() {
        this.setToken(null);
        if (!IS_DEMO) {
            return this.post('/auth/logout');
        }
    }

    getCurrentUser() {
        if (IS_DEMO) {
            return Promise.resolve({
                user: { fullName: 'Demo User', email: 'demo@executive.ai' }
            });
        }
        return this.get('/auth/me');
    }

    // -----------------------------
    // Google OAuth
    // -----------------------------
    getGoogleAuthURL() {
        return this.get('/auth/google/url');
    }
}

// -----------------------------
// Global instance
// -----------------------------
const apiClient = new APIClient();
window.apiClient = apiClient;
window.APIClient = APIClient;
