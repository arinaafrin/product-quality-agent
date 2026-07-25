"""
Python port of app/Services/AI/*. Each provider implements a small
interface (StoryGenerator / ImageGenerator) so swapping providers is a
one-line config change (AI_STORY_PROVIDER / AI_IMAGE_PROVIDER in .env),
same idea as the Laravel Contracts + AiServiceProvider binding.
"""

import hashlib
import logging
from abc import ABC, abstractmethod

from django.conf import settings

logger = logging.getLogger(__name__)


class StoryGenerator(ABC):
    @abstractmethod
    def generate(self, *, city_name: str, year: int, era_label: str | None) -> dict:
        """Returns {"narrative_script": str, "description": str, "model": str}."""


class ImageGenerator(ABC):
    @abstractmethod
    def generate(self, *, prompt: str) -> dict:
        """Returns {"storage_path": str, "model": str}."""


class AnthropicStoryGenerator(StoryGenerator):
    def generate(self, *, city_name: str, year: int, era_label: str | None) -> dict:
        # In production this calls the Anthropic API (see anthropic_api_in_artifacts
        # docs / the `anthropic` Python SDK) with a prompt built from
        # city/year/era. Kept as a clearly-marked stub here so the project
        # runs out of the box without requiring API keys.
        logger.info("Generating story for %s (%s) via Anthropic", city_name, year)
        label = f", {era_label}" if era_label else ""
        return {
            "narrative_script": f"[stub] A walk through {city_name} in {year}{label}...",
            "description": f"An AI-narrated tour of {city_name} as it was in {year}.",
            "model": "claude-sonnet-5",
        }


class StabilityImageGenerator(ImageGenerator):
    def generate(self, *, prompt: str) -> dict:
        logger.info("Generating image via Stability for prompt: %s", prompt)
        digest = hashlib.sha256(prompt.encode()).hexdigest()[:16]
        return {"storage_path": f"generated/{digest}.png", "model": "stable-diffusion-xl"}


def get_story_generator() -> StoryGenerator:
    provider = settings.AI_STORY_PROVIDER
    if provider == "anthropic":
        return AnthropicStoryGenerator()
    raise ValueError(f"Unknown AI_STORY_PROVIDER: {provider}")


def get_image_generator() -> ImageGenerator:
    provider = settings.AI_IMAGE_PROVIDER
    if provider == "stability":
        return StabilityImageGenerator()
    raise ValueError(f"Unknown AI_IMAGE_PROVIDER: {provider}")


def prompt_hash(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode()).hexdigest()
