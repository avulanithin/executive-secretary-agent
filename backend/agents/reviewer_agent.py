"""
Reviewer Agent - Quality control for all AI outputs
"""

import logging
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from .prompt_templates import PromptTemplates

logger = logging.getLogger(__name__)


class ReviewerAgent(BaseAgent):
    """
    Agent responsible for reviewing and validating outputs from other agents
    Acts as quality control to prevent hallucinations and errors
    """
    
    def __init__(self, groq_client):
        super().__init__(groq_client, "reviewer")
        self.templates = PromptTemplates()
    
    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Review all agent outputs for quality
        
        Args:
            input_data: {
                'sender': 'email@example.com',
                'subject': 'Email subject',
                'email_body': 'Original email body',
                'email_summary': 'Summary from Email Reader',
                'tasks': 'Tasks from Task Extractor',
                'priorities': 'Priorities from Prioritizer'
            }
            
        Returns:
            {
                'quality_score': 0.92,
                'confidence': 0.88,
                'issues_detected': [],
                'recommendations': 'All outputs look good',
                'approved': True
            }
        """
        try:
            # Sanitize inputs
            sender = input_data.get('sender', '')
            subject = self._sanitize_input(input_data.get('subject', ''))
            email_body = self._sanitize_input(input_data.get('email_body', ''))
            email_summary = input_data.get('email_summary', {})
            tasks = input_data.get('tasks', [])
            priorities = input_data.get('priorities', [])
            
            # Build prompt
            user_prompt = self.templates.REVIEWER_USER.format(
                sender=sender,
                subject=subject,
                email_body=email_body,
                email_summary=json.dumps(email_summary, indent=2),
                tasks_json=json.dumps(tasks, indent=2),
                priorities_json=json.dumps(priorities, indent=2)
            )
            
            # Call Groq API
            response = self.groq_client.chat_completion(
                messages=[
                    {"role": "system", "content": self.templates.REVIEWER_SYSTEM},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2  # Very low temperature for consistent review
            )
            
            output = response['data']
            
            # Validate output structure
            required_fields = ['quality_score', 'confidence', 'issues_detected', 
                             'recommendations', 'approved']
            for field in required_fields:
                if field not in output:
                    raise ValueError(f"Missing required field: {field}")
            
            # Add metadata
            output['agent'] = self.agent_name
            output['tokens_used'] = response['usage']['total_tokens']
            
            # Log execution
            self._log_execution(input_data, output, success=True)
            
            return output
        
        except Exception as e:
            error_msg = f"Reviewer Agent failed: {str(e)}"
            self._log_execution(input_data, None, success=False, error=error_msg)
            raise