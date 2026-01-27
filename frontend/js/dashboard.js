document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    setupEmailActions();
});

/* -----------------------------
   Time helpers (UTC → IST)
------------------------------ */
function formatToIST(utcString) {
    if (!utcString) return "";

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
   Navigation
------------------------------ */
function setupNavigation() {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", e => {
            const section = item.dataset.section;
            if (!section) return;

            e.preventDefault();

            document.querySelectorAll(".nav-item")
                .forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            document.querySelectorAll(".content-section")
                .forEach(sec => sec.classList.remove("active"));

            const target = document.getElementById(section);
            if (target) target.classList.add("active");

            if (section === "emails") {
                loadEmails();
            }
        });
    });
}

/* -----------------------------
   Email actions
------------------------------ */
function setupEmailActions() {
    const syncBtn = document.getElementById("syncEmailsBtn");
    if (syncBtn) {
        syncBtn.addEventListener("click", syncEmails);
    }
}

async function loadEmails() {
    const container = document.getElementById("emailsList");
    container.innerHTML = "<p>Loading emails…</p>";

    try {
        const emails = await apiClient.get("/emails");

        console.log("📦 EMAILS FROM API:", emails);
        console.log("📦 EMAIL COUNT:", emails.length);

        updateEmailCount(emails.length);

        if (!emails.length) {
            container.innerHTML = `<div class="empty-state"><p>No emails found</p></div>`;
            return;
        }

        container.innerHTML = "";

        emails.forEach(email => {
            const wrapper = document.createElement("div");
            wrapper.innerHTML = renderEmail(email);
            container.appendChild(wrapper.firstElementChild);
        });

    } catch (err) {
        console.error("Email load failed", err);
        container.innerHTML = "<p>Error loading emails</p>";
    }
}


async function syncEmails() {
    const btn = document.getElementById("syncEmailsBtn");
    btn.disabled = true;
    btn.textContent = "Syncing…";

    try {
        await fetch("http://localhost:5000/api/emails/sync", {
            method: "POST",
            credentials: "include"
        });
        await loadEmails();
    } catch (err) {
        console.error("Failed to sync emails", err);
        alert("Failed to sync emails.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Sync Emails";
    }
}

/* -----------------------------
   AI Processing
------------------------------ */
async function processEmailWithAI(emailId, btn) {
    btn.disabled = true;
    btn.textContent = "Processing…";

    try {
        const res = await fetch(`/api/emails/${email.id}/process`, {
            method: "POST",
            credentials: "include"
            });

        if (!res.ok) {
            throw new Error("AI processing failed");
        }

        await loadEmails();
    } catch (err) {
        console.error(err);
        alert("AI processing failed.");
    }
}

/* -----------------------------
   Email Renderer
------------------------------ */
function renderEmail(email) {
    const urgency = email.urgency_level || "low";
    const category = email.category || "—";

    let aiSummaryHtml = "";

    switch (email.processing_status) {
        case "completed":
            aiSummaryHtml = email.ai_summary
                ? email.ai_summary
                : "No summary generated";
            break;

        case "failed":
            aiSummaryHtml = "❌ AI processing failed";
            break;

        case "processing":
            aiSummaryHtml = "⏳ AI processing…";
            break;

        case "pending":
        default:
            aiSummaryHtml = "⏸ Waiting for AI";
    }

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
                <p>${aiSummaryHtml}</p>
            </div>

            <div class="email-actions">
                <button
                    class="btn-success"
                    onclick="approveEmail(${email.id})"
                >
                    Approve
                </button>

                <button
                    class="btn-danger"
                    onclick="rejectEmail(${email.id})"
                >
                    Reject
                </button>
            </div>
        </div>
    `;
}


function renderAIResult(email) {
    const actions = email.ai_actions || [];

    return `
        <div class="ai-result">
            <h4>AI Summary</h4>
            <p>${email.ai_summary}</p>

            ${actions.length ? `
                <h4>Action Items</h4>
                <ul>
                    ${actions.map(a => `<li>${a}</li>`).join("")}
                </ul>
            ` : ""}
        </div>
    `;
}

function updateEmailCount(count) {
    const badge = document.getElementById("emailCount");
    if (badge) badge.textContent = count;
}

async function approveEmail(emailId) {
    try {
        await apiClient.post(`/emails/${emailId}/approve`);
        alert("Email approved");
        loadEmails();
    } catch (err) {
        console.error("Approve failed", err);
        alert("Failed to approve email");
    }
}

async function rejectEmail(emailId) {
    try {
        await apiClient.post(`/emails/${emailId}/reject`);
        alert("Email rejected");
        loadEmails();
    } catch (err) {
        console.error("Reject failed", err);
        alert("Failed to reject email");
    }
}
