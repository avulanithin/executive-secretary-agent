"""
Email Reader Agent - Summarizes and categorizes emails
"""

import logging
from typing import Dict, Any
from .base_agent import BaseAgent
from .prompt_templates import PromptTemplates

logger = logging.getLogger(__name__)


class EmailReaderAgent(BaseAgent):
    """
    Agent responsible for reading and summarizing emails
    Extracts key information and categorizes urgency
    """
    
    def __init__(self, groq_client):
        super().__init__(groq_client, "email_reader")
        self.templates = PromptTemplates()
    
    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze email and generate summary
        
        Args:
            input_data: {
                'sender': 'email@example.com',
                'subject': 'Email subject',
                'body': 'Email body text'
            }
            
        Returns:
            {
                'summary': 'Email summary',
                'key_points': ['point1', 'point2'],
                'urgency': 'low'|'medium'|'high',
                'category': 'action_required'|'meeting_request'|'informational'|'follow_up',
                'confidence': 0.85
            }
        """
        try:
            # Sanitize inputs
            sender = input_data.get('sender', 'unknown')
            subject = self._sanitize_input(input_data.get('subject', ''))
            body = self._sanitize_input(input_data.get('body', ''))
            
            # Build prompt
            user_prompt = self.templates.EMAIL_READER_USER.format(
                sender=sender,
                subject=subject,
                body=body
            )
            
            # Call Groq API
            response = self.groq_client.chat_completion(
                messages=[
                    {"role": "system", "content": self.templates.EMAIL_READER_SYSTEM},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3  # Low temperature for consistency
            )
            
            output = response['data']
            
            # Validate output structure
            required_fields = ['summary', 'key_points', 'urgency', 'category', 'confidence']
            for field in required_fields:
                if field not in output:
                    raise ValueError(f"Missing required field: {field}")
            
            # Add metadata
            output['agent'] = self.agent_name
            output['tokens_used'] = response['usage']['total_tokens']
            output['latency_ms'] = response['latency_ms']
            
            # Log execution
            self._log_execution(input_data, output, success=True)
            
            return output
        
        except Exception as e:
            error_msg = f"Email Reader Agent failed: {str(e)}"
            self._log_execution(input_data, None, success=False, error=error_msg)
            raise