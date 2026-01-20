// Dashboard Management

const DEMO_MODE = window.DEMO_MODE === true;

class DashboardManager {
    loadMockDashboard() {
    console.log('DEMO MODE: Loading mock dashboard data');

    // Stats
    this.updateStats({
        unprocessedEmails: 3,
        pendingApprovals: 1,
        activeTasks: 5,
        todayEvents: 2
    });

    // Priority tasks
    this.updatePriorityTasks([
        {
            id: 1,
            title: 'Prepare board meeting agenda',
            priority: 'high',
            status: 'active',
            deadline: new Date(Date.now() + 86400000).toISOString()
        },
        {
            id: 2,
            title: 'Reply to investor email',
            priority: 'high',
            status: 'active'
        }
    ]);

    // Emails
    this.updateEmailsList([
        {
            id: 1,
            from: 'CEO <ceo@company.com>',
            subject: 'Quarterly review',
            snippet: 'Please prepare the slides for tomorrow’s meeting…',
            date: new Date().toISOString()
        }
    ]);

    // Calendar
    this.updateCalendarView([
        {
            title: 'Client Call',
            startTime: new Date().toISOString(),
            description: 'Discuss contract terms'
        }
    ]);

    // Activity
    const activityFeed = document.getElementById('activityFeed');
    if (activityFeed) {
        activityFeed.innerHTML = `
            <div class="activity-item">
                <div class="activity-content">
                    <div class="activity-title">Email processed</div>
                    <div class="activity-description">Investor email summarized</div>
                    <div class="activity-time">5 minutes ago</div>
                </div>
            </div>
        `;
    }

    // Approval count
    document.querySelectorAll('#approvalCount').forEach(el => {
        el.textContent = '1';
    });
}

    constructor() {
        this.currentSection = 'overview';
        this.refreshInterval = null;
        this.autoRefreshEnabled = true;
        this.refreshIntervalTime = 60000; // 1 minute
    }
    
    async initialize() {
    this.setupNavigation();
    this.setupRefreshButton();
    this.setupNotifications();
    this.setupFilters();

    if (DEMO_MODE) {
        this.loadMockDashboard();
        return;
    }
    
    await this.loadDashboardData();
    
    if (this.autoRefreshEnabled) {
        this.startAutoRefresh();
    }
}

    
    // Setup navigation between sections
    setupNavigation() {
        const navItems = document.querySelectorAll('[data-section]');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.getAttribute('data-section');
                this.switchSection(section);
            });
        });
    }
    
    // Switch between dashboard sections
    switchSection(sectionId) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.querySelectorAll(`[data-section="${sectionId}"]`).forEach(item => {
            item.classList.add('active');
        });
        
        // Update content
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        this.currentSection = sectionId;
        this.loadSectionData(sectionId);
    }
    
    // Load data for specific section
    async loadSectionData(section) {
        try {
            Loading.show();
            
            switch (section) {
                case 'overview':
                    await this.loadOverviewData();
                    break;
                case 'emails':
                    await this.loadEmailsData();
                    break;
                case 'tasks':
                    await this.loadTasksData();
                    break;
                case 'calendar':
                    await this.loadCalendarData();
                    break;
            }
        } catch (error) {
            console.error('Error loading section data:', error);
            Toast.error('Failed to load data');
        } finally {
            Loading.hide();
        }
    }
    
    // Load all dashboard data
    async loadDashboardData() {
        if (DEMO_MODE) return;

        try {
            Loading.show();
            
            const [stats, tasks, emails, events] = await Promise.all([
                apiClient.getDashboardStats(),
                apiClient.getTasks({ limit: 5, priority: 'high' }),
                apiClient.getEmails({ limit: 10, unread: true }),
                apiClient.getCalendarEvents(new Date().toISOString(), 
                    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
            ]);
            
            this.updateStats(stats);
            this.updatePriorityTasks(tasks.tasks || []);
            this.updateEmailsList(emails.emails || []);
            this.updateCalendarView(events.events || []);
            
            await this.loadRecentActivity();
            await this.loadApprovalCount();
            
        } catch (error) {
            console.error('Error loading dashboard:', error);
            Toast.error('Failed to load dashboard data');
        } finally {
            Loading.hide();
        }
    }
    
    // Update statistics cards
    updateStats(stats) {
        if (!stats) return;
        
        const elements = {
            statEmails: stats.unprocessedEmails || 0,
            statPending: stats.pendingApprovals || 0,
            statTasks: stats.activeTasks || 0,
            statEvents: stats.todayEvents || 0,
            emailCount: stats.unprocessedEmails || 0,
            taskCount: stats.activeTasks || 0
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }
    
    // Load and display priority tasks
    async loadPriorityTasks() {
        if (DEMO_MODE) return;
        try {
            const response = await apiClient.getTasks({ 
                priority: 'high', 
                status: 'active',
                limit: 5 
            });
            
            this.updatePriorityTasks(response.tasks || []);
        } catch (error) {
            console.error('Error loading priority tasks:', error);
        }
    }
    
    // Update priority tasks display
    updatePriorityTasks(tasks) {
        if (DEMO_MODE) return;
        const container = document.getElementById('priorityTasksList');
        if (!container) return;
        
        if (!tasks || tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                    <p>No high priority tasks</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = tasks.map(task => `
            <div class="task-item" data-task-id="${task.id}">
                <input type="checkbox" class="task-checkbox" ${task.status === 'completed' ? 'checked' : ''}>
                <div class="task-content">
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                    <div class="task-meta">
                        ${getPriorityBadge(task.priority)}
                        ${task.deadline ? `<span>Due: ${DateFormatter.formatDate(task.deadline)}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add event listeners for checkboxes
        container.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const taskId = e.target.closest('.task-item').dataset.taskId;
                if (!DEMO_MODE) {
                    this.toggleTaskCompletion(taskId, e.target.checked);
            }

            });
        });
    }
    
    // Load overview section data
    async loadOverviewData() {
        if (DEMO_MODE) return;
        await this.loadPriorityTasks();
        await this.loadRecentActivity();
    }
    
    // Load recent activity
    async loadRecentActivity() {
        if (DEMO_MODE) return;
        try {
            const response = await apiClient.getRecentActivity(10);
            const container = document.getElementById('activityFeed');
            
            if (!container) return;
            
            if (!response.activities || response.activities.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <p>No recent activity</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = response.activities.map(activity => `
                <div class="activity-item">
                    <div class="activity-icon">
                        ${this.getActivityIcon(activity.type)}
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${this.escapeHtml(activity.title)}</div>
                        <div class="activity-description">${this.escapeHtml(activity.description)}</div>
                        <div class="activity-time">${DateFormatter.formatRelativeTime(activity.timestamp)}</div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading activity:', error);
        }
    }
    
    // Load emails section
    async loadEmailsData() {
        if (DEMO_MODE) return;
        try {
            const response = await apiClient.getEmails({ unread: true });
            this.updateEmailsList(response.emails || []);
        } catch (error) {
            console.error('Error loading emails:', error);
            Toast.error('Failed to load emails');
        }
    }
    
    // Update emails list
    updateEmailsList(emails) {
        if (DEMO_MODE) return;
        const container = document.getElementById('emailsList');
        if (!container) return;
        
        if (!emails || emails.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                    <p>No emails to display</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = emails.map(email => `
            <div class="email-item" data-email-id="${email.id}">
                <div class="email-header">
                    <div>
                        <div class="email-from">${this.escapeHtml(email.from)}</div>
                        <div class="email-subject">${this.escapeHtml(email.subject)}</div>
                    </div>
                    <div class="email-meta">
                        <span>${DateFormatter.formatRelativeTime(email.date)}</span>
                    </div>
                </div>
                <div class="email-preview">${this.escapeHtml(StringUtils.truncate(email.snippet || '', 150))}</div>
            </div>
        `).join('');
    }
    
    // Load tasks section
    async loadTasksData(filter = 'all') {
        if (DEMO_MODE) return;
        try {
            const params = {};
            
            if (filter !== 'all' && filter !== 'completed') {
                params.priority = filter;
            } else if (filter === 'completed') {
                params.status = 'completed';
            }
            
            const response = await apiClient.getTasks(params);
            this.updateTasksList(response.tasks || []);
        } catch (error) {
            console.error('Error loading tasks:', error);
            Toast.error('Failed to load tasks');
        }
    }
    
    // Update all tasks list
    updateTasksList(tasks) {
        const container = document.getElementById('allTasksList');
        if (!container) return;
        
        if (!tasks || tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                    <p>No tasks found</p>
                </div>
            `;
            return;
        }
        
        this.updatePriorityTasks(tasks);
    }
    
    // Load calendar section
    async loadCalendarData() {
        if (DEMO_MODE) return;
        try {
            const today = new Date();
            const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
            
            const response = await apiClient.getCalendarEvents(
                today.toISOString(),
                nextWeek.toISOString()
            );
            
            this.updateCalendarView(response.events || []);
        } catch (error) {
            console.error('Error loading calendar:', error);
            Toast.error('Failed to load calendar');
        }
    }
    
    // Update calendar view
    updateCalendarView(events) {
        const container = document.getElementById('calendarView');
        if (!container) return;
        
        if (!events || events.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <p>No events scheduled</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = events.map(event => `
            <div class="event-item">
                <div class="event-time">${DateFormatter.formatDateTime(event.startTime)}</div>
                <div class="event-title">${this.escapeHtml(event.title)}</div>
                ${event.description ? `<div class="event-description">${this.escapeHtml(event.description)}</div>` : ''}
            </div>
        `).join('');
    }
    
    // Load approval count
    async loadApprovalCount() {
        if (DEMO_MODE) return;
        try {
            const response = await apiClient.getPendingApprovals();
            const count = response.approvals ? response.approvals.length : 0;
            
            document.querySelectorAll('#approvalCount').forEach(el => {
                el.textContent = count;
            });
        } catch (error) {
            console.error('Error loading approval count:', error);
        }
    }
    
    // Setup refresh button
    setupRefreshButton() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }
        
        const syncEmailsBtn = document.getElementById('syncEmailsBtn');
        if (syncEmailsBtn) {
            syncEmailsBtn.addEventListener('click', () => {
                this.syncEmails();
            });
        }
        
        const syncCalendarBtn = document.getElementById('syncCalendarBtn');
        if (syncCalendarBtn) {
            syncCalendarBtn.addEventListener('click', () => {
                this.syncCalendar();
            });
        }
    }
    
    // Refresh data
    async refreshData() {
        if (DEMO_MODE) return;
        await this.loadDashboardData();
        Toast.success('Data refreshed');
    }
    
    // Sync emails
    async syncEmails() {
        if (DEMO_MODE) return;
        try {
            Loading.show();
            await apiClient.syncEmails();
            await this.loadEmailsData();
            Toast.success('Emails synced successfully');
        } catch (error) {
            console.error('Error syncing emails:', error);
            Toast.error('Failed to sync emails');
        } finally {
            Loading.hide();
        }
    }
    
    // Sync calendar
    async syncCalendar() {
        if (DEMO_MODE) return;
        try {
            Loading.show();
            await apiClient.syncCalendar();
            await this.loadCalendarData();
            Toast.success('Calendar synced successfully');
        } catch (error) {
            console.error('Error syncing calendar:', error);
            Toast.error('Failed to sync calendar');
        } finally {
            Loading.hide();
        }
    }
    
    // Setup notifications
    setupNotifications() {
        if (DEMO_MODE) return;
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => {
                this.showNotifications();
            });
        }
    }
    
    // Show notifications
    async showNotifications() {
        if (DEMO_MODE) return;
        try {
            const response = await apiClient.getNotifications();
            // Implement notification dropdown/modal
            console.log('Notifications:', response);
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }
    
    // Setup filters
    setupFilters() {
        if (DEMO_MODE) return;
        const taskFilter = document.getElementById('taskFilter');
        if (taskFilter) {
            taskFilter.addEventListener('change', (e) => {
                this.loadTasksData(e.target.value);
            });
        }
    }
    
    // Toggle task completion
    async toggleTaskCompletion(taskId, completed) {
        if (DEMO_MODE) return;
        try {
            if (completed) {
                await apiClient.completeTask(taskId);
                Toast.success('Task completed');
            } else {
                await apiClient.updateTask(taskId, { status: 'active' });
                Toast.success('Task reopened');
            }
            await this.refreshData();
        } catch (error) {
            console.error('Error updating task:', error);
            Toast.error('Failed to update task');
        }
    }
    
    // Start auto-refresh
    startAutoRefresh() {
        if (DEMO_MODE) return;
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(() => {
            this.refreshData();
        }, this.refreshIntervalTime);
    }
    
    // Stop auto-refresh
    stopAutoRefresh() {
        if (DEMO_MODE) return;
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    // Utility: Get activity icon
    getActivityIcon(type) {
        
        const icons = {
            email: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
            task: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
            calendar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>'
        };
        return icons[type] || icons.task;
    }
    
    // Utility: Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize dashboard
const dashboardManager = new DashboardManager();
window.dashboardManager = dashboardManager;