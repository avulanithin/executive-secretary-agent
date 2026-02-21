// Toast Notification System
const Toast = {
    container: null,
    
    init() {
        if (!this.container) {
            this.container = document.getElementById('toastContainer');
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = 'toastContainer';
                this.container.className = 'toast-container';
                document.body.appendChild(this.container);
            }
        }
    },
    
    show(message, type = 'info', duration = 4000) {
        this.init();
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.remove(toast));
        
        this.container.appendChild(toast);
        
        if (duration > 0) {
            setTimeout(() => this.remove(toast), duration);
        }
        
        return toast;
    },
    
    remove(toast) {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    },
    
    success(message, duration) {
        return this.show(message, 'success', duration);
    },
    
    error(message, duration) {
        return this.show(message, 'error', duration);
    },
    
    warning(message, duration) {
        return this.show(message, 'warning', duration);
    },
    
    info(message, duration) {
        return this.show(message, 'info', duration);
    }
};

// Add slideOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Alias for backward compatibility
window.showToast = (message, type, duration) => Toast.show(message, type, duration);

// Date Formatting
const DateFormatter = {
    formatDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    },
    
    formatDateTime(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        
        return `${date.toLocaleDateString('en-US', dateOptions)} at ${date.toLocaleTimeString('en-US', timeOptions)}`;
    },
    
    formatRelativeTime(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (seconds < 60) return 'Just now';
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
        
        return this.formatDate(date);
    },
    
    toISOLocal(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().slice(0, 16);
    }
};

// Loading Overlay
const Loading = {
    overlay: null,
    
    init() {
        if (!this.overlay) {
            this.overlay = document.getElementById('loadingOverlay');
            if (!this.overlay) {
                this.overlay = document.createElement('div');
                this.overlay.id = 'loadingOverlay';
                this.overlay.className = 'loading-overlay hidden';
                this.overlay.innerHTML = '<div class="spinner"></div>';
                document.body.appendChild(this.overlay);
            }
        }
    },
    
    show() {
        this.init();
        this.overlay.classList.remove('hidden');
    },
    
    hide() {
        this.init();
        this.overlay.classList.add('hidden');
    }
};

// Modal Helper
const Modal = {
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    },
    
    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    },
    
    setupCloseHandlers(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        const overlay = modal.querySelector('.modal-overlay');
        const closeBtn = modal.querySelector('.modal-close');
        
        if (overlay) {
            overlay.addEventListener('click', () => this.close(modalId));
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close(modalId));
        }
        
        // ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                this.close(modalId);
            }
        });
    }
};

// Local Storage Helper
// NOTE: Do not use the name `Storage` (conflicts with the browser built-in interface)
const AppStorage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('AppStorage error:', error);
            return false;
        }
    },
    
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('AppStorage error:', error);
            return defaultValue;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('AppStorage error:', error);
            return false;
        }
    },
    
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('AppStorage error:', error);
            return false;
        }
    }
};

// Debounce Function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Validation Helpers
const Validators = {
    email(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    required(value) {
        return value !== null && value !== undefined && value.toString().trim() !== '';
    },
    
    minLength(value, min) {
        return value && value.length >= min;
    },
    
    maxLength(value, max) {
        return value && value.length <= max;
    },
    
    isNumber(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    }
};

// String Utilities
const StringUtils = {
    truncate(str, length, suffix = '...') {
        if (str.length <= length) return str;
        return str.substring(0, length) + suffix;
    },
    
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },
    
    camelToTitle(str) {
        const result = str.replace(/([A-Z])/g, ' $1');
        return result.charAt(0).toUpperCase() + result.slice(1);
    },
    
    slugify(str) {
        return str
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
};

// Priority Badge Helper
function getPriorityBadge(priority) {
    const badges = {
        high: '<span class="priority-badge priority-high">High</span>',
        medium: '<span class="priority-badge priority-medium">Medium</span>',
        low: '<span class="priority-badge priority-low">Low</span>'
    };
    return badges[priority.toLowerCase()] || badges.medium;
}

// Export for use in other files
window.Toast = Toast;
window.DateFormatter = DateFormatter;
window.Loading = Loading;
window.Modal = Modal;
window.AppStorage = AppStorage;
window.debounce = debounce;
window.Validators = Validators;
window.StringUtils = StringUtils;
window.getPriorityBadge = getPriorityBadge;