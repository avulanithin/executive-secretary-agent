// frontend/js/config.js
(function () {
    // Toggle demo mode here
    window.DEMO_MODE = false;

    // Backend base URL (Flask)
    window.API_BASE = 'http://localhost:5000';

    // Frontend base path (only for redirects)
    window.FRONTEND_BASE = 'http://localhost:8000';

    console.log('[config] loaded', {
        DEMO_MODE: window.DEMO_MODE,
        API_BASE: window.API_BASE,
        FRONTEND_BASE: window.FRONTEND_BASE
    });
})();
