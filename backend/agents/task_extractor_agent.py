"""
Task Extractor Agent - Identifies actionable tasks from emails
"""

import logging
from typing import Dict, Any
from .base_agent import BaseAgent
from .prompt_templates import PromptTemplates

logger = logging.getLogger(__name__)


class TaskExtractorAgent(BaseAgent):
    """
    Agent responsible for extracting actionable tasks from email summaries
    """
    
    def __init__(self, groq_client):
        super().__init__(groq_client, "task_extractor")
        self.templates = PromptTemplates()
    
    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract tasks from email summary
        
        Args:
            input_data: {
                'email_summary': 'Summary from Email Reader Agent',
                'sender': 'email@example.com',
                'subject': 'Email subject'
            }
            
        Returns:
            {
                'tasks': [
                    {
                        'title': 'Complete Q3 Report',
                        'description': 'Prepare quarterly financial report',
                        'dependencies': [],
                        'requires_delegation': False,
                        'confidence': 0.90
                    }
                ]
            }
        """
        try:
            email_summary = input_data.get('email_summary', '')
            sender = input_data.get('sender', '')
            subject = input_data.get('subject', '')
            
            # Build prompt
            user_prompt = self.templates.TASK_EXTRACTOR_USER.format(
                email_summary=email_summary,
                sender=sender,
                subject=subject
            )
            
            # Call Groq API
            response = self.groq_client.chat_completion(
                messages=[
                    {"role": "system", "content": self.templates.TASK_EXTRACTOR_SYSTEM},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3
            )
            
            output = response['data']
            
            # Validate output
            if 'tasks' not in output:
                raise ValueError("Missing 'tasks' field in output")
            
            if not isinstance(output['tasks'], list):
                raise ValueError("'tasks' field must be a list")
            
            # Validate each task
            for task in output['tasks']:
                required_fields = ['title', 'description', 'confidence']
                for field in required_fields:
                    if field not in task:
                        raise ValueError(f"Task missing required field: {field}")
            
            # Add metadata
            output['agent'] = self.agent_name
            output['tasks_count'] = len(output['tasks'])
            output['tokens_used'] = response['usage']['total_tokens']
            
            # Log execution
            self._log_execution(input_data, output, success=True)
            
            return output
        
        except Exception as e:
            error_msg = f"Task Extractor Agent failed: {str(e)}"
            self._log_execution(input_data, None, success=False, error=error_msg)
            raise