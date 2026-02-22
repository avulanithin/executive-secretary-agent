let _emailActionsBound = false;

/* -----------------------------
   Time helpers (UTC → IST)
------------------------------ */
function formatToIST(utcString) {
    return new Date(utcString).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}

/* -----------------------------
   Email actions
------------------------------ */
function setupEmailActions() {
    if (_emailActionsBound) return;
    const syncButtons = [
        document.getElementById("syncEmailsBtn"),
        document.getElementById("syncEmailsQuickBtn")
    ].filter(Boolean);

    syncButtons.forEach((btn) => {
        btn.addEventListener("click", (e) => {
            console.log("[emails] Sync button clicked", {
                id: btn.id,
                type: e.type,
                ts: new Date().toISOString()
            });
            syncEmails();
        });
    });

    _emailActionsBound = true;
}

/* -----------------------------
   Load Emails
------------------------------ */
async function loadEmails() {
    const container = document.getElementById("emailsList");
    container.innerHTML = "<p>Loading emails…</p>";

    try {
        const emails = await apiClient.get("/emails");
        window.State?.setCounts?.({ emails: Array.isArray(emails) ? emails.length : 0 });

        console.log("[emails] Render count", { count: emails.length });

        if (!emails.length) {
            container.innerHTML =
                `<div class="empty-state"><p>No emails found</p></div>`;
            return;
        }

        container.innerHTML = "";
        emails.forEach(email => {
            const div = document.createElement("div");
            div.innerHTML = renderEmail(email);
            container.appendChild(div.firstElementChild);
        });

    } catch (err) {
        console.error("Email load failed", err);
        container.innerHTML = "<p>Error loading emails</p>";
    }
}

/* -----------------------------
   Sync Emails
------------------------------ */
async function syncEmails() {
    const primaryBtn = document.getElementById("syncEmailsBtn");
    const quickBtn = document.getElementById("syncEmailsQuickBtn");

    // Disable both buttons during sync (if present)
    [primaryBtn, quickBtn].filter(Boolean).forEach((b) => {
        b.disabled = true;
    });

    if (primaryBtn) {
        primaryBtn.textContent = "Syncing…";
    }

    try {
        // Explicitly hit POST /api/emails/sync via apiClient base URL
        await apiClient.post("/emails/sync", {});
        console.log("[emails] Sync success");
        await loadEmails();
    } catch (err) {
        console.error("[emails] Sync failed", err);
        alert("Failed to sync emails");
    } finally {
        [primaryBtn, quickBtn].filter(Boolean).forEach((b) => {
            b.disabled = false;
        });
        if (primaryBtn) {
            primaryBtn.textContent = "Sync Emails";
        }
    }
}

/* -----------------------------
   Email Renderer (FINAL)
------------------------------ */
function renderEmail(email) {
    const urgency = email.urgency_level || "low";
    const category = email.category || "info";

    const INVALID_SUMMARIES = [
        "AI processing failed",
        "❌ AI processing failed"
    ];

    const summary =
        email.ai_summary &&
        !INVALID_SUMMARIES.includes(email.ai_summary.trim())
            ? email.ai_summary
            : (email.body || email.subject || "(No content)");

    return `
        <div class="email-item">
            <div class="email-header">
                <strong>${email.sender}</strong>
                <span class="badge urgency ${urgency}">
                    ${urgency.toUpperCase()}
                </span>
            </div>

            <div class="email-subject">
                ${email.subject || "(No subject)"}
            </div>

            <div class="email-meta">
                ${formatToIST(email.received_at)} · ${category}
            </div>

            <details class="email-body">
                <summary>View email</summary>
                <pre>${email.body || "No content available"}</pre>
            </details>

            <div class="ai-section">
                <h4>AI Summary</h4>
                <p>${summary}</p>
            </div>

            <div class="email-actions">
                <button class="btn-success"
                    onclick="approveEmail(${email.id})">
                    Approve
                </button>

                <button class="btn-danger"
                    onclick="rejectEmail(${email.id})">
                    Reject
                </button>
            </div>
        </div>
    `;
}

/* -----------------------------
   Actions
------------------------------ */
async function approveEmail(emailId) {
    await apiClient.post(`/emails/${emailId}/approve`);
    Toast.success("Sent to approvals");
    await window.State?.refreshCounts?.({ approvals: true, tasks: false, emails: false });
    loadEmails();
}

async function rejectEmail(emailId) {
    try {
        await apiClient.post(`/emails/${emailId}/reject`);
        loadEmails();
    } catch (err) {
        console.error("Reject failed", err);
        alert("Failed to reject email");
    }
}

// Router integration
window.Sections = window.Sections || {};
window.Sections.overview = window.Sections.overview || {
    enter: async () => {
        // Keep overview stats in sync with State
        window.State?.renderCounts?.();
    }
};

window.Sections.emails = window.Sections.emails || {
    enter: async () => {
        setupEmailActions();
        await loadEmails();
    }
};

function bindUserMenuDropdown() {
    const userMenu = document.querySelector(".user-menu");
    const dropdown = document.getElementById("userDropdown");
    if (!userMenu || !dropdown) return;

    if (userMenu.dataset.bound === "true") return;
    userMenu.dataset.bound = "true";

    userMenu.addEventListener("click", () => {
        dropdown.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
        if (!userMenu.contains(e.target)) {
            dropdown.classList.remove("show");
        }
    });
}

window.bindUserMenuDropdown = bindUserMenuDropdown;
