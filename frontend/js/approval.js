// Approval Workflow Manager

const DEMO_MODE = window.DEMO_MODE === true;


class ApprovalManager {
    loadMockApprovals() {
    console.log('DEMO MODE: Loading mock approvals');

    this.approvals = [
        {
            id: 1,
            confidence: 0.82,
            createdAt: new Date().toISOString(),
            reasoning: 'Email contains a clear action request and deadline.',
            email: {
                from: 'CEO <ceo@company.com>',
                subject: 'Prepare board deck',
                snippet: 'Please prepare the board meeting slides by tomorrow.',
                body: 'Please prepare the board meeting slides by tomorrow morning.',
                date: new Date().toISOString()
            },
            task: {
                title: 'Prepare board meeting slides',
                description: 'Create slides for quarterly board review',
                priority: 'high',
                deadline: new Date(Date.now() + 86400000).toISOString(),
                estimatedDuration: 120
            }
        },
        {
            id: 2,
            confidence: 0.65,
            createdAt: new Date().toISOString(),
            reasoning: 'Meeting request detected with moderate confidence.',
            email: {
                from: 'Client <client@example.com>',
                subject: 'Schedule follow-up meeting',
                snippet: 'Can we schedule a follow-up meeting next week?',
                body: 'Can we schedule a follow-up meeting sometime next week?',
                date: new Date().toISOString()
            },
            task: {
                title: 'Schedule client follow-up meeting',
                description: 'Coordinate availability and schedule meeting',
                priority: 'medium',
                deadline: null,
                estimatedDuration: 30
            }
        }
    ];

    this.updateApprovalCount(this.approvals.length);
    this.renderApprovals();
}

    constructor() {
        this.currentApproval = null;
        this.approvals = [];
    }
    
    async initialize() {
    this.setupModal();
    this.setupButtons();

    if (DEMO_MODE) {
        this.loadMockApprovals();
        return;
    }

    await this.loadApprovals();
}

    
    // Setup modal handlers
    setupModal() {
        Modal.setupCloseHandlers('approvalModal');
        
        const closeBtn = document.getElementById('closeModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                Modal.close('approvalModal');
                this.currentApproval = null;
            });
        }
    }
    
    // Setup button handlers
    setupButtons() {
        const approveBtn = document.getElementById('approveBtn');
        const rejectBtn = document.getElementById('rejectBtn');
        const saveEditBtn = document.getElementById('saveEditBtn');
        const approveAllBtn = document.getElementById('approveAllBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        
        if (approveBtn) {
            approveBtn.addEventListener('click', () => this.approveCurrentTask());
        }
        
        if (rejectBtn) {
            rejectBtn.addEventListener('click', () => this.rejectCurrentTask());
        }
        
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', () => this.saveTaskEdits());
        }
        
        if (approveAllBtn) {
            approveAllBtn.addEventListener('click', () => this.approveAll());
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadApprovals());
        }
    }
    
    // Load pending approvals
    async loadApprovals() {
        if (DEMO_MODE) return;

        try {
            Loading.show();
            
            const response = await apiClient.getPendingApprovals();
            this.approvals = response.approvals || [];
            
            this.updateApprovalCount(this.approvals.length);
            this.renderApprovals();
            
        } catch (error) {
            console.error('Error loading approvals:', error);
            Toast.error('Failed to load approvals');
        } finally {
            Loading.hide();
        }
    }
    
    // Update approval count
    updateApprovalCount(count) {
        document.querySelectorAll('#approvalCount').forEach(el => {
            el.textContent = count;
        });
    }
    
    // Render approvals list
    renderApprovals() {
        const container = document.getElementById('approvalsList');
        const emptyState = document.getElementById('emptyState');
        
        if (!container) return;
        
        if (!this.approvals || this.approvals.length === 0) {
            if (emptyState) {
                emptyState.style.display = 'block';
            }
            container.querySelectorAll('.approval-card').forEach(card => card.remove());
            return;
        }
        
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        // Remove existing approval cards
        container.querySelectorAll('.approval-card').forEach(card => card.remove());
        
        // Render each approval
        this.approvals.forEach(approval => {
            const card = this.createApprovalCard(approval);
            container.insertBefore(card, emptyState);
        });
    }
    
    // Create approval card element
    createApprovalCard(approval) {
        const card = document.createElement('div');
        card.className = 'approval-card';
        card.dataset.approvalId = approval.id;
        
        const confidencePercent = Math.round((approval.confidence || 0.5) * 100);
        
        card.innerHTML = `
            <div class="approval-header">
                <div>
                    <div class="approval-title">${this.escapeHtml(approval.task.title)}</div>
                    <div class="approval-source">
                        From: ${this.escapeHtml(approval.email.from)} • 
                        ${DateFormatter.formatRelativeTime(approval.createdAt)}
                    </div>
                </div>
                <div class="approval-actions">
                    <button class="btn-secondary btn-sm" data-action="view">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        Review
                    </button>
                </div>
            </div>
            
            <div class="approval-body">
                <p>${this.escapeHtml(StringUtils.truncate(approval.task.description, 200))}</p>
            </div>
            
            <div class="approval-meta">
                <div class="meta-item">
                    <strong>Priority:</strong>
                    ${getPriorityBadge(approval.task.priority)}
                </div>
                ${approval.task.deadline ? `
                <div class="meta-item">
                    <strong>Deadline:</strong>
                    <span>${DateFormatter.formatDate(approval.task.deadline)}</span>
                </div>
                ` : ''}
                <div class="meta-item">
                    <strong>AI Confidence:</strong>
                    <span style="color: ${confidencePercent >= 70 ? 'var(--success-color)' : 'var(--warning-color)'}">
                        ${confidencePercent}%
                    </span>
                </div>
            </div>
        `;
        
        // Add click handler
        const viewBtn = card.querySelector('[data-action="view"]');
        viewBtn.addEventListener('click', () => {
            this.showApprovalDetail(approval.id);
        });
        
        return card;
    }
    
    // Show approval detail modal
    async showApprovalDetail(approvalId) {
        if (DEMO_MODE) return;

        try {
            Loading.show();
            
            if (DEMO_MODE) {
                this.currentApproval = this.approvals.find(a => a.id === approvalId);
            } else {
                const response = await apiClient.getApprovalById(approvalId);
                this.currentApproval = response.approval;
            }

            
            this.populateModal(this.currentApproval);
            Modal.open('approvalModal');
            
        } catch (error) {
            console.error('Error loading approval detail:', error);
            Toast.error('Failed to load approval details');
        } finally {
            Loading.hide();
        }
    }
    
    // Populate modal with approval data
    populateModal(approval) {
        // Email details
        document.getElementById('emailFrom').textContent = `From: ${approval.email.from}`;
        document.getElementById('emailDate').textContent = DateFormatter.formatDateTime(approval.email.date);
        document.getElementById('emailSubject').textContent = approval.email.subject;
        document.getElementById('emailBody').textContent = approval.email.body || approval.email.snippet;
        
        // Task details
        document.getElementById('taskTitle').value = approval.task.title;
        document.getElementById('taskDescription').value = approval.task.description;
        document.getElementById('taskPriority').value = approval.task.priority.toLowerCase();
        
        if (approval.task.deadline) {
            document.getElementById('taskDeadline').value = DateFormatter.toISOLocal(new Date(approval.task.deadline));
        }
        
        if (approval.task.estimatedDuration) {
            document.getElementById('taskDuration').value = approval.task.estimatedDuration;
        }
        
        // AI confidence
        const confidencePercent = Math.round((approval.confidence || 0.5) * 100);
        const confidenceBar = document.getElementById('confidenceBar');
        const confidenceValue = document.getElementById('confidenceValue');
        
        if (confidenceBar) {
            confidenceBar.style.width = `${confidencePercent}%`;
        }
        
        if (confidenceValue) {
            confidenceValue.textContent = `${confidencePercent}%`;
        }
        
        // AI reasoning
        const reasoningEl = document.getElementById('aiReasoning');
        if (reasoningEl) {
            reasoningEl.textContent = approval.reasoning || 'AI analysis completed successfully.';
        }
    }
    
    // Save task edits
    async saveTaskEdits() {
        if (DEMO_MODE) return;

        if (!this.currentApproval) return;
        
        try {
            const updates = {
                title: document.getElementById('taskTitle').value,
                description: document.getElementById('taskDescription').value,
                priority: document.getElementById('taskPriority').value,
                deadline: document.getElementById('taskDeadline').value || null,
                estimatedDuration: parseInt(document.getElementById('taskDuration').value) || null
            };
            
            await apiClient.updateApproval(this.currentApproval.id, { task: updates });
            
            // Update local data
            this.currentApproval.task = { ...this.currentApproval.task, ...updates };
            
            Toast.success('Changes saved');
        } catch (error) {
            console.error('Error saving edits:', error);
            Toast.error('Failed to save changes');
        }
    }
    
    // Approve current task
    if (DEMO_MODE) {
    Toast.success('Task approved (demo)');
    Modal.close('approvalModal');
    this.approvals = this.approvals.filter(a => a.id !== this.currentApproval.id);
    this.renderApprovals();
    this.updateApprovalCount(this.approvals.length);
    return;
}

    async approveCurrentTask() {
        if (DEMO_MODE) return;

        if (!this.currentApproval) return;
        
        try {
            Loading.show();
            
            // Get any modifications
            const modifications = {
                title: document.getElementById('taskTitle').value,
                description: document.getElementById('taskDescription').value,
                priority: document.getElementById('taskPriority').value,
                deadline: document.getElementById('taskDeadline').value || null,
                estimatedDuration: parseInt(document.getElementById('taskDuration').value) || null
            };
            
            await apiClient.approveTask(this.currentApproval.id, modifications);
            
            Toast.success('Task approved and added to your workflow');
            Modal.close('approvalModal');
            
            // Reload approvals
            await this.loadApprovals();
            
        } catch (error) {
            console.error('Error approving task:', error);
            Toast.error('Failed to approve task');
        } finally {
            Loading.hide();
        }
    }
    
    // Reject current task
    if (DEMO_MODE) {
    Toast.success('Task rejected (demo)');
    Modal.close('approvalModal');
    this.approvals = this.approvals.filter(a => a.id !== this.currentApproval.id);
    this.renderApprovals();
    this.updateApprovalCount(this.approvals.length);
    return;
}

    async rejectCurrentTask() {
        if (DEMO_MODE) return;

        if (!this.currentApproval) return;
        
        const reason = prompt('Reason for rejection (optional):');
        
        try {
            Loading.show();
            
            await apiClient.rejectTask(this.currentApproval.id, reason || '');
            
            Toast.success('Task rejected');
            Modal.close('approvalModal');
            
            // Reload approvals
            await this.loadApprovals();
            
        } catch (error) {
            console.error('Error rejecting task:', error);
            Toast.error('Failed to reject task');
        } finally {
            Loading.hide();
        }
    }
    
    // Approve all pending tasks
    if (DEMO_MODE) {
    Toast.success(`Approved ${this.approvals.length} tasks (demo)`);
    this.approvals = [];
    this.renderApprovals();
    this.updateApprovalCount(0);
    return;
}

    async approveAll() {
        if (DEMO_MODE) return;

        if (!this.approvals || this.approvals.length === 0) {
            Toast.info('No pending approvals');
            return;
        }
        
        const confirmed = confirm(
            `Are you sure you want to approve all ${this.approvals.length} pending tasks?`
        );
        
        if (!confirmed) return;
        
        try {
            Loading.show();
            
            await apiClient.approveAll();
            
            Toast.success(`Approved ${this.approvals.length} tasks`);
            
            // Reload approvals
            await this.loadApprovals();
            
        } catch (error) {
            console.error('Error approving all tasks:', error);
            Toast.error('Failed to approve all tasks');
        } finally {
            Loading.hide();
        }
    }
    
    // Utility: Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize approval manager
const approvalManager = new ApprovalManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    approvalManager.initialize();
});

// Export for global use
window.approvalManager = approvalManager;