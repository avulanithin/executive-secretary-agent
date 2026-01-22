# from google.oauth2.credentials import Credentials
# from googleapiclient.discovery import build
# from backend.models.email import Email
# from backend.database.db import db
# from datetime import datetime
# import os


# def fetch_gmail_emails(user):
#     if not user.gmail_token or not user.gmail_access_token:
#         raise Exception("Missing Gmail OAuth tokens")

#     creds = Credentials(
#         token=user.gmail_access_token,
#         refresh_token=user.gmail_token,
#         token_uri="https://oauth2.googleapis.com/token",
#         client_id=os.getenv("GOOGLE_CLIENT_ID"),
#         client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
#         scopes=["https://www.googleapis.com/auth/gmail.readonly"],
#     )

#     service = build("gmail", "v1", credentials=creds)

#     results = service.users().messages().list(
#         userId="me",
#         maxResults=10
#     ).execute()

#     messages = results.get("messages", [])
#     created = []

#     for msg in messages:
#         if Email.query.filter_by(gmail_message_id=msg["id"]).first():
#             continue

#         data = service.users().messages().get(
#             userId="me",
#             id=msg["id"],
#             format="metadata",
#             metadataHeaders=["From", "Subject"]
#         ).execute()

#         headers = data["payload"].get("headers", [])
#         header_map = {h["name"]: h["value"] for h in headers}

#         email = Email(
#             user_id=user.id,
#             gmail_message_id=msg["id"],
#             sender=header_map.get("From", "unknown"),
#             subject=header_map.get("Subject", "(No subject)"),
#             body="(Body parsing later)",
#             received_at=datetime.utcnow(),
#             processing_status="pending",
#         )

#         db.session.add(email)
#         created.append(email)

#     db.session.commit()
#     return created
