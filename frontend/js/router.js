// frontend/js/router.js
// Hash router + stable sidebar navigation (no full page reload)

(function () {
    const Router = {
        currentRoute: null,
        _initialized: false,

        routes: ["overview", "emails", "approvals", "tasks", "calendar", "settings"],

        _normalize(hash) {
            const raw = (hash || "").replace(/^#/, "").trim();
            return raw || "overview";
        },

        _setActiveNav(route) {
            const links = Array.from(document.querySelectorAll(".sidebar .nav .nav-item"));
            links.forEach((a) => a.classList.remove("active"));

            const active = links.find((a) => {
                const href = (a.getAttribute("href") || "").trim();
                return href === `#${route}`;
            });

            if (active) active.classList.add("active");
        },

        _showSection(route) {
            document.querySelectorAll(".content-section").forEach((sec) => sec.classList.remove("active"));
            const target = document.getElementById(route);
            if (target) target.classList.add("active");
        },

        async go(route, { replace = false } = {}) {
            const normalized = this.routes.includes(route) ? route : "overview";

            if (replace) {
                if (window.location.hash !== `#${normalized}`) {
                    history.replaceState(null, "", `#${normalized}`);
                }
            } else {
                if (window.location.hash !== `#${normalized}`) {
                    window.location.hash = normalized;
                }
            }

            // When hash is set, hashchange will call apply().
            // For replaceState path (or same-hash), apply immediately.
            if (this._normalize(window.location.hash) === normalized) {
                await this.apply(normalized);
            }
        },

        async apply(route) {
            const next = this.routes.includes(route) ? route : "overview";
            if (this.currentRoute === next) {
                this._setActiveNav(next);
                this._showSection(next);
                document.body.classList.add("app-ready");
                return;
            }

            this.currentRoute = next;

            this._setActiveNav(next);
            this._showSection(next);

            // Mount section behavior
            const sections = window.Sections || {};
            const enter = sections[next] && sections[next].enter;
            if (typeof enter === "function") {
                try {
                    await enter();
                } catch (e) {
                    console.error("[router] section enter failed", next, e);
                }
            }

            document.body.classList.add("app-ready");
        },

        _bindSidebarClicks() {
            const nav = document.querySelector(".sidebar .nav");
            if (!nav) return;

            nav.addEventListener("click", (e) => {
                const link = e.target && e.target.closest ? e.target.closest("a.nav-item") : null;
                if (!link) return;

                const href = (link.getAttribute("href") || "").trim();
                if (!href.startsWith("#")) return;

                e.preventDefault();
                const route = this._normalize(href);
                this.go(route);
            });
        },

        init() {
            if (this._initialized) return;
            this._initialized = true;

            this._bindSidebarClicks();

            // One-time shared UI bindings
            try {
                window.bindUserMenuDropdown && window.bindUserMenuDropdown();
            } catch (e) {
                console.warn("[router] bindUserMenuDropdown failed", e);
            }

            // Initial count render + refresh (do not refresh on every navigation)
            try {
                window.State && window.State.renderCounts && window.State.renderCounts();
                window.State && window.State.refreshCounts && window.State.refreshCounts();
            } catch (e) {
                console.warn("[router] initial refreshCounts failed", e);
            }

            window.addEventListener("hashchange", () => {
                const route = this._normalize(window.location.hash);
                this.apply(route);
            });

            // Initial route: apply before any section scripts try to render.
            const initial = this._normalize(window.location.hash);
            this.apply(initial);
        },
    };

    window.Router = Router;

    document.addEventListener("DOMContentLoaded", () => {
        Router.init();
    });
})();
