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
   Navigation (Sidebar switching)
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
   Email logic
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

        updateEmailCount(emails.length);

        if (!emails.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No emails found</p>
                </div>`;
            return;
        }

        container.innerHTML = emails.map(renderEmail).join("");
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
        const res = await fetch("http://localhost:5000/api/emails/sync", {
            method: "POST",
            credentials: "include" // REQUIRED for Flask session
        });

        if (!res.ok) {
            throw new Error(`Sync failed: ${res.status}`);
        }

        await loadEmails();

    } catch (err) {
        console.error("Failed to sync emails", err);
        alert("Failed to sync emails. Check console.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Sync Emails";
    }
}

/* -----------------------------
   Email Renderer
------------------------------ */
function renderEmail(email) {
    return `
        <div class="email-item">
            <div class="email-header">
                <strong>${email.sender}</strong>
                <span class="urgency ${email.urgency_level || "low"}">
                    ${email.urgency_level || "low"}
                </span>
            </div>

            <div class="email-subject">
                ${email.subject || "(No subject)"}
            </div>

            <div class="email-meta">
                ${formatToIST(email.received_at)}
            </div>

            <details class="email-body">
                <summary>View email</summary>
                <pre>${email.body || "No content available"}</pre>
            </details>
        </div>
    `;
}

function updateEmailCount(count) {
    const badge = document.getElementById("emailCount");
    if (badge) badge.textContent = count;
}
