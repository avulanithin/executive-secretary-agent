import os
import json
from datetime import datetime
from groq import Groq


class AIEmailService:

    def process_email(self, email):
        result = self._run_ai(
            subject=email.subject or "",
            body=email.body or ""
        )

        email.ai_summary = result["summary"]
        email.urgency_level = result["urgency"]
        email.category = result["category"]
        email.ai_actions = json.dumps(result.get("actions", []))
        email.ai_deadline = result.get("deadline")

    """
    Single responsibility:
    Convert email → structured intelligence
    """

    MODEL = "llama-3.1-8b-instant"
    MAX_RETRIES = 2

    @classmethod
    def _get_client(cls) -> Groq:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY environment variable not set")
        return Groq(api_key=api_key)

    @classmethod
    def process_email(cls, subject: str, body: str) -> dict:
        prompt = cls._build_prompt(subject, body)
        client = cls._get_client()

        for _ in range(cls.MAX_RETRIES):
            response_text = cls._call_llm(client, prompt)
            parsed = cls._parse_response(response_text)
            if parsed:
                return parsed

        raise ValueError("AI failed to return valid structured JSON")

    # -----------------------------
    # PROMPT
    # -----------------------------
    @staticmethod
    def _build_prompt(subject: str, body: str) -> str:
        return f"""
You are an executive email intelligence system.

Rules:
- Output ONLY valid JSON
- No markdown
- No explanations
- No extra text

Return EXACTLY this schema:

{{
  "summary": "2-4 line executive summary",
  "urgency": "low|medium|high",
  "category": "meeting|task|academic|finance|personal|info|spam",
  "actions": [],
  "deadline": null
}}

EMAIL SUBJECT:
{subject}

EMAIL BODY:
{body}
""".strip()

    # -----------------------------
    # LLM CALL
    # -----------------------------
    @staticmethod
    def _call_llm(client: Groq, prompt: str) -> str:
        completion = client.chat.completions.create(
            model=AIEmailService.MODEL,
            messages=[
                {"role": "system", "content": "Return JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )
        return completion.choices[0].message.content.strip()

    # -----------------------------
    # VALIDATION
    # -----------------------------
    @staticmethod
    def _parse_response(text: str) -> dict | None:
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return None

        required = {"summary", "urgency", "category", "actions", "deadline"}
        if not required.issubset(data):
            return None

        if data["urgency"] not in {"low", "medium", "high"}:
            return None

        if not isinstance(data["actions"], list):
            return None

        if data["deadline"]:
            try:
                data["deadline"] = datetime.fromisoformat(data["deadline"])
            except Exception:
                data["deadline"] = None

        return data
    

from backend.models.email import Email
from backend.database.db import db

def retry_failed_ai_emails():
    failed = Email.query.filter_by(processing_status="failed").all()

    for email in failed:
        try:
            process_email(email)
            email.processing_status = "completed"
        except Exception:
            email.processing_status = "failed"

    db.session.commit()

