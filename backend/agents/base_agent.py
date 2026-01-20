"""
Base Agent Class - Abstract base for all AI agents
Provides common functionality for logging, validation, and error handling
"""

import logging
import json
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod
from datetime import datetime

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """
    Abstract base class for all AI agents
    All agents must implement the 'run' method
    """
    
    def __init__(self, groq_client, agent_name: str):
        """
        Initialize base agent
        
        Args:
            groq_client: Instance of GroqClient
            agent_name: Name of the agent (for logging)
        """
        self.groq_client = groq_client
        self.agent_name = agent_name
        self.logger = logging.getLogger(f"agent.{agent_name}")
    
    @abstractmethod
    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main execution method - must be implemented by subclasses
        
        Args:
            input_data: Input data for the agent
            
        Returns:
            Agent output as dictionary
        """
        pass
    
    def _log_execution(self, input_data: Dict[str, Any], output_data: Dict[str, Any], 
                       success: bool, error: Optional[str] = None):
        """
        Log agent execution details
        
        Args:
            input_data: Input to the agent
            output_data: Output from the agent
            success: Whether execution was successful
            error: Error message if failed
        """
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'agent_name': self.agent_name,
            'success': success,
            'input_preview': str(input_data)[:200],  # First 200 chars
            'output_preview': str(output_data)[:200] if output_data else None,
            'error': error
        }
        
        if success:
            self.logger.info(json.dumps(log_entry))
        else:
            self.logger.error(json.dumps(log_entry))
    
    def _sanitize_input(self, text: str, max_length: int = 5000) -> str:
        """
        Sanitize input text to prevent prompt injection
        
        Args:
            text: Raw input text
            max_length: Maximum allowed length
            
        Returns:
            Sanitized text
        """
        if not text:
            return ""
        
        # Remove potential prompt injection patterns
        dangerous_patterns = [
            "ignore previous instructions",
            "ignore all instructions",
            "you are now",
            "new instructions:",
            "system:",
            "assistant:",
        ]
        
        sanitized = text
        for pattern in dangerous_patterns:
            sanitized = sanitized.replace(pattern, "[REDACTED]")
        
        # Truncate if too long
        if len(sanitized) > max_length:
            sanitized = sanitized[:max_length] + "\n[... truncated for length]"
        
        return sanitized
    
    def _validate_confidence(self, output: Dict[str, Any]) -> bool:
        """
        Check if output has acceptable confidence level
        
        Args:
            output: Agent output dictionary
            
        Returns:
            True if confidence is acceptable
        """
        confidence = output.get('confidence', 0.0)
        
        if confidence < 0.7:
            self.logger.warning(
                f"{self.agent_name} returned low confidence: {confidence:.2f}"
            )
            return False
        
        return True