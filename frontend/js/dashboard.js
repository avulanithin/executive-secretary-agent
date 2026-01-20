// Mock data (later replaced by API calls)
const emails = [
    { subject: "Client Meeting", summary: "Client wants a meeting tomorrow" },
    { subject: "Invoice Approval", summary: "Please approve invoice #456" }
];

const tasks = [
    { title: "Schedule client meeting", priority: "high" },
    { title: "Approve invoice", priority: "medium" }
];

const calendar = [
    { time: "10:00 AM", event: "Team Standup" },
    { time: "2:00 PM", event: "Client Call" }
];

// Render Emails
const emailList = document.getElementById("emailList");
emails.forEach(email => {
    const li = document.createElement("li");
    li.textContent = `${email.subject} - ${email.summary}`;
    emailList.appendChild(li);
});

// Render Tasks
const taskList = document.getElementById("taskList");
tasks.forEach(task => {
    const li = document.createElement("li");
    li.innerHTML = `
        <span class="${task.priority}">
            ${task.title} (${task.priority})
        </span>
    `;
    taskList.appendChild(li);
});

// Render Calendar
const calendarList = document.getElementById("calendarList");
calendar.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.time} - ${item.event}`;
    calendarList.appendChild(li);
});
