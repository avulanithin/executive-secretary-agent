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
        document.querySelectorAll("#approvalCount")
            .forEach(el => el.textContent = count);
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
            const card = document.createElement("div");
            card.className = "card approval-card";
            card.innerHTML = `
                <div class="card-body">
                    <h4>${a.task.title}</h4>
                    <p>${a.task.description || ""}</p>
                    <span class="badge pending">Pending</span>
                    <div style="margin-top:12px">
                        <button class="btn-secondary btn-sm">Review</button>
                    </div>
                </div>
            `;

            card.querySelector("button").onclick = () => {
                this.currentApproval = a;
                this.populateModal(a);
                Modal.open("approvalModal");
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
        document.getElementById("emailFrom").textContent = `From: ${a.email.from}`;
        document.getElementById("emailDate").textContent =
            new Date(a.email.date).toLocaleString();

        document.getElementById("emailSubject").textContent = a.email.subject;
        document.getElementById("emailBody").textContent = a.email.body || "";

        document.getElementById("taskTitle").value = a.task.title;
        document.getElementById("taskDescription").value = a.task.description || "";
        document.getElementById("taskPriority").value = a.task.priority || "medium";

        document.getElementById("confidenceBar").style.width =
            `${Math.round((a.confidence || 0.6) * 100)}%`;
        document.getElementById("confidenceValue").textContent =
            `${Math.round((a.confidence || 0.6) * 100)}%`;

        document.getElementById("aiReasoning").textContent =
            a.reasoning || "AI extracted this task from the email.";
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
                        title: document.getElementById("taskTitle").value,
                        description: document.getElementById("taskDescription").value,
                        priority: document.getElementById("taskPriority").value,
                        deadline: document.getElementById("taskDeadline").value || null
                    }
                }
            );

            Toast.success("Task approved");
            Modal.close("approvalModal");
            await this.loadApprovals();

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
            await apiClient.post(
                `/approvals/${this.currentApproval.id}/reject`
            );

            Toast.success("Task rejected");
            Modal.close("approvalModal");
            await this.loadApprovals();

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
document.addEventListener("DOMContentLoaded", () => approvalManager.initialize());
