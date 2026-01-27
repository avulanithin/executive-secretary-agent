const API_BASE = "http://localhost:5000/api";

class APIClient {
    constructor() {
        this.baseURL = API_BASE;
    }

    async request(endpoint, options = {}) {
        const res = await fetch(this.baseURL + endpoint, {
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            ...options
        });

        if (!res.ok) {
            throw new Error("API error");
        }

        return res.json();
    }

    get(endpoint) {
        return this.request(endpoint, { method: "GET" });
    }

    post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: "POST",
            body: JSON.stringify(data)
        });
    }

    // ✅ APPROVAL APIs (MUST be INSIDE the class)
    getPendingApprovals() {
        return this.get("/approvals");
    }

    approveEmail(emailId) {
        return this.post(`/approvals/${emailId}/approve`);
    }

    rejectEmail(emailId) {
        return this.post(`/approvals/${emailId}/reject`);
    }
    completeTask(taskId) {
        return this.post(`/tasks/${taskId}/complete`);
}

}

// ✅ ONE global instance
window.apiClient = new APIClient();
