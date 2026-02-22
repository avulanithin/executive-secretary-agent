const DEMO_MODE = window.DEMO_MODE === true;

class ApprovalManager {
    constructor() {
        this.approvals = [];
        this.currentApproval = null;
    }

    async initialize() {
        this.bindButtons();

        if (DEMO_MODE) {
            this.renderEmpty();
            return;
        }

        await this.loadApprovals();
    }

    /* -----------------------------
       HELPERS
    ------------------------------ */
    _escHtml(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    _parseSenderName(from) {
        // "John Smith <john@example.com>" → "John Smith"
        const m = String(from || "").match(/^([^<]+)<[^>]+>/);
        return m ? m[1].trim() : "";
    }

    _parseSenderEmail(from) {
        // "John Smith <john@example.com>" → "john@example.com"
        const m = String(from || "").match(/<([^>]+)>/);
        return m ? m[1].trim() : String(from || "").trim();
    }

    _initials(name) {
        const parts = String(name || "?").trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return (name[0] || "?").toUpperCase();
    }

    _formatDate(dateStr) {
        if (!dateStr) return "";
        try {
            return new Date(dateStr).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            });
        } catch {
            return dateStr;
        }
    }

    _priorityLabel(p) {
        return { high: "High", medium: "Medium", low: "Low" }[p] || "Medium";
    }

    /* -----------------------------
       LOAD DATA
    ------------------------------ */
    async loadApprovals() {
        try {
            Loading.show();

            const res = await apiClient.get("/approvals");
            this.approvals = res.approvals || [];

            this.updateApprovalCount(this.approvals.length);
            this.renderApprovals();

        } catch (err) {
            console.error(err);
            Toast.error("Failed to load approvals");
        } finally {
            Loading.hide();
        }
    }

    updateApprovalCount(count) {
        window.State?.setCounts?.({ approvals: count });
    }

    /* -----------------------------
       RENDER LIST
    ------------------------------ */
    renderApprovals() {
        const list = document.getElementById("approvalsList");
        const empty = document.getElementById("emptyState");

        list.querySelectorAll(".approval-card").forEach(e => e.remove());

        if (!this.approvals.length) {
            empty.style.display = "block";
            return;
        }

        empty.style.display = "none";

        this.approvals.forEach(a => {
            const senderName  = this._parseSenderName(a.email.from);
            const senderEmail = this._parseSenderEmail(a.email.from);
            const displayName = senderName || senderEmail;
            const initials    = this._initials(displayName);
            const dateStr     = this._formatDate(a.email.date);
            const priority    = (a.task.priority || "medium").toLowerCase();
            const summary     = a.reasoning || a.task.description || "";

            const card = document.createElement("div");
            card.className = "approval-card";

            card.innerHTML = `
                <div class="appr-card-header">
                    <div class="appr-sender">
                        <div class="appr-avatar">${this._escHtml(initials)}</div>
                        <div class="appr-sender-info">
                            <span class="appr-sender-name">${this._escHtml(displayName)}</span>
                            ${senderName ? `<span class="appr-sender-email">${this._escHtml(senderEmail)}</span>` : ""}
                        </div>
                    </div>
                    <div class="appr-meta">
                        <span class="appr-priority appr-priority-${this._escHtml(priority)}">${this._priorityLabel(priority)}</span>
                        <span class="appr-date">${this._escHtml(dateStr)}</span>
                    </div>
                </div>

                <div class="appr-card-body">
                    <div class="appr-subject">${this._escHtml(a.email.subject || "(No subject)")}</div>
                    <div class="appr-task-title">${this._escHtml(a.task.title || "")}</div>
                    <div class="appr-summary">${this._escHtml(summary)}</div>
                </div>

                <div class="appr-card-footer">
                    <button class="btn-secondary btn-sm appr-review-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        Review
                    </button>
                    <div class="appr-card-actions">
                        <button class="btn-success btn-sm appr-approve-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Approve
                        </button>
                        <button class="btn-danger btn-sm appr-reject-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            Reject
                        </button>
                    </div>
                </div>
            `;

            // Review → open modal
            card.querySelector(".appr-review-btn").onclick = () => {
                this.currentApproval = a;
                this.populateModal(a);
                Modal.open("approvalModal");
            };

            // Quick approve directly from card (uses original task data)
            card.querySelector(".appr-approve-btn").onclick = async () => {
                await this._quickApprove(a.id, a.task);
            };

            // Quick reject directly from card
            card.querySelector(".appr-reject-btn").onclick = async () => {
                await this._quickReject(a.id);
            };

            list.appendChild(card);
        });
    }

    renderEmpty() {
        document.getElementById("emptyState").style.display = "block";
    }

    /* -----------------------------
       MODAL
    ------------------------------ */
    populateModal(a) {
        const senderName  = this._parseSenderName(a.email.from);
        const senderEmail = this._parseSenderEmail(a.email.from);

        // Modal header
        const modalTitle = document.getElementById("modalSubjectTitle");
        const modalSub   = document.getElementById("modalSubjectSub");
        if (modalTitle) modalTitle.textContent = a.email.subject || "(No subject)";
        if (modalSub)   modalSub.textContent   = senderName
            ? `From ${senderName} · ${this._formatDate(a.email.date)}`
            : `From ${senderEmail} · ${this._formatDate(a.email.date)}`;

        // Left column – email
        const fromEl = document.getElementById("emailFrom");
        if (fromEl) fromEl.innerHTML = senderName
            ? `<strong>${this._escHtml(senderName)}</strong> <span class="review-from-email">&lt;${this._escHtml(senderEmail)}&gt;</span>`
            : `<strong>${this._escHtml(senderEmail)}</strong>`;

        const dateEl = document.getElementById("emailDate");
        if (dateEl) dateEl.textContent = new Date(a.email.date).toLocaleString("en-US", {
            weekday: "short", month: "short", day: "numeric",
            year: "numeric", hour: "2-digit", minute: "2-digit"
        });

        const subjectEl = document.getElementById("emailSubject");
        if (subjectEl) subjectEl.textContent = a.email.subject || "(No subject)";

        const bodyEl = document.getElementById("emailBody");
        if (bodyEl) bodyEl.textContent = a.email.body || "";

        // Right column – task
        const titleEl = document.getElementById("taskTitle");
        if (titleEl) titleEl.value = a.task.title || "";

        const descEl = document.getElementById("taskDescription");
        if (descEl) descEl.value = a.task.description || "";

        const prioEl = document.getElementById("taskPriority");
        if (prioEl) prioEl.value = a.task.priority || "medium";

        const deadlineEl = document.getElementById("taskDeadline");
        if (deadlineEl) {
            if (a.task.deadline) {
                try {
                    // Convert ISO → datetime-local format (YYYY-MM-DDTHH:MM)
                    const d = new Date(a.task.deadline);
                    deadlineEl.value = d.toISOString().slice(0, 16);
                } catch {
                    deadlineEl.value = "";
                }
            } else {
                deadlineEl.value = "";
            }
        }

        const confPct = Math.round((a.confidence || 0.6) * 100);
        const confBar = document.getElementById("confidenceBar");
        const confVal = document.getElementById("confidenceValue");
        if (confBar) confBar.style.width  = `${confPct}%`;
        if (confVal) confVal.textContent  = `${confPct}%`;

        const reasonEl = document.getElementById("aiReasoning");
        if (reasonEl) reasonEl.textContent = a.reasoning || "AI extracted this task from the email.";
    }

    /* -----------------------------
       ACTIONS
    ------------------------------ */
    async approveCurrent() {
        if (!this.currentApproval) return;

        try {
            Loading.show();

            await apiClient.post(
                `/approvals/${this.currentApproval.id}/approve`,
                {
                    task: {
                        title:       document.getElementById("taskTitle").value,
                        description: document.getElementById("taskDescription").value,
                        priority:    document.getElementById("taskPriority").value,
                        deadline:    document.getElementById("taskDeadline").value || null
                    }
                }
            );

            Toast.success("Task approved and added to your tasks");
            Modal.close("approvalModal");
            this.currentApproval = null;
            await this.loadApprovals();
            await window.State?.refreshCounts?.({ tasks: true, approvals: true, emails: false });

        } catch (err) {
            console.error(err);
            Toast.error("Approval failed");
        } finally {
            Loading.hide();
        }
    }

    async rejectCurrent() {
        if (!this.currentApproval) return;

        try {
            Loading.show();
            await apiClient.post(`/approvals/${this.currentApproval.id}/reject`);

            Toast.success("Task rejected");
            Modal.close("approvalModal");
            this.currentApproval = null;
            await this.loadApprovals();
            await window.State?.refreshCounts?.({ tasks: false, approvals: true, emails: false });

        } catch (err) {
            console.error(err);
            Toast.error("Rejection failed");
        } finally {
            Loading.hide();
        }
    }

    async _quickApprove(id, task) {
        try {
            Loading.show();
            await apiClient.post(`/approvals/${id}/approve`, { task });
            Toast.success("Task approved");
            await this.loadApprovals();
            await window.State?.refreshCounts?.({ tasks: true, approvals: true, emails: false });
        } catch (err) {
            console.error(err);
            Toast.error("Approval failed");
        } finally {
            Loading.hide();
        }
    }

    async _quickReject(id) {
        try {
            Loading.show();
            await apiClient.post(`/approvals/${id}/reject`);
            Toast.success("Task rejected");
            await this.loadApprovals();
            await window.State?.refreshCounts?.({ tasks: false, approvals: true, emails: false });
        } catch (err) {
            console.error(err);
            Toast.error("Rejection failed");
        } finally {
            Loading.hide();
        }
    }

    /* -----------------------------
       BUTTONS
    ------------------------------ */
    bindButtons() {
        document.getElementById("approveBtn")
            ?.addEventListener("click", () => this.approveCurrent());

        document.getElementById("rejectBtn")
            ?.addEventListener("click", () => this.rejectCurrent());

        document.getElementById("refreshBtn")
            ?.addEventListener("click", () => this.loadApprovals());

        document.getElementById("closeModal")
            ?.addEventListener("click", () => {
                Modal.close("approvalModal");
                this.currentApproval = null;
            });
    }
}

/* -----------------------------
   INIT
------------------------------ */
const approvalManager = new ApprovalManager();

let _approvalsInitialized = false;
window.Sections = window.Sections || {};
window.Sections.approvals = window.Sections.approvals || {
    enter: async () => {
        if (!_approvalsInitialized) {
            approvalManager.initialize();
            _approvalsInitialized = true;
        } else {
            await approvalManager.loadApprovals();
        }
    }
};
