// frontend/js/state.js
// Centralized global UI state (counts + simple pub/sub)

(function () {
    const State = {
        counts: {
            emails: 0,
            approvals: 0,
            tasks: 0,
        },
        _listeners: new Set(),

        subscribe(fn) {
            if (typeof fn === "function") {
                this._listeners.add(fn);
                fn(this);
            }
            return () => this._listeners.delete(fn);
        },

        _emit() {
            for (const fn of this._listeners) {
                try {
                    fn(this);
                } catch (e) {
                    console.warn("[state] listener error", e);
                }
            }
        },

        _setCount(key, value) {
            const next = Number.isFinite(value) ? value : 0;
            this.counts[key] = next;
        },

        setCounts(partial) {
            if (!partial || typeof partial !== "object") return;
            if (partial.emails !== undefined) this._setCount("emails", partial.emails);
            if (partial.approvals !== undefined) this._setCount("approvals", partial.approvals);
            if (partial.tasks !== undefined) this._setCount("tasks", partial.tasks);
            this.renderCounts();
            this._emit();
        },

        renderCounts() {
            const setAll = (selector, value) => {
                document.querySelectorAll(selector).forEach((el) => {
                    el.textContent = String(value);
                    // Badge visibility: hide when zero, show when non-zero
                    el.setAttribute("data-count", String(value));
                });
            };

            setAll("#emailCount",    this.counts.emails);
            setAll("#approvalCount", this.counts.approvals);
            setAll("#taskCount",     this.counts.tasks);

            // Optional stat cards on overview
            const statEmails = document.getElementById("statEmails");
            if (statEmails) statEmails.textContent = String(this.counts.emails);
            const statApprovals = document.getElementById("statApprovals");
            if (statApprovals) statApprovals.textContent = String(this.counts.approvals);
            const statTasks = document.getElementById("statTasks");
            if (statTasks) statTasks.textContent = String(this.counts.tasks);
        },

        async refreshCounts({ emails = true, approvals = true, tasks = true } = {}) {
            if (!window.apiClient) return;

            const requests = [];

            if (emails) {
                requests.push(
                    window.apiClient
                        .get("/emails")
                        .then((list) => ({ key: "emails", value: Array.isArray(list) ? list.length : 0 }))
                        .catch(() => ({ key: "emails", value: null }))
                );
            }

            if (approvals) {
                requests.push(
                    window.apiClient
                        .get("/approvals")
                        .then((res) => ({ key: "approvals", value: (res && Array.isArray(res.approvals)) ? res.approvals.length : 0 }))
                        .catch(() => ({ key: "approvals", value: null }))
                );
            }

            if (tasks) {
                requests.push(
                    window.apiClient
                        .get("/tasks")
                        .then((list) => ({ key: "tasks", value: Array.isArray(list) ? list.length : 0 }))
                        .catch(() => ({ key: "tasks", value: null }))
                );
            }

            const results = await Promise.all(requests);
            const partial = {};

            for (const r of results) {
                if (r.value === null) continue;
                partial[r.key] = r.value;
            }

            this.setCounts(partial);
        },
    };

    window.State = State;
})();
