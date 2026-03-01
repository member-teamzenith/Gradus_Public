import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
# Get the OrionServer directory (parent of core/)
orion_dir = Path(__file__).parent.parent
env_path = orion_dir / ".env"
load_dotenv(dotenv_path=env_path, override=True)

class Settings:
    # LLM API Keys
    DEEPINFRA_API_KEY = os.getenv("DEEPINFRA_API_KEY")
    AGENT_KEY = os.getenv("AGENT_KEY")

    DEEPINFRA_BASE_URL = os.getenv("DEEPINFRA_BASE_URL", "https://api.deepinfra.com/v1/openai")
    
    # Writer Agent
    WRITER_KEY = os.getenv("WRITER_KEY")
    WRITER_MODEL = os.getenv("WRITER_MODEL")

    # Recommendation Agent
    RECOMMENDATION_KEY = os.getenv("RECOMMENDATION_KEY")
    RECOMMENDATION_MODEL = os.getenv("RECOMMENDATION_MODEL")

    # Quiz Agent
    QUIZ_KEY = os.getenv("QUIZ_KEY")
    QUIZ_MODEL = os.getenv("QUIZ_MODEL")

    # Summarization Worker
    SUMMARIZATION_KEY = os.getenv("SUMMARIZATION_KEY")
    SUMMARIZATION_MODEL = os.getenv("SUMMARIZATION_MODEL")

    # Timeouts
    SUMMARY_READ_TIMEOUT = os.getenv("SUMMARY_READ_TIMEOUT", "210")
    RECS_READ_TIMEOUT = os.getenv("RECS_READ_TIMEOUT", "60")
    
    # Qdrant Configuration
    QDRANT_URL = os.getenv("QDRANT_URL")
    QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
    
    # R2 Storage (from Chatbot)
    R2_PUBLIC_BASE_URL = os.getenv("R2_PUBLIC_BASE_URL")
    R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
    R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
    R2_API_TOKEN = os.getenv("R2_API_TOKEN")
    R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
    R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")

    # Redis (from Chatbot)
    REDIS_URL = os.getenv("REDIS_URL")
    
    # Google/Firebase (from Chatbot)
    GOOGLE_APPLICATION_CREDENTIALS_JSON = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    # Chatbot Utils
    
    # Selector Agent
    SELECTOR_KEY = os.getenv("SELECTOR_KEY")
    SELECTOR_MODEL = os.getenv("SELECTOR_MODEL")

    # Answering Agent
    ANSWERING_KEY = os.getenv("ANSWERING_KEY")
    ANSWERING_MODEL = os.getenv("ANSWERING_MODEL")

    # Memory Summarizer
    MEMORY_SUMMARIZER_KEY = os.getenv("MEMORY_SUMMARIZER_KEY")
    MEMORY_SUMMARIZER_MODEL = os.getenv("MEMORY_SUMMARIZER_MODEL")

    # Vision Agent
    VISION_KEY = os.getenv("VISION_KEY")
    VISION_MODEL = os.getenv("VISION_MODEL")

    # Embedding Agent
    EMBEDDING_KEY = os.getenv("EMBEDDING_KEY")
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL")
    DEEP_INFRA_API_EMBEDDING = os.getenv("DEEP_INFRA_API_EMBEDDING")

settings = Settings()
