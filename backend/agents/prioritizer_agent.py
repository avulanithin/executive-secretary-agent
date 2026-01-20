"""
Prioritizer Agent - Assigns priority and deadlines to tasks
"""

import logging
import json
from typing import Dict, Any, List
from datetime import datetime, timedelta
from .base_agent import BaseAgent
from .prompt_templates import PromptTemplates

logger = logging.getLogger(__name__)


class PrioritizerAgent(BaseAgent):
    """
    Agent responsible for prioritizing tasks and suggesting deadlines
    """
    
    def __init__(self, groq_client):
        super().__init__(groq_client, "prioritizer")
        self.templates = PromptTemplates()
    
    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prioritize tasks and assign deadlines
        
        Args:
            input_data: {
                'tasks': [list of tasks from Task Extractor],
                'working_hours': '9:00 AM - 5:00 PM',
                'current_task_count': 5,
                'current_date': '2026-01-20'
            }
            
        Returns:
            {
                'prioritized_tasks': [
                    {
                        'task_index': 0,
                        'priority': 'high',
                        'estimated_duration': 120,
                        'suggested_deadline': '2026-01-25T17:00:00Z',
                        'reasoning': 'Client-facing deadline',
                        'confidence': 0.88
                    }
                ]
            }
        """
        try:
            tasks = input_data.get('tasks', [])
            
            if not tasks:
                return {
                    'prioritized_tasks': [],
                    'agent': self.agent_name,
                    'message': 'No tasks to prioritize'
                }
            
            working_hours = input_data.get('working_hours', '9:00 AM - 5:00 PM')
            current_task_count = input_data.get('current_task_count', 0)
            current_date = input_data.get('current_date', datetime.now().isoformat())
            
            # Build prompt
            user_prompt = self.templates.PRIORITIZER_USER.format(
                tasks_json=json.dumps(tasks, indent=2),
                working_hours=working_hours,
                current_task_count=current_task_count,
                current_date=current_date
            )
            
            # Call Groq API
            response = self.groq_client.chat_completion(
                messages=[
                    {"role": "system", "content": self.templates.PRIORITIZER_SYSTEM},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.4  # Slightly higher for deadline creativity
            )
            
            output = response['data']
            
            # Validate output
            if 'prioritized_tasks' not in output:
                raise ValueError("Missing 'prioritized_tasks' field")
            
            # Validate each prioritized task
            for pt in output['prioritized_tasks']:
                required_fields = ['task_index', 'priority', 'estimated_duration', 
                                 'suggested_deadline', 'confidence']
                for field in required_fields:
                    if field not in pt:
                        raise ValueError(f"Prioritized task missing field: {field}")
            
            # Add metadata
            output['agent'] = self.agent_name
            output['tokens_used'] = response['usage']['total_tokens']
            
            # Log execution
            self._log_execution(input_data, output, success=True)
            
            return output
        
        except Exception as e:
            error_msg = f"Prioritizer Agent failed: {str(e)}"
            self._log_execution(input_data, None, success=False, error=error_msg)
            raise