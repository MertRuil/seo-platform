import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Configure test environment defaults before settings or models are imported
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"
os.environ["DATABASE_SYNC_URL"] = "sqlite:///./test.db"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["APP_SECRET_KEY"] = "test-secret-key-for-pytest-execution-only-32chars"
os.environ["ENCRYPTION_KEY"] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
