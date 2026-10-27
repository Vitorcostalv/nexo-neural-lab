from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="NEXO_", env_file=ROOT / ".env", extra="ignore")
    chat_model: str = "qwen3:4b-instruct-2507-q4_K_M"
    embed_model: str = "embeddinggemma:300m"
    ollama_url: str = "http://127.0.0.1:11435"
    context_tokens: int = 8192
    max_output_tokens: int = 600
    api_key: str = ""
    warm_on_startup: bool = True


settings = Settings()
