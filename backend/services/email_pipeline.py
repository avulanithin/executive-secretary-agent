from backend.services.gmail_service import fetch_gmail_emails
# from backend.services.email_auto_processor import process_pending_emails
# from backend.services.email_auto_processor import process_pending_emails


def run_email_pipeline(user):
    """
    1. Sync Gmail
    2. Auto-process pending emails with AI
    """

    created = fetch_gmail_emails(user)

    # Process ALL newly fetched emails
    processed = process_pending_emails(limit=50)

    return {
        "emails_fetched": created,
        "emails_processed": processed
    }
