async function loadTasks() {
    console.log("📥 Loading tasks...");

    const container = document.getElementById("allTasksList");
    if (!container) {
        console.error("❌ allTasksList not found in DOM");
        return;
    }

    container.innerHTML = "<p>Loading tasks…</p>";

    try {
        const tasks = await apiClient.get("/tasks");
        console.log("📦 TASKS FROM API:", tasks);

        if (!tasks.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No tasks found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = "";

        tasks.forEach(task => {
            const div = document.createElement("div");
            div.className = "task-item";
            div.innerHTML = `
                <div class="task-header">
                    <strong>${task.title}</strong>
                    <span class="badge ${task.priority}">
                        ${task.priority.toUpperCase()}
                    </span>
                </div>

                <div class="task-meta">
                    Status: ${task.status}
                </div>

                ${task.status !== "completed" ? `
                    <button class="btn-success"
                        onclick="markTaskCompleted(${task.id})">
                        Mark as Completed
                    </button>
                ` : `
                    <span class="completed-label">✅ Completed</span>
                `}
            `;

            container.appendChild(div);
        });

    } catch (err) {
        console.error("❌ Failed to load tasks", err);
        container.innerHTML = "<p>Error loading tasks</p>";
    }
}

let ALL_TASKS = [];

document.addEventListener("DOMContentLoaded", () => {
    loadTasks();
});

async function loadTasks() {
    try {
        const tasks = await apiClient.get("/tasks");
        console.log("📦 TASKS FROM API:", tasks);

        ALL_TASKS = tasks;
        renderTasks(tasks);
    } catch (err) {
        console.error("❌ Failed to load tasks", err);
    }
}

function renderTasks(tasks) {
    const container = document.getElementById("allTasksList");
    container.innerHTML = "";

    if (!tasks.length) {
        container.innerHTML = "<p>No tasks found</p>";
        return;
    }

    tasks.forEach(task => {
        const div = document.createElement("div");
        div.className = "task-item";

        div.innerHTML = `
            <div>
                <strong>${task.title}</strong><br>
                Priority: ${task.priority}<br>
                Status: <span class="task-status">${task.status}</span>
            </div>

            ${
                task.status !== "completed"
                ? `<button onclick="markTaskCompleted(${task.id})">
                        Mark Completed
                   </button>`
                : `<span style="color: green;">✔ Completed</span>`
            }
        `;

        container.appendChild(div);
    });
}

async function markTaskCompleted(taskId) {
    try {
        await apiClient.post(`/tasks/${taskId}/complete`);
        await loadTasks(); // refresh UI
    } catch (err) {
        console.error("Failed to complete task", err);
        alert("Failed to mark task as completed");
    }
}
