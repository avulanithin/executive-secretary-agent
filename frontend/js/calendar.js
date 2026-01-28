document.addEventListener("DOMContentLoaded", () => {
    const syncBtn = document.getElementById("syncCalendarBtn");
    if (syncBtn) {
        syncBtn.addEventListener("click", loadCalendar);
    }

    loadCalendar();
});

async function loadCalendar() {
    const container = document.getElementById("calendarView");
    container.innerHTML = "<p>Loading calendar…</p>";

    try {
        const events = await apiClient.get("/tasks/calendar");

        if (!events.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No events scheduled</p>
                </div>`;
            return;
        }

        container.innerHTML = events.map(renderCalendarEvent).join("");

    } catch (err) {
        console.error("Calendar load failed", err);
        container.innerHTML = "<p>Error loading calendar</p>";
    }
}

function renderCalendarEvent(event) {
    return `
        <div class="calendar-event">
            <strong>${event.title}</strong>

            <div class="calendar-meta">
                ${event.start}
            </div>

            <span class="badge badge-calendar">
                Calendar Synced
            </span>
        </div>
    `;
}
