# Application Contents

## Core Purpose

The Executive Secretary Agent is an AI-powered email management system designed to assist busy executives and professionals in automating email triage, task extraction, and calendar management. The application leverages large language models to read incoming emails, extract actionable tasks, prioritize them intelligently, and automatically sync them with Google Calendar. It provides a human-in-the-loop approval workflow where the AI suggests tasks and the user can approve or reject them before they are added to their task list and calendar.

**Primary User Persona**: Executives, managers, and professionals who receive high volumes of emails and need assistance in identifying actionable items, prioritizing work, and managing their schedules.

**Main Automation Goals**:
- Automatically sync and process Gmail emails
- Use AI to summarize emails and extract key information
- Identify actionable tasks from email content
- Prioritize tasks based on urgency and context
- Create calendar events for approved tasks
- Provide a centralized dashboard for email and task management

## Major Modules

### Authentication Module

**Responsibility**: Manages user authentication and OAuth 2.0 integration with Google services for Gmail and Calendar access.

**Key Files**:
- `/backend/api/auth.py` - Authentication endpoints
- `/backend/models/user.py` - User data model with OAuth token storage
- `/frontend/login.html` - Login interface
- `/frontend/js/auth.js` - Client-side authentication logic

**Interactions**:
- Integrates with Google OAuth to obtain refresh tokens
- Stores Gmail and Calendar tokens in the User model
- Creates or updates user records upon successful authentication
- Establishes user sessions for subsequent API requests

**Workflow**:
1. User initiates Google OAuth flow via `/api/auth/google/url`
2. User authorizes the application with Gmail and Calendar permissions
3. Callback handler at `/api/auth/google/callback` exchanges authorization code for tokens
4. User record is created or updated with OAuth refresh tokens
5. User session is established and redirected to dashboard

### Email Ingestion Module

**Responsibility**: Fetches emails from Gmail using the Gmail API and stores them in the local database.

**Key Files**:
- `/backend/services/gmail_service.py` - Gmail API integration
- `/backend/integrations/gmail_client.py` - Gmail client wrapper
- `/backend/models/email.py` - Email data model
- `/backend/api/emails.py` - Email management endpoints

**Interactions**:
- Uses OAuth tokens from User model to authenticate with Gmail API
- Fetches emails from the last sync timestamp (or last 48 hours if first sync)
- Stores email metadata (sender, subject, body, received_at) in the database
- Triggers AI processing pipeline for new emails
- Updates `last_gmail_sync` timestamp on User model

**Workflow**:
1. User loads dashboard or triggers manual sync
2. System retrieves user's Gmail refresh token
3. Gmail API fetches messages based on last sync timestamp
4. Email body is extracted and decoded from base64
5. Each new email is saved to the database with `processing_status = "pending"`
6. Emails are automatically queued for AI processing

### AI Email Processing Module

**Responsibility**: Uses AI agents to analyze emails, extract summaries, categorize urgency, and identify actionable items.

**Key Files**:
- `/backend/services/ai_email_service.py` - Simple AI email processing service
- `/backend/services/agent_orchestrator.py` - Multi-agent orchestration
- `/backend/agents/email_reader_agent.py` - Email summarization agent
- `/backend/agents/task_extractor_agent.py` - Task extraction agent
- `/backend/agents/prioritizer_agent.py` - Task prioritization agent
- `/backend/agents/reviewer_agent.py` - Quality control agent
- `/backend/agents/base_agent.py` - Abstract base class for all agents
- `/backend/integrations/groq_client.py` - Groq API client wrapper
- `/backend/models/ai_log.py` - AI execution logging

**Interactions**:
- Receives raw email content from Email model
- Processes emails through multiple specialized AI agents in sequence
- Stores AI-generated summaries, urgency levels, and categories back to Email model
- Logs all AI interactions for debugging and auditing
- Implements fallback mechanisms for AI failures

**Multi-Agent Pipeline**:
1. **Email Reader Agent**: Summarizes email, extracts key points, determines urgency (low/medium/high) and category (meeting/task/academic/finance/personal/info/spam)
2. **Task Extractor Agent**: Identifies actionable tasks with titles, descriptions, and dependencies
3. **Prioritizer Agent**: Assigns priority levels, estimates duration, suggests deadlines
4. **Reviewer Agent**: Validates all AI outputs for quality and consistency

**Workflow**:
1. New email enters system with `processing_status = "pending"`
2. `AIEmailService.process_email()` is called
3. AI generates structured JSON with summary, urgency, category, actions, and deadline
4. Results are stored in email fields: `ai_summary`, `urgency_level`, `category`, `ai_actions`, `ai_deadline`
5. `processing_status` updated to "completed"
6. If AI fails, fallback uses email body/subject as summary with default values

### Approval Workflow Module

**Responsibility**: Presents AI-suggested tasks to users for approval or rejection before creating tasks and calendar events.

**Key Files**:
- `/backend/api/approvals.py` - Approval workflow endpoints
- `/backend/models/approval.py` - Approval request data model
- `/frontend/approval.html` - Approval interface
- `/frontend/js/approval.js` - Approval UI logic

**Interactions**:
- Email module sends approved emails to approval queue
- Stores original AI-suggested task data as JSON
- Allows user modification of task details before final approval
- Upon approval, creates Task record and triggers Calendar module
- Upon rejection, marks approval as rejected without creating task

**Workflow**:
1. User clicks "Approve" on processed email in dashboard
2. System creates Approval record with `status = "pending"`
3. Original task data stored in `original_task` field (JSON)
4. Approval appears in `/approval.html` page
5. User reviews and can modify task details (title, description, priority, deadline)
6. Modified data stored in `modified_task` field
7. On approval: Task created, calendar event added, approval status = "approved"
8. On rejection: approval status = "rejected", no task created

### Task Management Module

**Responsibility**: Manages the lifecycle of tasks from creation through completion.

**Key Files**:
- `/backend/api/tasks.py` - Task CRUD endpoints
- `/backend/models/task.py` - Task data model
- `/backend/services/task_service.py` - Task business logic
- `/frontend/tasks.html` - Task list interface
- `/frontend/js/tasks.js` - Task UI logic

**Interactions**:
- Receives approved task data from Approval module
- Stores task metadata including priority, status, deadlines
- Links tasks to calendar events via `calendar_event_id`
- Provides endpoints for task completion and status updates
- Auto-syncs tasks with calendar when deadlines exist

**Task Lifecycle**:
1. **Created**: Task created from approved email with `status = "pending_approval"`
2. **Approved**: Status changes to "pending" after user approval
3. **Scheduled**: Calendar event created, `calendar_event_id` populated
4. **In Progress**: User can manually update status
5. **Completed**: Status = "completed", `actual_deadline` set, calendar event deleted

**Fields**:
- `title`: Task name (from AI summary or email subject)
- `description`: Detailed task description (email body)
- `priority`: low/medium/high (from AI or user override)
- `status`: pending_approval/pending/in_progress/completed
- `estimated_duration`: Minutes (from AI)
- `suggested_deadline`: AI-suggested completion date
- `actual_deadline`: When task was completed
- `calendar_event_id`: Google Calendar event ID for sync

### Calendar Integration Module

**Responsibility**: Synchronizes approved tasks with Google Calendar.

**Key Files**:
- `/backend/services/calendar_service.py` - Google Calendar API integration
- `/backend/integrations/calendar_client.py` - Calendar client wrapper
- `/backend/models/calendar_event.py` - Calendar event data model
- `/frontend/calendar.html` - Calendar view interface
- `/frontend/js/calendar.js` - Calendar UI logic

**Interactions**:
- Uses OAuth tokens from User model for Calendar API authentication
- Creates calendar events when tasks are approved
- Deletes calendar events when tasks are completed
- Prevents duplicate event creation by checking `calendar_event_id`
- Stores bidirectional link between Task and Calendar Event

**Workflow**:
1. Task is approved and created
2. `create_calendar_event(user, task)` is called
3. Event created with:
   - `summary`: Task title
   - `description`: Task description
   - `start`: Task suggested_deadline or current time + 10 minutes
   - `end`: Start time + 30 minutes
   - `reminders`: 30-minute popup
4. Google Calendar API returns event ID
5. `task.calendar_event_id` is stored for future reference
6. On task completion, `delete_calendar_event()` removes event from Google Calendar

### Notification Module

**Responsibility**: Manages scheduled notifications and reminders for tasks.

**Key Files**:
- `/backend/models/notification.py` - Notification data model
- `/backend/services/notification_service.py` - Notification scheduling logic

**Interactions**:
- Creates notification records for upcoming task deadlines
- Tracks notification delivery status
- Supports multiple delivery methods (currently email)

**Fields**:
- `notification_type`: Type of notification
- `title`: Notification title
- `message`: Notification content
- `scheduled_at`: When to send notification
- `sent_at`: When notification was actually sent
- `status`: pending/sent/failed
- `delivery_method`: email/push/sms

### Frontend Dashboard

**Responsibility**: Provides a web-based user interface for all application features.

**Key Files**:
- `/frontend/index.html` - Main dashboard
- `/frontend/approval.html` - Approval queue page
- `/frontend/tasks.html` - Task management page
- `/frontend/calendar.html` - Calendar view
- `/frontend/settings.html` - User settings
- `/frontend/css/` - Styling (main.css, dashboard.css, components.css, calendar.css)
- `/frontend/js/` - JavaScript modules (dashboard.js, approval.js, tasks.js, calendar.js, auth.js, api_client.js)

**Sections**:
1. **Overview**: Dashboard with statistics and recent activity
2. **Emails**: List of processed emails with AI summaries and urgency indicators
3. **Approvals**: Pending task approvals requiring user decision
4. **Tasks**: All tasks with status, priority, and completion tracking
5. **Calendar**: Visual calendar view of scheduled tasks
6. **Settings**: User preferences and account management

**User Actions**:
- View email summaries and AI-extracted information
- Approve/reject AI-suggested tasks
- Modify task details before approval
- Mark tasks as complete
- View tasks in calendar format
- Manually trigger Gmail sync

## Services Layer

### Gmail Service (`gmail_service.py`)

**Purpose**: Fetches emails from Gmail API and stores them in the database.

**Inputs**:
- User object with `gmail_token` (OAuth refresh token)
- Optional: last sync timestamp

**Outputs**:
- List of newly created Email objects
- Updated `last_gmail_sync` timestamp on User model

**External APIs**: 
- Google Gmail API v1 (`gmail.users.messages.list`, `gmail.users.messages.get`)

**Key Functions**:
- `fetch_gmail_emails(user)`: Main entry point for email synchronization
- `extract_body(payload)`: Decodes base64-encoded email body from MIME parts
- `decode(data)`: Base64 URL-safe decoding with padding correction

### AI Email Service (`ai_email_service.py`)

**Purpose**: Simple single-pass AI processing of emails using Groq LLM.

**Inputs**:
- Email object with subject and body

**Outputs**:
- Updates email object with: `ai_summary`, `urgency_level`, `category`, `ai_actions`, `ai_deadline`

**External APIs**:
- Groq API (LLM inference using `llama-3.1-8b-instant`)

**Processing**:
1. Builds structured prompt requesting JSON output
2. Calls Groq LLM with low temperature (0.2) for consistency
3. Parses and validates JSON response
4. Retries up to 2 times on failure
5. Updates email fields with extracted data

### Agent Orchestrator Service (`agent_orchestrator.py`)

**Purpose**: Coordinates multiple specialized AI agents in a sequential pipeline for comprehensive email processing.

**Inputs**:
- Email data dictionary with sender, subject, body

**Outputs**:
- Comprehensive analysis including:
  - Email summary with key points
  - Extracted tasks with details
  - Prioritized tasks with deadlines
  - Quality review results
  - Processing time metrics

**External APIs**:
- Groq API (via GroqClient)

**Pipeline Sequence**:
1. Email Reader Agent → email summary, urgency, category
2. Task Extractor Agent → actionable tasks with dependencies
3. Prioritizer Agent → priority levels and suggested deadlines
4. Reviewer Agent → quality validation and approval recommendation

### Calendar Service (`calendar_service.py`)

**Purpose**: Creates and manages calendar events in Google Calendar.

**Inputs**:
- User object with `calendar_token`
- Task object with title, description, suggested_deadline

**Outputs**:
- Google Calendar event HTML link
- Updates task.calendar_event_id

**External APIs**:
- Google Calendar API v3 (`calendar.events.insert`, `calendar.events.delete`)

**Key Functions**:
- `create_calendar_event(user, task)`: Creates event with 30-minute duration and reminder
- `delete_calendar_event(user, task)`: Removes event when task completed

### Task Service (`task_service.py`)

**Purpose**: Business logic for task operations.

**Inputs**:
- Task data from approvals or direct creation

**Outputs**:
- Created/updated Task records
- Task status updates

**Operations**:
- Task creation from approved emails
- Status transitions (pending → in_progress → completed)
- Task modification and deletion
- Calendar synchronization coordination

### Auth Service (`auth_service.py`)

**Purpose**: Handles authentication, session management, and OAuth token management.

**Inputs**:
- Google OAuth authorization codes
- User credentials

**Outputs**:
- User sessions
- OAuth tokens stored in database

**External APIs**:
- Google OAuth 2.0 Token Endpoint
- Google UserInfo API

**Operations**:
- Generate OAuth authorization URLs
- Exchange authorization codes for tokens
- Store refresh tokens for Gmail and Calendar access
- Create/update user records
- Manage session state

## Data Models

### User Model

**Fields**:
- `id`: Primary key
- `email`: Unique user email (from Google OAuth)
- `password_hash`: Bcrypt hash (or "GOOGLE_OAUTH" for OAuth users)
- `full_name`: User's full name
- `role`: User role (default: "executive")
- `gmail_token`: OAuth refresh token for Gmail API
- `calendar_token`: OAuth refresh token for Calendar API
- `preferences`: JSON text field for user settings
- `is_active`: Account status flag
- `created_at`: Account creation timestamp
- `last_login`: Last login timestamp
- `last_gmail_sync`: Last Gmail synchronization timestamp

**Relationships**:
- One-to-many with Email (user owns multiple emails)
- One-to-many with Task (user owns multiple tasks)
- One-to-many with Notification (user receives notifications)

**Lifecycle**:
1. Created upon first OAuth login or manual registration
2. Tokens updated on each OAuth flow
3. `last_login` updated on each authentication
4. `last_gmail_sync` updated after each email sync

### Email Model

**Fields**:
- `id`: Primary key
- `user_id`: Foreign key to User
- `gmail_message_id`: Unique Gmail message ID
- `sender`: Email sender address
- `subject`: Email subject line
- `body`: Full email body text
- `received_at`: When email was received
- `processed_at`: When AI processing completed
- `processing_status`: pending/processing/completed/failed
- `ai_summary`: AI-generated summary
- `urgency_level`: low/medium/high
- `category`: meeting/task/academic/finance/personal/info/spam
- `ai_actions`: JSON array of suggested actions
- `ai_deadline`: AI-detected deadline
- `decision_status`: pending/approved/rejected
- `decision_at`: When user made decision

**Relationships**:
- Many-to-one with User
- One-to-one with Approval (when sent for approval)

**Lifecycle**:
1. **Created**: Email fetched from Gmail (`processing_status = "pending"`)
2. **Processing**: AI analysis begins (`processing_status = "processing"`)
3. **Processed**: AI fields populated (`processing_status = "completed"`, `processed_at` set)
4. **Decision Pending**: User views email (`decision_status = "pending"`)
5. **Approved**: Sent to approval queue, creates Approval record
6. **Rejected**: Email deleted from system

### Task Model

**Fields**:
- `id`: Primary key
- `email_id`: Foreign key to source Email (nullable)
- `user_id`: Foreign key to User
- `title`: Task title
- `description`: Detailed task description
- `priority`: low/medium/high
- `status`: pending_approval/pending/in_progress/completed
- `estimated_duration`: Minutes to complete
- `suggested_deadline`: AI-suggested deadline
- `actual_deadline`: When task was actually completed
- `calendar_event_id`: Google Calendar event ID
- `created_by_agent`: Boolean flag (AI vs manual creation)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

**Relationships**:
- Many-to-one with User
- Many-to-one with Email (optional, if from email)
- One-to-one with CalendarEvent (via calendar_event_id)

**Lifecycle**:
1. **Created from Approval**: Status = "pending_approval"
2. **Approved**: Status → "pending", calendar event created
3. **In Progress**: User starts work (status manually updated)
4. **Completed**: Status → "completed", `actual_deadline` set, calendar event deleted

### Approval Model

**Fields**:
- `id`: Primary key
- `user_id`: User who must approve
- `email_id`: Foreign key to Email
- `task_id`: Foreign key to created Task (set after approval)
- `status`: pending/approved/rejected
- `original_task`: JSON of AI-suggested task
- `modified_task`: JSON of user-modified task
- `confidence`: AI confidence score (0.0-1.0)
- `reasoning`: AI reasoning for task suggestion
- `created_at`: When approval request created
- `decided_at`: When user made decision

**Relationships**:
- Many-to-one with User
- Many-to-one with Email
- One-to-one with Task (after approval)

**Lifecycle**:
1. **Created**: User clicks "Approve" on email (`status = "pending"`)
2. **User Reviews**: Displays in approval queue with original task data
3. **User Modifies**: Changes saved to `modified_task`
4. **Approved**: Task created, `task_id` set, `status = "approved"`, `decided_at` set
5. **Rejected**: `status = "rejected"`, `decided_at` set, no task created

### AILog Model

**Fields**:
- `id`: Primary key
- `user_id`: Associated user (nullable)
- `agent_name`: Which agent executed (email_reader/task_extractor/prioritizer/reviewer)
- `input_data`: JSON of input parameters
- `output_data`: JSON of agent output
- `prompt_used`: Full prompt sent to LLM
- `model_used`: LLM model name (default: llama-3.3-70b-versatile)
- `tokens_used`: Total tokens consumed
- `latency_ms`: Request latency in milliseconds
- `confidence_score`: Agent confidence in output
- `success`: Boolean execution status
- `error_message`: Error details if failed
- `created_at`: Execution timestamp

**Purpose**:
- Debugging AI agent behavior
- Performance monitoring
- Cost tracking (token usage)
- Quality assurance
- Audit trail for AI decisions

### Notification Model

**Fields**:
- `id`: Primary key
- `user_id`: User to notify
- `task_id`: Related task (nullable)
- `notification_type`: Type of notification
- `title`: Notification title
- `message`: Notification body
- `scheduled_at`: When to send
- `sent_at`: Actual send time
- `status`: pending/sent/failed
- `delivery_method`: email/push/sms
- `created_at`: Creation timestamp

**Purpose**:
- Remind users of upcoming task deadlines
- Notify of important email arrivals
- Alert for overdue tasks

### CalendarEvent Model

**Fields**:
- `id`: Primary key
- `task_id`: Associated task
- `user_id`: Event owner
- `google_event_id`: Google Calendar event ID
- `title`: Event title
- `description`: Event description
- `start_time`: Event start
- `end_time`: Event end
- `location`: Event location (nullable)
- `attendees`: JSON array of attendees
- `reminder_minutes`: Reminder time before event
- `created_by_agent`: AI-created flag
- `sync_status`: pending/synced/failed
- `created_at`: Creation timestamp

**Relationships**:
- Many-to-one with User
- One-to-one with Task (via task_id)

**Purpose**:
- Track Google Calendar synchronization
- Maintain local copy of event data
- Support offline viewing

## User Actions & System Reactions

### User Logs In

**User Action**: Clicks "Login with Google" button

**System Reaction**:
1. Frontend requests OAuth URL from `/api/auth/google/url`
2. Backend generates Google OAuth consent URL with Gmail and Calendar scopes
3. User redirected to Google login page
4. User authorizes application
5. Google redirects back to `/api/auth/google/callback` with authorization code
6. Backend exchanges code for access and refresh tokens
7. Backend fetches user info from Google UserInfo API
8. User record created/updated in database with:
   - Email, full name
   - Gmail refresh token
   - Calendar refresh token
   - `last_login` timestamp
9. Session established with `user_id`
10. User redirected to dashboard (`index.html`)

### Emails Are Synced

**User Action**: Dashboard loads OR user clicks "Sync Emails" button

**System Reaction**:
1. Frontend calls `/api/emails` (GET) or `/api/emails/sync` (POST)
2. Backend retrieves user's Gmail refresh token
3. Gmail API client created with OAuth credentials
4. Query emails since `last_gmail_sync` (or last 48 hours if first sync)
5. For each email from Gmail API:
   - Check if `gmail_message_id` already exists in database (skip if duplicate)
   - Fetch full message details
   - Extract sender, subject, body (decode base64 MIME parts)
   - Create Email record with `processing_status = "pending"`
6. `user.last_gmail_sync` updated to current time
7. All new emails committed to database
8. Frontend receives list of emails and displays them

### AI Processes an Email

**User Action**: Email sync completes OR user clicks "Process" on a single email

**System Reaction**:
1. Email with `processing_status = "pending"` selected
2. System calls `AIEmailService.process_email(email)`
3. Email subject and body extracted
4. Prompt constructed requesting structured JSON output with fields:
   - `summary`: Brief email summary
   - `urgency`: low/medium/high
   - `category`: meeting/task/academic/finance/personal/info/spam
   - `actions`: Array of suggested actions
   - `deadline`: Detected deadline (ISO format or null)
5. Groq API called with `llama-3.1-8b-instant` model
6. Response parsed and validated
7. If valid JSON:
   - `email.ai_summary` = summary
   - `email.urgency_level` = urgency
   - `email.category` = category
   - `email.ai_actions` = JSON.stringify(actions)
   - `email.ai_deadline` = parsed datetime or null
   - `email.processing_status` = "completed"
   - `email.processed_at` = current timestamp
8. If AI fails or returns invalid JSON:
   - Fallback to safe defaults:
   - `email.ai_summary` = email body (first 200 chars) or subject
   - `email.urgency_level` = "low"
   - `email.category` = "info"
   - `email.processing_status` = "completed"
9. Changes committed to database
10. Frontend updates email display with AI analysis

### Approve Is Clicked

**User Action**: User clicks "Approve" button on processed email in dashboard

**System Reaction**:
1. Frontend sends POST request to `/api/emails/{email_id}/approve`
2. Backend validates user session
3. System checks email not already approved
4. Approval record created:
   - `user_id` = current user
   - `email_id` = email being approved
   - `status` = "pending"
   - `confidence` = 0.75 (default)
   - `reasoning` = "AI detected a task-worthy email."
   - `original_task` = JSON with:
     - `title`: AI summary or email subject
     - `description`: Email body
     - `priority`: Urgency level (low/medium/high)
     - `deadline`: AI-detected deadline (ISO string or null)
5. `email.decision_status` = "pending"
6. Approval committed to database
7. Frontend shows "Sent to approvals" confirmation
8. Approval appears in `/approval.html` page for final user review
9. User can now:
   - Modify task details (title, description, priority, deadline)
   - Approve (creates task + calendar event)
   - Reject (discards approval)

### User Approves Task in Approval Queue

**User Action**: User reviews approval, optionally modifies task details, clicks "Approve"

**System Reaction**:
1. Frontend sends POST to `/api/approvals/{approval_id}/approve` with task data
2. Backend validates user and approval ownership
3. Task created with fields:
   - `user_id` = current user
   - `title` = from task data (user-modified or original)
   - `description` = from task data
   - `priority` = from task data (low/medium/high)
   - `suggested_deadline` = from task data (parsed datetime)
   - `status` = "pending"
   - `email_id` = original email ID
4. Task saved to database with flush (to get ID)
5. Calendar event creation triggered:
   - User's calendar token retrieved
   - Google Calendar API client created
   - Event created with:
     - `summary` = task title
     - `description` = task description
     - `start` = suggested_deadline or (now + 10 min)
     - `end` = start + 30 minutes
     - `reminders` = 30-minute popup
   - Google returns event ID
   - `task.calendar_event_id` = Google event ID
6. Approval updated:
   - `status` = "approved"
   - `task_id` = newly created task ID
   - `modified_task` = JSON of final task data
   - `decided_at` = current timestamp
7. All changes committed to database
8. Frontend shows success message
9. Task appears in Tasks section
10. Event appears in user's Google Calendar

### Reject Is Clicked

**User Action**: User clicks "Reject" on email OR "Reject" on approval

**For Email Rejection** (`/api/emails/{email_id}/reject`):
1. Email record deleted from database
2. No task created
3. No approval record created
4. Frontend removes email from display

**For Approval Rejection** (`/api/approvals/{approval_id}/reject`):
1. Approval status changed to "rejected"
2. `decided_at` timestamp set
3. No task created
4. No calendar event created
5. Approval removed from pending queue
6. Original email remains in system (not deleted)

### User Marks Task as Complete

**User Action**: User clicks "Complete" button on task

**System Reaction**:
1. Frontend sends POST to `/api/tasks/{task_id}/complete`
2. Backend validates task ownership
3. Task updated:
   - `status` = "completed"
   - `actual_deadline` = current timestamp
4. If task has `calendar_event_id`:
   - User's calendar token retrieved
   - Google Calendar API client created
   - Event deleted via `calendar.events.delete()`
   - `task.calendar_event_id` = null
5. Changes committed to database
6. Frontend updates task display to show completed status
7. Event removed from Google Calendar

---

# Tools & Technologies Used

## Backend Framework

### Flask 3.0.0
**Purpose**: Core web framework for building the REST API and serving the backend application.

**Usage**:
- Application factory pattern in `/backend/app.py`
- Blueprint-based route organization in `/backend/api/`
- Request/response handling
- Session management
- CORS support via Flask-CORS

**Where it appears**:
- `requirements.txt` line 4
- `/backend/app.py` - Application creation and configuration
- All files in `/backend/api/` - API endpoint definitions

### Werkzeug 3.0.1
**Purpose**: WSGI utility library that provides Flask's underlying request/response handling.

**Usage**:
- HTTP utilities
- Security helpers
- Development server

**Where it appears**:
- `requirements.txt` line 5
- Implicitly used by Flask throughout the application

### python-dotenv 1.0.1
**Purpose**: Loads environment variables from `.env` files for configuration management.

**Usage**:
- Loads `GROQ_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Environment-based configuration

**Where it appears**:
- `requirements.txt` line 6
- `/backend/app.py` line 4 - `load_dotenv()`
- `/backend/config.py` - Environment variable access

## Database

### SQLAlchemy 2.0.25
**Purpose**: SQL toolkit and Object-Relational Mapping (ORM) library for database interactions.

**Usage**:
- Defines database models as Python classes
- Query building and execution
- Relationship management between models
- Database session management

**Where it appears**:
- `requirements.txt` line 14
- `/backend/database/db.py` - Database instance
- All files in `/backend/models/` - Data model definitions
- All service and API files for database queries

### Flask-SQLAlchemy 3.1.1
**Purpose**: Flask extension that integrates SQLAlchemy with Flask applications.

**Usage**:
- Simplifies SQLAlchemy configuration
- Provides Flask-aware database session handling
- Automatic cleanup of database connections

**Where it appears**:
- `requirements.txt` line 12
- `/backend/extensions.py` - Database initialization
- `/backend/app.py` - Database setup with app context

### Flask-Migrate 4.0.5
**Purpose**: Database migration tool using Alembic, manages database schema changes over time.

**Usage**:
- Version control for database schema
- Automated migration script generation
- Database upgrade/downgrade capabilities

**Where it appears**:
- `requirements.txt` line 13
- `/backend/extensions.py` - Migration initialization
- `/migrations/` directory - Migration scripts

### SQLite
**Purpose**: Lightweight embedded database engine used for development and storage.

**Usage**:
- Default database backend
- Stores all application data (users, emails, tasks, approvals, etc.)
- Database file located at `instance/dev.db`

**Where it appears**:
- `/backend/config.py` line 15-17 - SQLite URI configuration
- `instance/dev.db` - Physical database file (created at runtime)

## Authentication & Security

### Flask-JWT-Extended 4.6.0
**Purpose**: JWT (JSON Web Token) support for Flask applications.

**Usage**:
- Token-based authentication
- Protected route decorators
- Token refresh mechanisms

**Where it appears**:
- `requirements.txt` line 19

### bcrypt 4.1.2
**Purpose**: Password hashing library using the bcrypt algorithm.

**Usage**:
- Hash user passwords before storage
- Verify passwords during login
- Salt generation

**Where it appears**:
- `requirements.txt` line 20
- `/backend/models/user.py` lines 36-46 - Password hashing methods

### passlib[bcrypt] 1.7.4
**Purpose**: Comprehensive password hashing framework supporting multiple algorithms.

**Usage**:
- Additional password hashing utilities
- Migration between hash algorithms

**Where it appears**:
- `requirements.txt` line 21

### PyJWT 2.8.0
**Purpose**: JSON Web Token implementation for Python.

**Usage**:
- JWT encoding and decoding
- Token validation

**Where it appears**:
- `requirements.txt` line 22

## Google APIs & OAuth

### google-auth 2.27.0
**Purpose**: Google authentication library for Python, provides OAuth 2.0 client functionality.

**Usage**:
- OAuth 2.0 credential management
- Token refresh mechanisms
- Authentication with Google services

**Where it appears**:
- `requirements.txt` line 27
- `/backend/services/gmail_service.py` lines 1-2, 52-53 - Credentials import
- `/backend/services/calendar_service.py` lines 1-2 - Credentials import

### google-auth-oauthlib 1.2.0
**Purpose**: OAuth 2.0 integration for google-auth library.

**Usage**:
- OAuth flow implementation
- Authorization code exchange
- Token management

**Where it appears**:
- `requirements.txt` line 28
- Used in OAuth flow in `/backend/api/auth.py`

### google-auth-httplib2 0.2.0
**Purpose**: httplib2 transport for google-auth, provides HTTP client for Google APIs.

**Usage**:
- HTTP transport layer for API calls
- Request/response handling

**Where it appears**:
- `requirements.txt` line 29

### google-api-python-client 2.111.0
**Purpose**: Official Google API client library for Python.

**Usage**:
- Gmail API client - fetch and read emails
- Google Calendar API client - create, update, delete events
- API discovery and resource building

**Where it appears**:
- `requirements.txt` line 30
- `/backend/services/gmail_service.py` line 14 - `from googleapiclient.discovery import build`
- `/backend/services/calendar_service.py` line 2 - `from googleapiclient.discovery import build`
- `/backend/integrations/gmail_client.py` - Gmail API wrapper
- `/backend/integrations/calendar_client.py` - Calendar API wrapper

## AI / LLM Integration

### Groq 0.4.1
**Purpose**: Python SDK for Groq's LLM API, provides access to fast inference for large language models.

**Usage**:
- Interface to Groq's hosted LLM service
- Chat completion API calls
- Structured JSON output generation
- Uses `llama-3.3-70b-versatile` and `llama-3.1-8b-instant` models

**Where it appears**:
- `requirements.txt` line 35
- `/backend/integrations/groq_client.py` - Complete Groq API wrapper
- `/backend/services/ai_email_service.py` line 4 - `from groq import Groq`
- `/backend/services/agent_orchestrator.py` - Multi-agent coordination
- All files in `/backend/agents/` - AI agent implementations

**Models Used**:
- `llama-3.3-70b-versatile` - Primary model for reasoning and complex tasks (in agent orchestrator)
- `llama-3.1-8b-instant` - Faster model for simple email processing

## HTTP & Utilities

### requests 2.31.0
**Purpose**: HTTP library for making API requests.

**Usage**:
- OAuth token exchange with Google
- API calls to external services
- HTTP request/response handling

**Where it appears**:
- `requirements.txt` line 40
- `/backend/api/auth.py` lines 6, 48, 60 - Google OAuth API calls

### jsonschema 4.20.0
**Purpose**: JSON schema validation library.

**Usage**:
- Validate JSON data structures
- Ensure API responses match expected schemas
- Data validation for AI outputs

**Where it appears**:
- `requirements.txt` line 41
- Used for validating structured JSON from AI agents

## Frontend Technologies

### HTML5
**Purpose**: Markup language for structuring web pages.

**Usage**:
- Page structure and layout
- Semantic markup
- Form elements

**Where it appears**:
- `/frontend/index.html` - Main dashboard
- `/frontend/approval.html` - Approval queue interface
- `/frontend/tasks.html` - Task management page
- `/frontend/calendar.html` - Calendar view
- `/frontend/login.html` - Login page
- `/frontend/settings.html` - Settings page

### CSS3
**Purpose**: Styling language for visual presentation.

**Usage**:
- Component styling
- Responsive layouts
- Animations and transitions
- Custom design system

**Where it appears**:
- `/frontend/css/main.css` - Base styles and variables
- `/frontend/css/dashboard.css` - Dashboard-specific styles
- `/frontend/css/components.css` - Reusable component styles
- `/frontend/css/calendar.css` - Calendar view styles

### JavaScript (ES6+)
**Purpose**: Client-side scripting for interactive functionality.

**Usage**:
- DOM manipulation
- Event handling
- API communication
- State management
- Dynamic UI updates

**Where it appears**:
- `/frontend/js/dashboard.js` - Dashboard logic
- `/frontend/js/approval.js` - Approval queue functionality
- `/frontend/js/tasks.js` - Task management
- `/frontend/js/calendar.js` - Calendar rendering
- `/frontend/js/auth.js` - Authentication flows
- `/frontend/js/api_client.js` - HTTP client wrapper
- `/frontend/js/config.js` - Configuration constants
- `/frontend/js/storage.js` - Local storage utilities
- `/frontend/js/utils.js` - Utility functions
- `/frontend/js/app.js` - Main application initialization

### Google Fonts (Inter)
**Purpose**: Typography system for consistent text rendering.

**Usage**:
- Inter font family (weights 400, 500, 600, 700)
- Provides modern, readable interface typography

**Where it appears**:
- `/frontend/index.html` lines 7-9 - Font preconnect and import
- Referenced in CSS files for font-family declarations

## Development Tools

### Flask-CORS 4.0.0
**Purpose**: Cross-Origin Resource Sharing (CORS) support for Flask.

**Usage**:
- Enable API access from frontend (localhost:8000)
- Configure allowed origins
- Handle preflight requests

**Where it appears**:
- `requirements.txt` line 7
- `/backend/extensions.py` - CORS initialization
- `/backend/app.py` lines 37-42 - CORS configuration with credentials

## Additional Libraries

### BeautifulSoup4 (implied by imports)
**Purpose**: HTML and XML parsing library.

**Usage**:
- Extract plain text from HTML email bodies
- Parse MIME multipart email content

**Where it appears**:
- `/backend/services/gmail_service.py` line 8 - `from bs4 import BeautifulSoup`
- Used to convert HTML emails to plain text for AI processing

### base64 (Python standard library)
**Purpose**: Base64 encoding/decoding.

**Usage**:
- Decode Gmail API base64-encoded email bodies
- Handle URL-safe base64 encoding

**Where it appears**:
- `/backend/services/gmail_service.py` lines 7, 10, 50, 118-120
- Email body extraction and decoding

### json (Python standard library)
**Purpose**: JSON encoding and decoding.

**Usage**:
- Parse AI responses
- Serialize task data for approvals
- Store structured data in text fields

**Where it appears**:
- Throughout backend for API responses and data serialization
- `/backend/services/ai_email_service.py` - JSON response parsing
- `/backend/api/approvals.py` - Task data serialization

### logging (Python standard library)
**Purpose**: Application logging and debugging.

**Usage**:
- Log AI agent execution
- Track errors and exceptions
- Monitor API requests

**Where it appears**:
- `/backend/logger.py` - Logger configuration
- `/backend/utils/logger.py` - Logging utilities
- All service and agent files - Debug and error logging

### datetime (Python standard library)
**Purpose**: Date and time handling.

**Usage**:
- Timestamp management
- Deadline calculations
- Email received dates
- Task scheduling

**Where it appears**:
- Throughout application for temporal data handling
- `/backend/models/` - Timestamp fields in all models
- `/backend/services/calendar_service.py` - Event time calculations

## Configuration & Environment

### Environment Variables
**Purpose**: Store sensitive configuration and API keys outside of code.

**Configuration Variables**:
- `GROQ_API_KEY` - Groq API authentication key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `SECRET_KEY` - Flask session secret (set to "dev-secret-key" in config)

**Where they appear**:
- `.env` file (not in repository, user-created)
- `/backend/config.py` - Configuration class
- `/backend/app.py` - Environment validation
- Various service files - API key access

### Session Management
**Purpose**: Maintain user state across requests.

**Implementation**:
- Filesystem-based sessions
- 24-hour session lifetime
- Stores `user_id` for authentication

**Where it appears**:
- `/backend/config.py` lines 21-22 - Session configuration
- `/backend/api/auth.py` - Session establishment
- All protected API endpoints - Session validation

## Database Migrations

### Alembic (via Flask-Migrate)
**Purpose**: Database schema version control and migration management.

**Usage**:
- Generate migration scripts from model changes
- Apply incremental database updates
- Rollback capabilities

**Where it appears**:
- `/migrations/` directory - Migration scripts and configuration
- `/migrations/env.py` - Migration environment setup
- `/migrations/versions/` - Individual migration files

## API Architecture

### RESTful API
**Purpose**: Standard HTTP-based API design for client-server communication.

**Endpoints by Blueprint**:
- `/api/auth/*` - Authentication (login, callback)
- `/api/emails/*` - Email management (list, sync, approve, reject)
- `/api/approvals/*` - Approval workflow (list, approve, reject)
- `/api/tasks/*` - Task management (list, complete, calendar view)

**Where it appears**:
- `/backend/api/__init__.py` - Blueprint registration
- All files in `/backend/api/` - Endpoint implementations
- `/frontend/js/api_client.js` - Client-side API wrapper

## Rate Limiting & Error Handling

### Rate Limiting
**Purpose**: Prevent API quota exhaustion and implement backoff strategies.

**Implementation**:
- Groq API: 25 requests/minute (buffer below 30 req/min limit)
- Timestamp-based request tracking
- Automatic sleep when limit approached

**Where it appears**:
- `/backend/integrations/groq_client.py` lines 62-85 - Rate limit implementation
- `/backend/middlewares/rate_limiter.py` - Middleware (if applicable)

### Error Handling
**Purpose**: Graceful degradation and user-friendly error messages.

**Implementation**:
- Try-catch blocks in all service methods
- Fallback summaries when AI fails
- Detailed error logging
- User-facing error messages

**Where it appears**:
- `/backend/middlewares/error_handler.py` - Global error handler
- `/backend/api/emails.py` lines 45-54 - AI fallback logic
- All agent files - Exception handling with logging
