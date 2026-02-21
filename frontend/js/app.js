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

// Auto refresh every 3 minutes
setInterval(() => {
    console.log("🔄 Auto-refreshing data");
    if (typeof window.loadEmails === "function") {
        window.loadEmails();
    }
    if (typeof window.loadTasks === "function") {
        window.loadTasks();
    }
    if (typeof window.loadCalendar === "function") {
        window.loadCalendar();
    }
}, 180000); // 3 minutes

