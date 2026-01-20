"""
Agent Orchestrator - Manages the AI agent pipeline
Coordinates all agents to process emails end-to-end
"""

import logging
from typing import Dict, Any
from datetime import datetime

from backend.integrations.groq_client import GroqClient
from backend.agents.email_reader_agent import EmailReaderAgent
from backend.agents.task_extractor_agent import TaskExtractorAgent
from backend.agents.prioritizer_agent import PrioritizerAgent
from backend.agents.reviewer_agent import ReviewerAgent

logger = logging.getLogger(__name__)


class AgentOrchestrator:
    """
    Orchestrates the AI agent pipeline for processing emails
    """

    def __init__(self, groq_api_key: str = None):
        """
        Initialize orchestrator with all agents

        Args:
            groq_api_key: Groq API key (if None, loads from env)
        """
        self.groq_client = GroqClient(api_key=groq_api_key)

        # Initialize all agents
        self.email_reader = EmailReaderAgent(self.groq_client)
        self.task_extractor = TaskExtractorAgent(self.groq_client)
        self.prioritizer = PrioritizerAgent(self.groq_client)
        self.reviewer = ReviewerAgent(self.groq_client)

        logger.info("Agent Orchestrator initialized with all agents")

    def process_email(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process email through complete AI pipeline

        Args:
            email_data: {
                'sender': 'email@example.com',
                'subject': 'Email subject',
                'body': 'Email body'
            }

        Returns:
            {
                'email_summary': {...},
                'extracted_tasks': [...],
                'prioritized_tasks': [...],
                'review_result': {...},
                'approved': True/False,
                'processing_time_ms': 1234
            }
        """
        start_time = datetime.now()

        try:
            logger.info(
                f"Starting email processing pipeline for: "
                f"{email_data.get('subject', 'No Subject')}"
            )

            # STEP 1: Email Reader Agent
            logger.info("Step 1: Running Email Reader Agent")
            email_summary = self.email_reader.run({
                'sender': email_data.get('sender', ''),
                'subject': email_data.get('subject', ''),
                'body': email_data.get('body', '')
            })

            logger.info(
                f"Email categorized as: {email_summary.get('category')} "
                f"with urgency: {email_summary.get('urgency')}"
            )

            # STEP 2: Task Extractor Agent
            logger.info("Step 2: Running Task Extractor Agent")
            task_extraction = self.task_extractor.run({
                'email_summary': email_summary.get('summary', ''),
                'sender': email_data.get('sender', ''),
                'subject': email_data.get('subject', '')
            })

            extracted_tasks = task_extraction.get('tasks', [])
            logger.info(f"Extracted {len(extracted_tasks)} tasks")

            # If no tasks, skip prioritization
            if not extracted_tasks:
                logger.info("No tasks found, skipping prioritization")

                processing_time_ms = int(
                    (datetime.now() - start_time).total_seconds() * 1000
                )

                return {
                    'email_summary': email_summary,
                    'extracted_tasks': [],
                    'prioritized_tasks': [],
                    'review_result': {
                        'approved': True,
                        'quality_score': 1.0,
                        'message': 'No actionable tasks found'
                    },
                    'approved': True,
                    'processing_time_ms': processing_time_ms
                }

            # STEP 3: Prioritizer Agent
            logger.info("Step 3: Running Prioritizer Agent")
            prioritization = self.prioritizer.run({
                'tasks': extracted_tasks,
                'working_hours': '9:00 AM - 5:00 PM',  # TODO: User preferences
                'current_task_count': 0,              # TODO: Database value
                'current_date': datetime.now().isoformat()
            })

            prioritized_tasks = prioritization.get('prioritized_tasks', [])
            logger.info(f"Prioritized {len(prioritized_tasks)} tasks")

            # STEP 4: Reviewer Agent
            logger.info("Step 4: Running Reviewer Agent for quality control")
            review_result = self.reviewer.run({
                'sender': email_data.get('sender', ''),
                'subject': email_data.get('subject', ''),
                'email_body': email_data.get('body', ''),
                'email_summary': email_summary,
                'tasks': extracted_tasks,
                'priorities': prioritized_tasks
            })

            approved = review_result.get('approved', False)
            quality_score = review_result.get('quality_score', 0.0)

            logger.info(
                f"Review complete: Approved={approved}, "
                f"Quality={quality_score:.2f}"
            )

            if not approved:
                logger.warning(
                    f"Review issues: "
                    f"{review_result.get('issues_detected', [])}"
                )

            # Calculate total processing time
            processing_time_ms = int(
                (datetime.now() - start_time).total_seconds() * 1000
            )

            result = {
                'email_summary': email_summary,
                'extracted_tasks': extracted_tasks,
                'prioritized_tasks': prioritized_tasks,
                'review_result': review_result,
                'approved': approved,
                'processing_time_ms': processing_time_ms
            }

            logger.info(
                f"Email processing complete in {processing_time_ms}ms"
            )

            return result

        except Exception as e:
            logger.error(
                f"Email processing pipeline failed: {str(e)}",
                exc_info=True
            )
            raise
