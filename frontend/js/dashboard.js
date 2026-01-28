document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    setupEmailActions();
    loadEmails(); // 🔥 THIS IS IMPORTANT
});


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

            if (section === "emails") loadEmails();
            if (section === "tasks") loadTasks();
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

/* -----------------------------
   Load Emails
------------------------------ */
async function loadEmails() {
    const container = document.getElementById("emailsList");
    container.innerHTML = "<p>Loading emails…</p>";

    try {
        const emails = await apiClient.get("/emails");

        console.log("📦 EMAILS FROM API:", emails);
        updateEmailCount(emails.length);

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
    const btn = document.getElementById("syncEmailsBtn");
    btn.disabled = true;
    btn.textContent = "Syncing…";

    try {
        await apiClient.post("/emails/sync");
        await loadEmails();
    } catch (err) {
        console.error(err);
        alert("Failed to sync emails");
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
        const res = await fetch(`/api/emails/${emailId}/process`, {
            method: "POST",
            credentials: "include"
        });

        if (!res.ok) throw new Error("AI processing failed");
        await loadEmails();

    } catch (err) {
        console.error(err);
        alert("AI processing failed.");
    }
}

/* -----------------------------
   Email Renderer (FIXED)
------------------------------ */
function renderEmail(email) {
    const urgency = email.urgency_level || "low";
    const category = email.category || "—";

    let aiSummaryHtml = "⏳ Processing…";

    if (email.processing_status === "completed") {
        aiSummaryHtml = email.ai_summary || "No summary generated";
    } 
    else if (email.processing_status === "failed") {
        aiSummaryHtml = "❌ AI processing failed";
    }
    else if (
        email.processing_status === "processing" &&
        email.ai_summary
    ) {
        aiSummaryHtml = email.ai_summary;
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
   Tasks
------------------------------ */
function renderTask(task) {
    let badge = "";

    if (task.status === "completed") {
        badge = `<span class="badge badge-completed">COMPLETED</span>`;
    } else {
        badge = `<span class="badge badge-approved">APPROVED</span>`;
    }

    return `
      <div class="task-item">
        <strong>${task.title}</strong>
        ${badge}
        <p>Priority: ${task.priority}</p>

        ${
          task.status !== "completed"
            ? `<button onclick="markCompleted(${task.id})">
                Mark Completed
               </button>`
            : ""
        }
      </div>
    `;
}


/* -----------------------------
   Actions
------------------------------ */
async function approveEmail(emailId) {
    try {
        await apiClient.post(`/emails/${emailId}/approve`);
        loadEmails();
    } catch (err) {
        console.error("Approve failed", err);
        alert("Failed to approve email");
    }
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

function updateEmailCount(count) {
    const badge = document.getElementById("emailCount");
    if (badge) badge.textContent = count;
}
