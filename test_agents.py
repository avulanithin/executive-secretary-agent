"""
Test Script for AI Agents
Run this to test the complete AI agent pipeline
"""

import os
import json
import logging
from dotenv import load_dotenv

from backend.services.agent_orchestrator import AgentOrchestrator

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Load environment variables
load_dotenv()


def test_agent_pipeline():
    """
    Test the complete AI agent pipeline with sample emails
    """

    print("=" * 70)
    print("AI AGENT PIPELINE TEST")
    print("=" * 70)
    print()

    orchestrator = AgentOrchestrator()

    # TEST 1: Action Required Email
    print("\n" + "=" * 70)
    print("TEST 1: Action Required Email")
    print("=" * 70)

    email_1 = {
        'sender': 'client@bigcorp.com',
        'subject': 'Q3 Financial Report - Due Friday',
        'body': '''Hi,

We need the Q3 financial report by end of day this Friday (5 PM).

Please include:
1. Revenue breakdown by department
2. Expense analysis
3. Profit margins
4. Executive summary (2 pages max)

This will be presented to the board on Monday morning, so accuracy is critical.

Also, can you schedule a 30-minute review call with me on Thursday afternoon to go over the draft?

Thanks,
John Smith
CEO, BigCorp'''
    }

    result_1 = orchestrator.process_email(email_1)

    print("\n📧 EMAIL SUMMARY:")
    print(json.dumps(result_1['email_summary'], indent=2))

    print("\n✅ EXTRACTED TASKS:")
    for i, task in enumerate(result_1['extracted_tasks'], 1):
        print(f"\nTask {i}:")
        print(f"  Title: {task['title']}")
        print(f"  Description: {task['description']}")
        print(f"  Confidence: {task['confidence']:.2f}")

    print("\n⏰ PRIORITIZED TASKS:")
    for pt in result_1['prioritized_tasks']:
        task = result_1['extracted_tasks'][pt['task_index']]
        print(f"\n{task['title']}")
        print(f"  Priority: {pt['priority'].upper()}")
        print(f"  Duration: {pt['estimated_duration']} minutes")
        print(f"  Deadline: {pt['suggested_deadline']}")
        print(f"  Reasoning: {pt['reasoning']}")

    print("\n🔍 REVIEW RESULT:")
    print(f"  Approved: {result_1['review_result']['approved']}")
    print(f"  Quality Score: {result_1['review_result']['quality_score']:.2f}")
    print(f"  Recommendations: {result_1['review_result'].get('recommendations')}")

    print(f"\n⏱️  Total Processing Time: {result_1['processing_time_ms']}ms")

    # TEST 2: Informational Email
    print("\n\n" + "=" * 70)
    print("TEST 2: Informational Email (No Tasks)")
    print("=" * 70)

    email_2 = {
        'sender': 'newsletter@techblog.com',
        'subject': 'Weekly Tech Digest - January Edition',
        'body': '''Hi there,

Here are this week's top tech stories:

- AI breakthrough in natural language processing
- New smartphone releases expected in Q2
- Cloud computing trends for 2026

Read more on our website.

Best regards,
Tech Blog Team'''
    }

    result_2 = orchestrator.process_email(email_2)

    print("\n📧 EMAIL SUMMARY:")
    print(json.dumps(result_2['email_summary'], indent=2))

    print(f"\n✅ EXTRACTED TASKS: {len(result_2['extracted_tasks'])}")
    print(f"⏱️  Total Processing Time: {result_2['processing_time_ms']}ms")

    # TEST 3: Meeting Request Email
    print("\n\n" + "=" * 70)
    print("TEST 3: Meeting Request Email")
    print("=" * 70)

    email_3 = {
        'sender': 'manager@company.com',
        'subject': 'Can we schedule a strategy meeting?',
        'body': '''Hi,

Can we schedule a 2-hour strategy planning meeting sometime next week?

I'd like to discuss our Q2 roadmap and resource allocation.

Ideally Tuesday or Wednesday afternoon works best for me.

Let me know your availability!

Sarah'''
    }

    result_3 = orchestrator.process_email(email_3)

    print("\n📧 EMAIL SUMMARY:")
    print(f"  Category: {result_3['email_summary']['category']}")
    print(f"  Urgency: {result_3['email_summary']['urgency']}")

    print("\n✅ EXTRACTED TASKS:")
    for i, task in enumerate(result_3['extracted_tasks'], 1):
        print(f"\n  Task {i}: {task['title']}")

    print(f"\n⏱️  Total Processing Time: {result_3['processing_time_ms']}ms")

    print("\n" + "=" * 70)
    print("ALL TESTS COMPLETE!")
    print("=" * 70)


if __name__ == "__main__":
    if not os.getenv("GROQ_API_KEY"):
        print("❌ ERROR: GROQ_API_KEY not found in environment variables")
        print("Please add your Groq API key to the .env file")
        exit(1)

    try:
        test_agent_pipeline()
    except Exception as e:
        print(f"\n❌ TEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
