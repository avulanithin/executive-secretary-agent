/* =====================================================
    Calendar Section — Backend-driven events
    ===================================================== */

let _calendarBound = false;

let _monthGridCalendar = null;

function _getMonthGridEl() {
    return document.getElementById('calendarMonthGrid');
}

function _destroyMonthGrid() {
    if (_monthGridCalendar) {
        try { _monthGridCalendar.destroy(); } catch (_) {}
        _monthGridCalendar = null;
    }
}

function _renderMonthGridState(innerHtml) {
    const el = _getMonthGridEl();
    if (!el) return;
    _destroyMonthGrid();
    el.innerHTML = innerHtml;
}

function _renderMonthGridLoading() {
    _renderMonthGridState(`
        <div class="cal-loading">
            <div class="spinner"></div>
            <span>Loading month view&hellip;</span>
        </div>`);
}

function _isDateOnly(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

function _getEventStart(ev) {
    return (ev && (ev.start || ev.start_time)) || null;
}

function _getEventEnd(ev) {
    return (ev && (ev.end || ev.end_time)) || null;
}

function _toFullCalendarEvents(events) {
    return (Array.isArray(events) ? events : []).map(ev => {
        const start = _getEventStart(ev);
        const end = _getEventEnd(ev);

        const classNames = [];
        if (ev.status === 'cancelled') classNames.push('fc-event--cancelled');

        return {
            id: ev.id,
            title: ev.title || '(Untitled)',
            start,
            end,
            allDay: _isDateOnly(start),
            classNames,
            extendedProps: {
                description: ev.description || '',
                html_link: ev.html_link || ''
            }
        };
    });
}

function _renderMonthGrid(events) {
    const el = _getMonthGridEl();
    if (!el) return;

    if (!window.FullCalendar || !window.FullCalendar.Calendar) {
        _renderMonthGridState(`
            <div class="empty-state">
                ${WARN_SVG}
                <h3>Month view unavailable</h3>
                <p>FullCalendar failed to load. Refresh the page and try again.</p>
            </div>`);
        return;
    }

    // If we previously rendered a non-calendar state, ensure the mount is empty.
    el.innerHTML = '';

    if (!_monthGridCalendar) {
        _monthGridCalendar = new window.FullCalendar.Calendar(el, {
            initialView: 'dayGridMonth',
            height: 'auto',
            fixedWeekCount: false,
            dayMaxEventRows: true,
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: ''
            },
            eventClick: (info) => {
                const link = info.event.extendedProps && info.event.extendedProps.html_link;
                if (link) {
                    info.jsEvent.preventDefault();
                    window.open(link, '_blank', 'noopener');
                }
            }
        });
        _monthGridCalendar.render();
    }

    _monthGridCalendar.removeAllEvents();
    _monthGridCalendar.addEventSource(_toFullCalendarEvents(events));
}

// ── Date Formatting ──────────────────────────────────
function formatEventDate(iso) {
    if (!iso) return 'No date';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    // All-day events come as "YYYY-MM-DD" — no time component
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${date} \u2022 ${time}`;
}

// ── Event grouping: Today / Upcoming / Past ──────────
function groupEvents(events) {
    const now        = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd   = todayStart + 86400000;

    const groups = { today: [], upcoming: [], past: [] };

    events.forEach(ev => {
        const t = new Date(_getEventStart(ev)).getTime();
        if (t >= todayStart && t < todayEnd) groups.today.push(ev);
        else if (t >= todayEnd)              groups.upcoming.push(ev);
        else                                 groups.past.push(ev);
    });

    return groups;
}

// ── Truncation helper ─────────────────────────────────
function truncate(s, max) {
    if (!s) return '';
    s = s.replace(/\s+/g, ' ').trim();
    return s.length <= max ? s : s.slice(0, max).trimEnd() + '\u2026';
}

// ── Status Badge ─────────────────────────────────────
function renderStatusBadge(ev) {
    if (ev.status === 'cancelled') return '<span class="cal-badge cal-badge--danger">Cancelled</span>';
    return '<span class="cal-badge cal-badge--synced">&#10003; Synced</span>';
}

// ── Single Event Card ─────────────────────────────────
function renderCalendarCard(ev) {
    const shortDesc = truncate(ev.description, 120);

    const openLink = ev.html_link
        ? `<a href="${ev.html_link}" target="_blank" rel="noopener noreferrer" class="cal-open-btn">
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                 <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                 <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
               </svg>
               Open event
           </a>`
        : '';

    const completed = ev.status === 'cancelled';
    const priority = (ev.priority || '').toString().toLowerCase();
    const priorityClass = priority === 'high'   ? 'cal-event-card--high'
                        : priority === 'medium' ? 'cal-event-card--medium'
                        : '';

    return `
    <div class="cal-event-card ${priorityClass}${completed ? ' cal-event-card--completed' : ''}">
        <div class="cal-event-card-inner">
            <div class="cal-event-main">
                <div class="cal-event-title">${ev.title}</div>
                <div class="cal-event-date">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    ${formatEventDate(_getEventStart(ev))}
                    ${_getEventEnd(ev) && _getEventEnd(ev) !== _getEventStart(ev)
                        ? `<span class="cal-event-date-sep">&rarr;</span> ${formatEventDate(_getEventEnd(ev))}`
                        : ''}
                </div>
                ${shortDesc ? `<div class="cal-event-desc">${shortDesc}</div>` : ''}
                ${openLink}
            </div>
            <div class="cal-event-aside">
                ${renderStatusBadge(ev)}
            </div>
        </div>
    </div>`;
}

// ── Group Section ─────────────────────────────────────
function renderGroup(label, icon, events, dimmed) {
    if (!events.length) return '';
    const items = events.map(renderCalendarCard).join('');
    return `
    <div class="cal-group${dimmed ? ' cal-group--dimmed' : ''}">
        <div class="cal-group-header">
            <span class="cal-group-icon">${icon}</span>
            <span class="cal-group-label">${label}</span>
            <span class="cal-group-count">${events.length}</span>
        </div>
        <div class="cal-group-events">${items}</div>
    </div>`;
}

// ── Shared SVG assets ─────────────────────────────────
const CAL_SVG = `<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
</svg>`;

const WARN_SVG = `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <circle cx="12" cy="16" r="0.5" fill="currentColor"/>
</svg>`;

const LINK_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
</svg>`;

// ── Error State Renderer ─────────────────────────────
function renderCalendarLoadError(message) {
    return `
    <div class="empty-state">
        ${WARN_SVG}
        <h3>Calendar failed to load</h3>
        <p>${message || 'Unable to load calendar events. Please try again.'}</p>
        <button class="btn-secondary" onclick="loadCalendar()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Retry
        </button>
    </div>`;
}

// ── Main Load ─────────────────────────────────────────
async function loadCalendar() {
    const container = document.getElementById('calendarView');
    if (!container) return;

    container.innerHTML = `
        <div class="cal-loading">
            <div class="spinner"></div>
            <span>Loading events&hellip;</span>
        </div>`;

    _renderMonthGridLoading();

    let data;
    try {
        data = await apiClient.get('/calendar/events');
    } catch (err) {
        console.error('[calendar] Fetch failed', err);
        const s = renderCalendarLoadError('Unable to load calendar events. Please try again.');
        container.innerHTML = s;
        _renderMonthGridState(s);
        return;
    }

    const events = Array.isArray(data) ? data : [];

    // Always render month grid (even with 0 events).
    _renderMonthGrid(events);

    if (!events.length) {
        container.innerHTML = `
            <div class="empty-state">
                ${CAL_SVG}
                <h3>No upcoming events</h3>
                <p>Your upcoming events will appear here.</p>
            </div>`;
        return;
    }

    const { today, upcoming, past } = groupEvents(events);

    const html = [
        renderGroup('Today',       '&#128197;', today,    false),
        renderGroup('Upcoming',    '&#128336;', upcoming, false),
        renderGroup('Past Events', '&#128337;', past,     true),
    ].filter(Boolean).join('');

    container.innerHTML = html;
}

// ── Router Integration ────────────────────────────────
window.loadCalendar = loadCalendar;

window.Sections = window.Sections || {};
window.Sections.calendar = {
    enter: async () => {
        if (!_calendarBound) {
            const syncBtn = document.getElementById('syncCalendarBtn');
            if (syncBtn) syncBtn.addEventListener('click', loadCalendar);
            _calendarBound = true;
        }
        await loadCalendar();
    }
};

// ── Optional CRUD helpers (Google is source of truth) ─
async function createCalendarEvent(payload) {
    const created = await apiClient.post('/calendar/events', payload);
    await loadCalendar();
    return created;
}

async function updateCalendarEvent(id, payload) {
    const updated = await apiClient.put(`/calendar/events/${encodeURIComponent(id)}`, payload);
    await loadCalendar();
    return updated;
}

async function deleteCalendarEvent(id) {
    const res = await apiClient.delete(`/calendar/events/${encodeURIComponent(id)}`);
    await loadCalendar();
    return res;
}

window.createCalendarEvent = createCalendarEvent;
window.updateCalendarEvent = updateCalendarEvent;
window.deleteCalendarEvent = deleteCalendarEvent;

// Backward compat shim for any external callers
function renderCalendarEvent(event) { return renderCalendarCard(event); }

window.renderCalendarEvent = renderCalendarEvent;
