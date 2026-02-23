# Executive Secretary Agent — Implementation Audit (Code-Based)

This document describes **what is actually implemented in code** in this repository, and explicitly calls out items that exist only as stubs/legacy code as **NOT IMPLEMENTED**.

**Evidence sources (non-exhaustive list of high-signal files used):**
- Backend entry/config: `run.py`, `backend/app.py`, `backend/config.py`, `backend/api/__init__.py`
- Backend APIs: `backend/api/auth.py`, `backend/api/emails.py`, `backend/api/approvals.py`, `backend/api/tasks.py`, `backend/api/calendar.py`, `backend/api/email_actions.py`
- Backend services: `backend/services/gmail_service.py`, `backend/services/ai_email_service.py`, `backend/services/calendar_service.py`
- Backend AI agent pipeline (not wired to Flask routes): `backend/services/agent_orchestrator.py`, `backend/integrations/groq_client.py`, `backend/agents/base_agent.py`, `backend/agents/email_reader_agent.py`, `backend/agents/task_extractor_agent.py`, `backend/agents/prioritizer_agent.py`, `backend/agents/reviewer_agent.py`, `backend/agents/prompt_templates.py`
- Backend models: `backend/models/user.py`, `backend/models/email.py`, `backend/models/approval.py`, `backend/models/task.py`, `backend/models/notification.py`, `backend/models/calendar_event.py`, `backend/models/ai_log.py`
- Frontend pages: `frontend/index.html`, `frontend/login.html` (+ redirect stubs `frontend/approval.html`, `frontend/tasks.html`, `frontend/settings.html`, `frontend/calendar.html`, `frontend/emails.html`)
- Frontend JS: `frontend/js/config.js`, `frontend/js/utils.js`, `frontend/js/api_client.js`, `frontend/js/auth.js`, `frontend/js/dashboard.js`, `frontend/js/approval.js`, `frontend/js/tasks.js`, `frontend/js/calendar.js`, `frontend/js/state.js`, `frontend/js/router.js`, `frontend/js/app.js`
- Migrations: `migrations/versions/*.py`
- Test scripts: `test_agents.py`, `test_api.py`

---

## 1) System Architecture & Runtime Composition

### 1.1 Repository structure and runtime roles
- **Backend**: Flask app under `backend/`.
- **Frontend**: static HTML/CSS/JS under `frontend/`.
- **Database**: SQLite under `instance/dev.db` (created/managed via Flask-Migrate migrations).
- **AI**: Groq LLM calls used in the *active* email processing path.
- **Google integrations**: Gmail API (read-only) and Google Calendar API.

### 1.2 Backend entrypoint
- `run.py` runs `backend.app:create_app()` and starts Flask dev server on `0.0.0.0:5000` with `debug=True`.
- `backend/app.py`:
  - Loads `.env` via `load_dotenv()`.
  - Loads Flask config from `backend.config.Config`.
  - Initializes Flask-SQLAlchemy and Flask-Migrate via `db.init_app(app)` and `migrate.init_app(app, db)`.
  - Configures CORS: allows `http://localhost:8000` and enables credentialed requests (`supports_credentials=True`).
  - Registers blueprints via `backend.api.register_blueprints(app)`.

### 1.3 Flask blueprints and API prefixes
Blueprint registrations in `backend/api/__init__.py`:
- `/api/auth` → `backend/api/auth.py` (`auth_bp`)
- `/api/emails` → `backend/api/emails.py` (`emails_bp`)
- `/api` → `backend/api/email_actions.py` (`actions_bp`) (**legacy/buggy endpoints; see §3.6**)
- `/api/approvals` → `backend/api/approvals.py` (`approvals_bp`)
- `/api/tasks` → `backend/api/tasks.py` (`tasks_bp`)
- `/api/calendar` → `backend/api/calendar.py` (`calendar_bp`)

### 1.4 Configuration values (as implemented)
From `backend/config.py`:
- `SECRET_KEY = "dev-secret-key"` (hard-coded)
- `SQLALCHEMY_DATABASE_URI = sqlite:///instance/dev.db`
- `SQLALCHEMY_ECHO = True`
- Session:
  - `SESSION_TYPE = "filesystem"`
  - `PERMANENT_SESSION_LIFETIME = 24h`
  - `SESSION_COOKIE_SAMESITE = "Lax"`
  - `SESSION_COOKIE_SECURE = False`

**Implication**: the primary auth mechanism in active routes is server-side session cookie (Flask session) and not JWT.

### 1.5 Environment variables used
- `GOOGLE_CLIENT_ID` (used by OAuth flows and Calendar/Gmail Credentials refresh)
- `GOOGLE_CLIENT_SECRET` (same)
- `GROQ_API_KEY` (required for AI processing; `backend/app.py` warns if missing)

### 1.6 Database & migrations
- Uses Flask-Migrate (Alembic). Migration files present:
  - `04ec9f9f03f1_initial_schema.py`: creates `users`, `emails`.
  - `ec55310ae9a0_add_tasks_table.py`: creates `tasks` table **without** `calendar_event_id` column.
  - `354633be6c21_add_approvals_table.py`: creates `approvals` and attempts to `alter_column('tasks', 'calendar_event_id', ...)` (this assumes `calendar_event_id` exists).
  - `d9e7485bf008_legacy_head_bridge.py`: no-op bridge.
  - `6b3c2a1f6d2a_add_app_calendar_id_to_users.py`: adds `users.app_calendar_id`.

**Important mismatch**:
- `backend/models/task.py` defines `calendar_event_id = db.Column(db.String(255))`, but the `tasks` migration does not create it.
- The `approvals` migration tries to alter `calendar_event_id` even though it is not created in the `tasks` migration file included.

This is an implementation/repo state issue: the database schema **may not match models** unless your local DB/migration history happens to include the missing column via other means.

---

## 2) Email Monitoring & Processing Flow (Gmail → DB → AI → UI)

### 2.1 Trigger model: **API-driven**, not background monitoring
**There is no background worker/scheduler** in the active app that polls Gmail.
- Email sync and processing occurs when:
  - Frontend enters the Emails section, calling `GET /api/emails` (see `frontend/js/dashboard.js` + router integration).
  - User clicks “Sync Emails” → frontend calls `POST /api/emails/sync`.
  - The global frontend auto-refresh timer in `frontend/js/app.js` runs every 3 minutes and calls `loadEmails()` if present (which calls `GET /api/emails`).

### 2.2 Gmail fetch implementation
Implemented in `backend/services/gmail_service.py` as `fetch_gmail_emails(user)`.

**Preconditions**:
- Requires `user.gmail_token` (used as refresh token). If missing, prints `❌ No Gmail token` and returns `[]`.

**Credential configuration**:
- Uses `google.oauth2.credentials.Credentials` with:
  - `token=None`
  - `refresh_token=user.gmail_token`
  - `token_uri=https://oauth2.googleapis.com/token`
  - `client_id=os.getenv("GOOGLE_CLIENT_ID")`
  - `client_secret=os.getenv("GOOGLE_CLIENT_SECRET")`
  - scopes: `["https://www.googleapis.com/auth/gmail.readonly"]`

**Fetch strategy**:
- Computes `since`:
  - `user.last_gmail_sync` if present,
  - otherwise `datetime.utcnow() - timedelta(days=2)` (last 48 hours).
- Calls Gmail list API:
  - `service.users().messages().list(userId="me", maxResults=50).execute()`
  - **No Gmail query string** is used in list.
- For each message id, fetches full message:
  - `service.users().messages().get(userId="me", id=msg_id, format="full").execute()`

**Filtering by time**:
- Uses Gmail’s `internalDate` from the fetched message.
- Drops messages with `internalDate < since_ts`.

**Dedup behavior**:
- Tracks `seen_message_ids` within the page.
- Checks DB for duplicates using `db.session.no_autoflush`:
  - first by `(user_id=user.id, gmail_message_id=msg_id)`
  - then **globally** by `gmail_message_id=msg_id` (because schema has unique index on gmail_message_id).

**Body extraction**:
- Two different body extraction implementations exist in the file:
  - `extract_body(payload)` supports `text/plain` and `text/html` via `BeautifulSoup`.
  - The *active* logic uses an inner recursive `extract_text(payload)` that **only returns `text/plain`** parts.
- Result: HTML-only emails can produce empty `body`.

**DB writes in gmail_service**:
- Creates `Email` objects with fields:
  - `user_id`, `gmail_message_id`, `sender`, `subject`, `body`, `received_at`, `processing_status="pending"`, `decision_status="pending"`.
- Adds each new email to `db.session`.
- Updates `user.last_gmail_sync = datetime.utcnow()`.
- Does **not** commit inside `fetch_gmail_emails` (commit happens in API routes).

### 2.3 Email processing (Groq AI) implementation
Implemented in `backend/services/ai_email_service.py`.

**Public method**:
- `AIEmailService.process_email(email)`

**Preconditions**:
- If `not email.body`, it raises `ValueError("Email body is empty")`.

**LLM client**:
- Uses Groq SDK: `from groq import Groq`.
- Requires `GROQ_API_KEY` env var; if missing, `_get_client()` raises `RuntimeError("GROQ_API_KEY not set")`.

**Model and retry**:
- `MODEL = "llama-3.1-8b-instant"`
- `MAX_RETRIES = 2`

**Prompt contract**:
- Builds a prompt that requires *strict JSON output* with exact keys:
  ```json
  {
    "summary": "string",
    "urgency": "low|medium|high",
    "category": "meeting|task|academic|finance|personal|info|spam",
    "actions": [],
    "deadline": null
  }
  ```
- System message: `"Return JSON only."`.

**Validation** (`_parse_response`):
- Must be valid JSON.
- Must include all required keys.
- `urgency` must be in `{low, medium, high}`.
- `actions` must be a list.
- If `deadline` is truthy, attempts `datetime.fromisoformat(deadline)`; on failure sets `deadline=None`.

**DB field updates**:
- Writes into the Email model:
  - `email.ai_summary`
  - `email.urgency_level`
  - `email.category`
  - `email.ai_actions = json.dumps(result["actions"])`
  - `email.ai_deadline = result["deadline"]` (a `datetime` or `None`)

### 2.4 Email API routes and state transitions
In `backend/api/emails.py` (blueprint mounted at `/api/emails`).

#### GET `/api/emails`
- Auth: checks `session.get("user_id")`. If missing → returns `[]`.
- Fetches new emails: `new_emails = fetch_gmail_emails(user)`.
- For each email in `new_emails`:
  - Attempts `AIEmailService.process_email(email)`.
  - On exception:
    - sets `processing_status = "completed"` (never sets “failed”)
    - sets fallback values:
      - `ai_summary = fallback_summary(email)` (body first, else subject, else “(No content)”) limited to 200 chars
      - `urgency_level = "low"`
      - `category = "info"`
  - On success: sets `processing_status = "completed"`.
- Commits; on commit failure returns `{error: ..., detail: ...}`, HTTP 500.
- Response: list of `Email.to_dict()` for emails filtered by:
  - `Email.user_id = user.id`
  - `Email.decision_status = "pending"`
  - ordered by `received_at desc`.

#### POST `/api/emails/sync`
- Auth: requires `session["user_id"]`; else `401`.
- Same Gmail fetch.
- For each new email:
  - adds it to session
  - attempts AI processing; counts processed vs fallback
  - always sets `processing_status = "completed"`
- Commits; on failure returns `{error, detail}`, HTTP 500.
- Response:
  - `{"status":"synced","new_emails":...,"ai_processed":...,"fallback_used":...}`

#### POST `/api/emails/<email_id>/process`
- No session auth check (it uses `Email.query.get_or_404` only).
- If already `processing_status == "completed"` and `ai_summary` exists → returns `Email.to_dict()` unchanged.
- Otherwise sets `processing_status="processing"`, commits, then runs AI, then sets completed and `processed_at`.
- On AI exception sets fallback summary/default urgency+category and sets `processing_status="completed"`.
- Finally commits and returns `Email.to_dict()`.

#### POST `/api/emails/<email_id>/approve`
- Auth: requires `session["user_id"]`.
- If email already has `decision_status == "approved"`, returns `{success:true,status:"already approved"}`.
- Creates an `Approval` record with:
  - `user_id = session user_id`
  - `email_id = email.id`
  - `confidence = 0.75` (constant)
  - `reasoning = "AI detected a task-worthy email."` (constant)
  - `original_task` JSON string with:
    - title = `email.ai_summary or email.subject`
    - description = `email.body`
    - priority = `email.urgency_level or "medium"`
    - deadline = `email.ai_deadline.isoformat()` or null
- Also updates the Email row:
  - `email.decision_status = "approved"`
  - `email.decision_at = utcnow`
- Commits; on error returns HTTP 500.
- Response: `{success:true,status:"sent_to_approvals"}`.

#### POST `/api/emails/<email_id>/reject`
- Auth: requires session user_id.
- Updates Email:
  - `decision_status="rejected"`
  - `decision_at=utcnow`
- Commits and returns `{success:true,status:"rejected"}`.

### 2.5 Frontend “Emails” implementation
In `frontend/js/dashboard.js`:
- Section enter hook (`window.Sections.emails.enter`) calls:
  - `setupEmailActions()` (binds both sync buttons once)
  - `loadEmails()`.

`loadEmails()`:
- Sets `#emailsList` to “Loading emails…”.
- Calls `apiClient.get("/emails")`.
- Sets global counts: `State.setCounts({emails: emails.length})`.
- Empty list → renders “No emails found”.
- Otherwise renders each email via `renderEmail(email)`.

`renderEmail(email)`:
- Displays sender + urgency badge.
- Displays subject.
- Displays meta line: **UTC string formatted to IST** using `new Date(utcString).toLocaleString` with `timeZone: "Asia/Kolkata"`.
- Shows email body inside a `<details>` with `<summary>View email</summary>` and `<pre>...`.
- “AI Summary” box:
  - If `email.ai_summary` is equal to `"AI processing failed"` or `"❌ AI processing failed"`, it falls back to `email.body` or `email.subject`.
  - Otherwise shows `email.ai_summary`.
- Approve button calls `approveEmail(email.id)` → POST `/emails/<id>/approve`.
- Reject button calls `rejectEmail(email.id)` → POST `/emails/<id>/reject`.

`syncEmails()`:
- Disables both sync buttons while running.
- Changes main sync button text to “Syncing…”.
- Calls `apiClient.post("/emails/sync", {})`.
- On failure: `alert("Failed to sync emails")`.
- Always re-enables buttons and restores label.

---

## 3) Approvals & Tasks (Human-in-the-Loop)

### 3.1 High-level state model (as implemented)
- `Email` starts with `decision_status="pending"`.
- Email “Approve” action (from Emails UI) sets Email `decision_status="approved"` and creates an `Approval(status="pending")` record.
- Approval “Approve” action creates a `Task` and attempts calendar sync, then sets `Approval.status="approved"`.
- Approval “Reject” sets `Approval.status="rejected"` and marks `Email.decision_status="rejected"`.

### 3.2 Approvals API
In `backend/api/approvals.py` (mounted at `/api/approvals`).

#### GET `/api/approvals`
- Auth: session user_id required; if missing returns `{approvals: []}`.
- Queries `Approval` for `user_id` and `status="pending"`.
- For each approval:
  - Parses `json.loads(a.original_task)` into a dict `task`.
  - Returns an approval object:
    - `id`, `confidence`, `reasoning`, `createdAt`
    - `email` object with `{from, subject, body, date}`
    - `task` object (the parsed JSON)

#### POST `/api/approvals/<approval_id>/approve`
- Auth: requires session.
- Finds approval by `id`, `user_id`, `status="pending"`, else 404.
- Parses task payload:
  - Uses request JSON `data.task` if provided, else falls back to `json.loads(approval.original_task)`.
  - Validates `task_data` is object.
  - Requires non-empty string `title`.
- Deadline parsing:
  - `_parse_iso_datetime` accepts:
    - `None` → `None`
    - `datetime` → returned
    - `str` → attempts `datetime.fromisoformat`, with special-case converting trailing `Z` into `+00:00`.
  - If tz-aware, normalizes to naive UTC.
  - Parse failures → `None`.
- Creates `Task` with:
  - `user_id`, `email_id=approval.email_id`, `title`, `description`, `priority`, `suggested_deadline`, `actual_deadline`, `status="pending"`.
- `db.session.flush()` is used to get `task.id`.
- Calendar sync:
  - Loads `user = User.query.get(user_id)`.
  - Calls `create_calendar_event(user, task)` from `backend/services/calendar_service.py`.
- Updates approval:
  - `status="approved"`
  - `task_id = task.id`
  - `modified_task = json.dumps(task_data)`
  - `decided_at = utcnow`
- Also updates linked email (if present): sets `decision_status="approved"`, `decision_at=utcnow`.
- On exceptions: rollbacks, returns `{success:false,error:"Failed to approve task: ..."}`, HTTP 500.
- On success: `{success:true,task_id:<id>}`.

#### POST `/api/approvals/<approval_id>/reject`
- Auth: requires session.
- Finds approval by `id` and `user_id`.
- Sets `approval.status="rejected"` and `decided_at=utcnow`.
- Updates linked email (if present): `decision_status="rejected"`, `decision_at=utcnow`.
- Commits; on errors returns HTTP 500.
- On success: `{success:true,status:"rejected"}`.

### 3.3 Approvals UI
Implemented in `frontend/js/approval.js`.

**Entry hook**:
- `window.Sections.approvals.enter` initializes `ApprovalManager` once.
  - First entry: `approvalManager.initialize()`.
  - Subsequent entries: reloads approvals (`approvalManager.loadApprovals()`).

**DEMO mode**:
- `const DEMO_MODE = window.DEMO_MODE === true;` (from `frontend/js/config.js`).
- If demo mode is true, approvals render empty state and does not call backend.

**List rendering**:
- Fetches `GET /approvals` via `apiClient.get("/approvals")`.
- Expects response shape `{ approvals: [...] }`.
- For each approval, renders card with:
  - Sender name/email parsed from `email.from` (expects `"Name <email>"` format).
  - Priority badge derived from `a.task.priority`.
  - Date derived from `a.email.date`.
  - “Review” button opens modal and populates it.
  - Quick “Approve” and “Reject” buttons call backend without opening modal.

**Modal behavior**:
- Modal is `#approvalModal` in `frontend/index.html`.
- Populates:
  - Subject, From, Date, Body.
  - Task fields: title, description, priority, deadline.
  - Confidence bar: `confPct = Math.round((a.confidence || 0.6) * 100)`.
  - Reasoning text.

**Approve action**:
- POST `/approvals/<approval.id>/approve` with payload:
  ```json
  {
    "task": {
      "title": "...",
      "description": "...",
      "priority": "high|medium|low",
      "deadline": "YYYY-MM-DDTHH:MM" | null
    }
  }
  ```
- On success:
  - Toast success
  - Closes modal
  - Reload approvals
  - Refreshes counts (`State.refreshCounts({tasks:true, approvals:true, emails:false})`).

**Reject action**:
- POST `/approvals/<approval.id>/reject`
- On success:
  - Toast success
  - Closes modal
  - Reload approvals
  - Refreshes counts (`{tasks:false, approvals:true, emails:false}`)

**Buttons present but not implemented**:
- `#approveAllBtn` exists in HTML but there is **no JavaScript binding** for it in the repo. **NOT IMPLEMENTED**.

### 3.4 Tasks API
In `backend/api/tasks.py` (mounted at `/api/tasks`).

#### GET `/api/tasks`
- Auth: session user_id required; if missing returns `[]`.
- Queries tasks by `user_id`, ordered by `created_at desc`.
- Auto calendar sync:
  - For each task: if `task.suggested_deadline` exists and `not task.calendar_event_id`, calls `create_calendar_event(user, task)`.
  - This is the only duplicate prevention: it uses `task.calendar_event_id` as the guard.
- Returns list of `task.to_dict()`.
  - Note: `Task.to_dict()` includes: `id`, `email_id`, `title`, `description`, `priority`, `status`, `estimated_duration`, `suggested_deadline` (iso), `created_at` (iso).
  - It does **not** include `user_id`, `calendar_event_id`, `updated_at`, or `actual_deadline`.

#### POST `/api/tasks/<task_id>/complete`
- Auth: uses `session.get("user_id")`.
- Queries task by `(id=task_id, user_id=session_user_id)`.
- Sets:
  - `task.status = "completed"`
  - `task.actual_deadline = datetime.utcnow()`
- Calls `delete_calendar_event(user, task)`.
- Commits.
- Returns `{success:true}`.

#### GET `/api/tasks/calendar`
- Returns simplified event-like objects for tasks:
  - `start` is `suggested_deadline` or `created_at`.
  - Includes `calendar_synced: bool(task.calendar_event_id)`.

### 3.5 Tasks UI
In `frontend/js/tasks.js`:
- `window.Sections.tasks.enter` calls `loadTasks()`.
- `loadTasks()`:
  - Calls `apiClient.get("/tasks")`.
  - Sets counts: `State.setCounts({tasks: tasks.length})`.
  - Renders each task with title, priority badge, and “Mark as Completed” button if not completed.
- `markTaskCompleted(taskId)`:
  - POST `/tasks/<id>/complete`
  - Reloads tasks.
  - If `window.loadCalendar` exists, calls it.
  - Refreshes counts with `State.refreshCounts({tasks:true, approvals:false, emails:false})`.

### 3.6 Legacy/buggy “email_actions” endpoints (registered at `/api`)
In `backend/api/email_actions.py` (blueprint mounted at `/api`).

Endpoints:
- POST `/api/emails/<email_id>/approve`
- POST `/api/emails/<email_id>/reject`

These endpoints:
- Do **not** check session auth at all.
- Attempt to create a `Task` with fields that do not match the active `Task` model/migrations:
  - Uses `due_date=` (does not exist on `Task` model).
- Calls `create_calendar_event(None, email)` with parameters that do not match the calendar service signature (expects user + task).

**Conclusion**: these endpoints are present and registered, but appear incompatible with the current models/services. Treat as **legacy/unsafe**.

---

## 4) Calendar Integration (Google Calendar + Dedicated App Calendar)

There are **two distinct calendar implementations**:
1) A *task-sync* service in `backend/services/calendar_service.py` (used by tasks and approvals).
2) A *calendar CRUD/listing API* in `backend/api/calendar.py` (used by the Calendar UI).

### 4.1 OAuth + dedicated app calendar provisioning on login
In `backend/api/auth.py`:
- OAuth scopes requested:
  - `openid`, `email`, `profile`
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/calendar`
- `GET /api/auth/url` and `GET /api/auth/google/url` both return `{url: <oauth_url>}`.
- `GET /api/auth/google/callback`:
  - Exchanges code for tokens via `https://oauth2.googleapis.com/token`.
  - Uses Google userinfo endpoint `https://www.googleapis.com/oauth2/v2/userinfo`.
  - Creates/updates local `User` by email.
  - Stores refresh token in both:
    - `user.gmail_token`
    - `user.calendar_token`
    - (only if refresh_token is present; does not overwrite with None)
  - Sets `session["user_id"]` and `session.permanent=True`.
  - Calls `_ensure_app_calendar(...)` to ensure a dedicated calendar named `"Executive Secretary AI"` exists and stores its id in `user.app_calendar_id`.
  - Redirects to `http://localhost:8000/index.html?google_auth=success`.

### 4.2 Calendar CRUD/list API
In `backend/api/calendar.py` (mounted at `/api/calendar`).

#### GET `/api/calendar/events`
- Auth: session-based via `_get_authed_user()`.
- **Always returns a JSON list and HTTP 200**, even on many failure modes.
- Failure modes that return `[]` with 200:
  - not logged in
  - user missing `calendar_token`
  - token refresh failure
  - calendar provisioning failure
  - exceptions
- Adds `Cache-Control: no-store` header.
- Uses dedicated app calendar (ensures it exists).
- Lists all events:
  - Attempts `events().list(... orderBy='startTime' ...)`.
  - If Google requires `timeMin` (orderBy=startTime), it retries with `timeMin="1970-01-01T00:00:00Z"`.
  - Paginates until no `nextPageToken`.
- Maps each event into:
  - `{id, title, start, end, html_link}`
  - start/end are either `dateTime` or `date`.

#### POST `/api/calendar/events`
- Auth: requires session.
- Requires payload fields: `title`, `start`, `end`.
- If not connected (cannot create service): returns `{error:"not_connected"}`, HTTP 200.
- Optional attendees normalization:
  - supports `attendees` or `client_emails`.
  - accepts list of strings or list of `{email: ...}`.
- Optional idempotency:
  - `idempotency_key` or `ical_uid`.
  - Converts to iCalUID (adds `@executive-secretary-ai` if not email-like).
  - Uses Calendar list with `iCalUID=` to dedupe.
- Writes events with `sendUpdates="all"`.

#### PUT `/api/calendar/events/<event_id>`
- Auth: requires session.
- If not connected: `{error:"not_connected"}`, HTTP 200.
- Loads existing event via `events().get` then patches fields present in payload.
- Supports updating attendees.
- Uses `sendUpdates="all"`.

#### DELETE `/api/calendar/events/<event_id>`
- Auth: requires session.
- If not connected: `{error:"not_connected"}`, HTTP 200.
- Attempts delete; on exception returns `{error:"delete_failed"}`, HTTP 200.
- On success: `{deleted:true,id:<event_id>}`, HTTP 200.

### 4.3 Task calendar sync service
In `backend/services/calendar_service.py`:

`create_calendar_event(user, task)`:
- Preconditions:
  - Requires `user.calendar_token` else prints and returns None.
  - Requires `not task.calendar_event_id` else prints and returns None.
- Event time:
  - `start_time = task.suggested_deadline or utcnow()+10min`
  - `end_time = start_time + 30min`
- Uses refresh token to refresh credentials.
- Calendar ID:
  - `user.app_calendar_id` if present else `"primary"`.
- Event body:
  - summary = `task.title`
  - description = `task.description or ""`
  - start/end timezone hard-coded `"Asia/Kolkata"`.
  - reminders: popup 30 minutes.
- Inserts with `sendUpdates="all"`.
- Stores `task.calendar_event_id = created["id"]` and commits.

`delete_calendar_event(user, task)`:
- Preconditions: requires `user.calendar_token` and `task.calendar_event_id`.
- Refreshes creds and deletes event via Google API.
- Sets `task.calendar_event_id = None` (does not commit itself; caller commits).

### 4.4 Calendar UI
In `frontend/js/calendar.js`:
- On section enter:
  - Binds `#syncCalendarBtn` to `loadCalendar()` once.
  - Calls `loadCalendar()`.

`loadCalendar()`:
- Shows loading spinners in both list view and month grid.
- Calls `apiClient.get('/calendar/events')`.
- Always renders month view (even if 0 events).
- If 0 events: renders empty state “No upcoming events”.
- Otherwise groups events into:
  - Today / Upcoming / Past based on `new Date(ev.start)`.
- Renders event cards with optional “Open event” link using `html_link`.

Month grid:
- Uses FullCalendar (CDN `fullcalendar@5.11.5`).
- Renders `dayGridMonth` view.
- `eventClick` opens `html_link` in a new tab.

---

## 5) Rescheduling, Conflict Resolution, Availability, and Smart Scheduling

### 5.1 Automatic rescheduling / conflict detection
**NOT IMPLEMENTED** in the active backend and frontend.
- No `freebusy` calls to Google Calendar.
- No overlap checks.
- No automatic re-slotting of tasks.
- No “find next available time” logic.

### 5.2 What *is* implemented related to timing
- AI may produce a `deadline` value (stored as `Email.ai_deadline`).
- On approval → task uses `suggested_deadline` derived from approval payload.
- Calendar task-sync uses `task.suggested_deadline` or `utcnow()+10min` as start.
- Event duration is fixed at 30 minutes in `calendar_service.py`.

---

## 6) Notifications & Reminders

### 6.1 Backend notification system
- `backend/models/notification.py` defines a `notifications` table model with fields:
  - `user_id`, `task_id`, `notification_type`, `title`, `message`, `scheduled_at`, `sent_at`, `status`, `delivery_method`, `created_at`.
- `backend/services/notification_service.py` exists but is **empty**.
- There are **no API endpoints** for notifications.
- There is **no migration** creating the `notifications` table in the repo migrations list.

**Conclusion**: notifications are **NOT IMPLEMENTED** beyond the model class.

### 6.2 Frontend notifications UI
- `frontend/index.html` includes a notification bell button (`#notificationBtn`) and badge (`#notificationBadge`).
- There is **no JavaScript implementation** that updates the badge or opens a notification panel.

**Conclusion**: in-app notification UI is **NOT IMPLEMENTED** beyond the static elements.

### 6.3 What reminders *are* implemented
- Google Calendar events created by `backend/services/calendar_service.py` include:
  - reminders override: popup 30 minutes before.

---

## 7) UI/UX Surface Area (Pages, Navigation, States)

### 7.1 Pages
- `frontend/login.html`:
  - Email/password form exists in HTML.
  - Submit handler contains only comment `// existing login logic`.
  - SSO button calls `authManager.login()`.
  - Uses `js/config.js`, `js/utils.js`, `js/api_client.js`, `js/auth.js`.
- `frontend/index.html`:
  - Single-page dashboard with hash-based navigation (`#overview`, `#emails`, `#approvals`, `#tasks`, `#calendar`, `#settings`).
  - Contains approval review modal.
  - Loads all JS modules.
- Redirect-only pages:
  - `frontend/approval.html`, `frontend/tasks.html`, `frontend/settings.html`, etc. redirect to `index.html#<section>`.

### 7.2 Navigation and routing
- `frontend/js/router.js` implements hash router:
  - Sets active nav item.
  - Shows/hides sections by toggling `.active`.
  - Calls `window.Sections[route].enter()` if present.
  - Calls `State.renderCounts()` and `State.refreshCounts()` during initialization.

### 7.3 Global UI utilities
From `frontend/js/utils.js`:
- Toast system (`Toast.success/error/warning/info`), injected container if missing.
- Loading overlay helper (`Loading.show/hide`).
- Modal helper (`Modal.open/close/setupCloseHandlers`).
  - ESC closes modal if open.
- `AppStorage` JSON wrapper around localStorage.
- Debounce helper and basic validators.

### 7.4 Global state: count badges
From `frontend/js/state.js`:
- Maintains counts: `emails`, `approvals`, `tasks`.
- Writes counts into:
  - sidebar badges `#emailCount`, `#approvalCount`, `#taskCount`.
  - overview stats `#statEmails`, `#statApprovals`, `#statTasks`.
- Badge visibility controlled by CSS using `[data-count="0"] { display: none; }`.
- `refreshCounts()` calls:
  - `GET /emails` and uses list length
  - `GET /approvals` and uses `res.approvals.length`
  - `GET /tasks` and uses list length

### 7.5 Loading/error/empty states
- Emails:
  - Loading text “Loading emails…”.
  - Error text “Error loading emails”.
  - Empty state “No emails found”.
- Approvals:
  - Uses `Loading.show/hide()` overlay.
  - Empty state card “All caught up!”.
- Tasks:
  - Loading text “Loading tasks…”.
  - Error text “Error loading tasks”.
  - Empty state “No tasks found”.
- Calendar:
  - Shows spinner loading block.
  - On fetch failure renders retry button.
  - Empty state “No upcoming events”.

### 7.6 Settings section behavior
- Settings section contains static “Connect” and “Enable/Configure” buttons.
- There is **no JavaScript** connecting these buttons to any backend endpoints.

**Conclusion**: Settings integrations/preferences are **NOT IMPLEMENTED** beyond UI placeholders.

### 7.7 Responsiveness (CSS)
- `dashboard.css`:
  - At `max-width: 768px`: sidebar becomes horizontal scroll nav; email actions become stacked; etc.
- `main.css`:
  - Modal stacks into single-column at smaller widths.
- `calendar.css`:
  - Calendar cards become column layout for small screens.

---

## 8) Security, Auth, Validation, and Data Handling

### 8.1 Authentication: session cookies
- Primary auth for most active endpoints (`/api/emails`, `/api/approvals`, `/api/tasks`, `/api/calendar`) is:
  - `session.get("user_id")`.
- OAuth callback in `backend/api/auth.py` sets `session["user_id"]`.
- Frontend uses `fetch(..., credentials: "include")` for API requests.

### 8.2 OAuth
- Uses Google OAuth code flow.
- Stores refresh token in DB in plaintext fields:
  - `users.gmail_token`
  - `users.calendar_token`
- Calendar and Gmail services refresh credentials server-side using the refresh token.

### 8.3 JWT middleware and helpers
- `backend/middlewares/auth_middleware.py` defines a `jwt_required` decorator that:
  - expects `Authorization: Bearer <token>`
  - decodes with `backend/utils/security.decode_jwt`.
- `backend/utils/security.py` requires config keys `JWT_SECRET_KEY` and optionally `JWT_EXP_MINUTES`.
- `backend/config.py` does **not** define `JWT_SECRET_KEY`.

**Conclusion**: JWT path exists but appears incomplete/unconfigured and is not used by the main API routes described above.

### 8.4 Input validation in APIs
- Most endpoints accept minimal or no payload, except:
  - `/api/approvals/<id>/approve` validates `task.title` and parses deadlines carefully.
  - `/api/calendar/events` validates required fields: title/start/end.
  - `/api/calendar/events` normalizes attendees.
- Email processing endpoints do not validate ownership for `POST /api/emails/<id>/process` (it fetches by id without checking session user).

### 8.5 CSRF
- No CSRF tokens are used.
- Session cookies are used with SameSite=Lax.

### 8.6 Frontend API error handling
- `frontend/js/api_client.js` throws `new Error("API error")` for any non-OK response.
- Most UI code:
  - either shows a generic toast (“Failed to load approvals”) or an `alert()`.
  - does not surface server error `detail` fields.

---

## 9) Edge Cases, Known Limitations, and “Exists but Not Wired” Code

### 9.1 Email body extraction limitations
- Active body extraction uses only `text/plain` and ignores `text/html`.
- HTML-only emails may result in empty body, which causes:
  - `AIEmailService.process_email` to raise `ValueError("Email body is empty")`.
  - The API route catches exceptions and uses fallback summary.

### 9.2 AI failures and status model
- Email AI failures are not represented as `processing_status="failed"`.
- The code forces `processing_status="completed"` even on failure.

### 9.3 Legacy or stubbed modules
The following exist but are not functional or not wired into the main system:
- `backend/services/notification_service.py`: empty (**NOT IMPLEMENTED**)
- `backend/services/summary_service.py`: empty (**NOT IMPLEMENTED**)
- `backend/middlewares/rate_limiter.py`: empty (**NOT IMPLEMENTED**)
- `backend/middlewares/error_handler.py`: empty (**NOT IMPLEMENTED**)
- `backend/api/dashboard.py`: empty (**NOT IMPLEMENTED**)
- `backend/agents/scheduler_agent.py`: empty (**NOT IMPLEMENTED**)
- `backend/integrations/gmail_client.py`: empty (**NOT IMPLEMENTED**)
- `backend/integrations/calendar_client.py`: empty (**NOT IMPLEMENTED**)
- `backend/utils/json_parser.py`, `backend/utils/validators.py`, `backend/utils/rate_limiter.py`: empty (**NOT IMPLEMENTED**)
- `backend/services/email_pipeline.py`: references `process_pending_emails` which is commented out/undefined (calling it would raise).
- `backend/api/health.py`: defines an emails blueprint but is **not registered**; contains an older implementation.
- `backend/services/task_service.py`: references `Approval` fields (`original_data`, `modified_data`, `decision_at`, etc.) that do not exist in the current `Approval` model; appears unused.
- `backend/api/email_actions.py`: registered but incompatible with current models/services (see §3.6).

Also present is a separate, more elaborate AI pipeline that is implemented but not used by the active Flask email ingestion endpoints:

**Implemented but not wired: multi-agent Groq pipeline**
- `backend/services/agent_orchestrator.py` defines `AgentOrchestrator` which runs an email through four agents in sequence:
  - Step 1: `EmailReaderAgent` → summary, key points, urgency, category, confidence.
  - Step 2: `TaskExtractorAgent` → list of tasks extracted from the email summary.
  - Step 3: `PrioritizerAgent` → assigns priority, estimated duration, suggested deadline per task index.
  - Step 4: `ReviewerAgent` → quality check of the above and returns `approved`, `quality_score`, `issues_detected`, etc.
- If Step 2 yields zero tasks, the orchestrator skips prioritization + review and returns an “approved: True” result with a message “No actionable tasks found”.
- This orchestrator is invoked by `test_agents.py` only; it is not imported/used by the registered Flask blueprints in `backend/api/__init__.py`.

**Groq wrapper used by the multi-agent pipeline (not used by active email processing routes)**
- `backend/integrations/groq_client.py` defines `GroqClient`:
  - Requires `GROQ_API_KEY` or raises `ValueError`.
  - Initializes Groq SDK with a fallback path for older versions (httpx client) when a `TypeError` mentioning `proxies` occurs.
  - Sets `self.model = "llama-3.3-70b-versatile"`.
  - Implements in-process rate limiting: keeps a sliding 60-second window and caps at `max_requests_per_minute = 25`.
  - Uses `response_format={"type": "json_object"}` for chat completions and parses the model output as JSON.
- This `GroqClient` is used by `AgentOrchestrator` and the agents under `backend/agents/`.
- The active Flask email processing path uses `backend/services/ai_email_service.py`, which calls Groq directly (`from groq import Groq`) and does not use `GroqClient`.

**Agent base behavior (applies only to the multi-agent pipeline)**
- `backend/agents/base_agent.py` (`BaseAgent`):
  - Logs JSON entries with `input_preview` and `output_preview` (first 200 chars) and timestamps.
  - Implements `_sanitize_input()` which replaces a small set of literal substrings (e.g., “ignore previous instructions”, “system:”, “assistant:”) with `[REDACTED]`, and truncates inputs beyond 5000 chars.
  - Includes `_validate_confidence()` which warns when `confidence < 0.7`, but the concrete agents do not call this helper.

**Scheduler prompts vs scheduler agent implementation**
- `backend/agents/prompt_templates.py` includes `SCHEDULER_SYSTEM` and `SCHEDULER_USER` prompt templates.
- `backend/agents/scheduler_agent.py` exists but is empty (**NOT IMPLEMENTED**), and `AgentOrchestrator` does not schedule tasks onto a calendar.

### 9.4 Calendar timezone handling
- Multiple components hard-code `Asia/Kolkata`:
  - OAuth calendar provisioning and Calendar API.
  - Calendar task-sync service.
  - Emails UI formats timestamps to IST.

### 9.5 Frontend placeholders that do nothing
- Notification bell + badge exist but no behavior.
- Settings integration buttons do nothing.
- Approvals “Approve All” button does nothing.
- Login form (email/password) does nothing.

---

## 10) Testing, Reliability, and Operational Behavior

### 10.1 Automated tests
- There are no unit/integration tests under `backend/tests/` (only `__init__.py`).

### 10.2 Test scripts present
- `test_agents.py`:
  - Runs the *multi-agent* orchestrator pipeline (`backend/services/agent_orchestrator.py`) directly.
  - Requires `GROQ_API_KEY` and prints results.
  - This pipeline is **not wired** into the main Flask email ingestion endpoints.
- `test_api.py`:
  - Posts to `http://127.0.0.1:5000/api/process-email`.
  - No such endpoint exists in registered blueprints, so this script does not match the current API surface.

### 10.3 Retry and error handling
- AIEmailService retries LLM responses up to 2 times if JSON parsing/validation fails.
- Gmail fetching has no retry/backoff.
- Calendar task-sync refresh failures return without creating events; errors are printed.
- Calendar list endpoint is intentionally forgiving (returns `[]` with 200 on many failures).

### 10.4 Background jobs / queues
- No Celery/RQ/cron integration is present.
- `frontend/js/app.js` triggers periodic refresh (3 minutes) in the browser only.

---

# Appendix A — API Surface Summary (Registered)

Base URL: `http://localhost:5000/api`

## Auth
- `GET /auth/url` → `{url}`
- `GET /auth/google/url` → `{url}`
- `GET /auth/google/callback?code=...` → redirects to frontend
- `POST /auth/logout` → **NOT IMPLEMENTED** (frontend calls it, but no route exists)

## Emails
- `GET /emails` → `Email[]` (pending decision only)
- `POST /emails/sync` → `{status,new_emails,ai_processed,fallback_used}`
- `POST /emails/<id>/process` → `Email`
- `POST /emails/<id>/approve` → `{success,status}` creates Approval
- `POST /emails/<id>/reject` → `{success,status}`

## Approvals
- `GET /approvals` → `{approvals:[...]}`
- `POST /approvals/<id>/approve` → `{success,task_id}`
- `POST /approvals/<id>/reject` → `{success,status}`

## Tasks
- `GET /tasks` → `Task[]`
- `POST /tasks/<id>/complete` → `{success:true}`
- `GET /tasks/calendar` → simplified event list

## Calendar
- `GET /calendar/events` → `[] | Event[]` (always 200)
- `POST /calendar/events` → `Event | {error:...}`
- `PUT /calendar/events/<event_id>` → `Event | {error:...}`
- `DELETE /calendar/events/<event_id>` → `{deleted:true,id} | {error:...}`

## Legacy registered routes
- `POST /emails/<id>/approve` and `/reject` also exist under the legacy `actions_bp` blueprint (see §3.6) and may behave differently/incorrectly.
