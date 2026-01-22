// frontend/js/app.js
// SAFE app bootstrap

document.addEventListener('DOMContentLoaded', () => {
    console.log('[app] DOM ready');

    // Only run dashboard logic on index.html
    if (!window.location.pathname.includes('index.html')) {
        return;
    }

    // Protect against missing authManager
    if (!window.authManager) {
        console.warn('[app] authManager not loaded');
        return;
    }
});
