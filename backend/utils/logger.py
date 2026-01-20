import logging
import os

LOG_DIR = "backend/logs"
os.makedirs(LOG_DIR, exist_ok=True)

API_LOG_FILE = os.path.join(LOG_DIR, "api.log")
AI_LOG_FILE = os.path.join(LOG_DIR, "ai.log")


def setup_logger(name, log_file, level=logging.INFO):
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )

    handler = logging.FileHandler(log_file)
    handler.setFormatter(formatter)

    logger = logging.getLogger(name)
    logger.setLevel(level)
    logger.addHandler(handler)
    logger.propagate = False

    return logger


api_logger = setup_logger("api", API_LOG_FILE)
ai_logger = setup_logger("ai", AI_LOG_FILE)
