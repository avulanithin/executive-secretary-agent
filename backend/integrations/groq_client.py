"""
Groq API Client - Wrapper for Groq LLM API
Handles all communication with Groq's language models
"""

import os
import json
import time
import logging
from groq import Groq
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class GroqClient:
    """
    Client for interacting with Groq API
    Provides rate limiting, error handling, and structured output parsing
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Groq client
        
        Args:
            api_key: Groq API key (if None, loads from environment)
        """
        self.api_key = api_key or os.getenv('GROQ_API_KEY')
        
        if not self.api_key:
            raise ValueError("GROQ_API_KEY not found in environment variables")
        
        self.client = Groq(api_key=self.api_key)
        self.model = "llama-3.3-70b-versatile"  # Best model for reasoning
        
        # Rate limiting (Groq free tier: 30 requests/minute)
        self.max_requests_per_minute = 25  # Buffer below limit
        self.request_timestamps = []
    
    def _wait_if_rate_limited(self):
        """
        Implement rate limiting to prevent exceeding Groq API limits
        """
        current_time = time.time()
        
        # Remove timestamps older than 1 minute
        self.request_timestamps = [
            ts for ts in self.request_timestamps 
            if current_time - ts < 60
        ]
        
        # If at limit, wait
        if len(self.request_timestamps) >= self.max_requests_per_minute:
            sleep_time = 60 - (current_time - self.request_timestamps[0])
            if sleep_time > 0:
                logger.warning(f"Rate limit reached. Waiting {sleep_time:.2f}s")
                time.sleep(sleep_time)
        
        self.request_timestamps.append(current_time)
    
    def chat_completion(
        self, 
        messages: list, 
        temperature: float = 0.3,
        max_tokens: int = 2000
    ) -> Dict[str, Any]:
        """
        Send chat completion request to Groq
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            temperature: Sampling temperature (0.0 = deterministic, 1.0 = creative)
            max_tokens: Maximum tokens in response
            
        Returns:
            Parsed JSON response from the model
        """
        self._wait_if_rate_limited()
        
        try:
            start_time = time.time()
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"}  # Force JSON output
            )
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            # Extract response content
            content = response.choices[0].message.content
            
            # Parse JSON response
            try:
                parsed_response = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {content}")
                raise ValueError(f"Invalid JSON from Groq: {str(e)}")
            
            # Log successful request
            logger.info(
                f"Groq API success | Model: {self.model} | "
                f"Latency: {latency_ms}ms | "
                f"Tokens: {response.usage.total_tokens}"
            )
            
            return {
                'data': parsed_response,
                'usage': {
                    'prompt_tokens': response.usage.prompt_tokens,
                    'completion_tokens': response.usage.completion_tokens,
                    'total_tokens': response.usage.total_tokens
                },
                'latency_ms': latency_ms
            }
        
        except Exception as e:
            logger.error(f"Groq API error: {str(e)}", exc_info=True)
            raise
    
    def simple_prompt(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        Simplified method for single-turn prompts
        
        Args:
            prompt: User prompt
            system_prompt: Optional system instruction
            
        Returns:
            Groq API response
        """
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.append({"role": "user", "content": prompt})
        
        return self.chat_completion(messages)