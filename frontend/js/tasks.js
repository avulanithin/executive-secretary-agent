async function loadTasks() {
    const container = document.getElementById("allTasksList");
    if (!container) return;

    container.innerHTML = "<p>Loading tasks…</p>";

    try {
        const tasks = await apiClient.get("/tasks");

        if (window.State) {
            window.State.setCounts({ tasks: Array.isArray(tasks) ? tasks.length : 0 });
        }

        if (!tasks || !tasks.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No tasks found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = "";

        tasks.forEach((task) => {
            const div = document.createElement("div");
            div.className = "task-item card";
            div.innerHTML = `
                <div class="card-body">
                    <div class="task-header">
                        <strong>${task.title}</strong>
                        <span class="badge ${task.priority}">
                            ${(task.priority || "medium").toUpperCase()}
                        </span>
                    </div>

                    <div class="task-meta">
                        Status: ${task.status}
                    </div>

                    <div style="margin-top: var(--space-3);">
                        ${task.status !== "completed" ? `
                            <button class="btn-success" onclick="markTaskCompleted(${task.id})">
                                Mark as Completed
                            </button>
                        ` : `
                            <span class="completed-label">Completed</span>
                        `}
                    </div>
                </div>
            `;

            container.appendChild(div);
        });

    } catch (err) {
        console.error("Failed to load tasks", err);
        container.innerHTML = "<p>Error loading tasks</p>";
    }
}
async function markTaskCompleted(taskId) {
    try {
        await apiClient.post(`/tasks/${taskId}/complete`);
        await loadTasks(); // refresh UI
        if (typeof window.loadCalendar === "function") {
            window.loadCalendar();
        }

        // Do not refresh counts on navigation; only after backend updates.
        await window.State?.refreshCounts?.({ tasks: true, approvals: false, emails: false });
    } catch (err) {
        console.error("Failed to complete task", err);
        alert("Failed to mark task as completed");
    }
}

// Router integration
window.Sections = window.Sections || {};
window.Sections.tasks = window.Sections.tasks || {
    enter: async () => {
        await loadTasks();
    }
};
