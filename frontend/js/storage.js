// Backwards-compatible storage wrapper.
// utils.js exports window.AppStorage (JSON aware). If it's already present,
// do not overwrite.
(function () {
    if (window.AppStorage) {
        return;
    }

    const AppStorage = {
        get(key) {
            try { return localStorage.getItem(key); } catch { return null; }
        },
        set(key, val) {
            try { localStorage.setItem(key, val); } catch { }
        },
        remove(key) {
            try { localStorage.removeItem(key); } catch { }
        }
    };

    window.AppStorage = AppStorage;
})();
