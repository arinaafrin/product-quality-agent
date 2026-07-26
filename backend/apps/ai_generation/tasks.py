import logging

from celery import shared_task
from django.utils import timezone

from apps.experiences.models import MediaAsset

from .models import AiGenerationJob, StoryContent
from .providers import get_image_generator, get_story_generator, prompt_hash

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def generate_story_task(self, job_id: str):
    """Background job: generate the narrative text for an Experience."""
    job = AiGenerationJob.objects.select_related("experience__city").get(pk=job_id)
    job.status = AiGenerationJob.Status.PROCESSING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at"])

    try:
        experience = job.experience
        generator = get_story_generator()
        result = generator.generate(
            city_name=experience.city.name,
            year=experience.year,
            era_label=experience.era_label,
        )
        StoryContent.objects.update_or_create(
            experience=experience,
            defaults={
                "narrative_script": result["narrative_script"],
                "description": result["description"],
                "ai_model_used": result["model"],
                "generation_prompt_hash": prompt_hash(experience.city.name, str(experience.year)),
            },
        )
        job.status = AiGenerationJob.Status.COMPLETED
        job.completed_at = timezone.now()
        job.save(update_fields=["status", "completed_at"])
    except Exception as exc:  # noqa: BLE001
        logger.exception("Story generation failed for job %s", job_id)
        job.status = AiGenerationJob.Status.FAILED
        job.error_message = str(exc)
        job.save(update_fields=["status", "error_message"])
        raise self.retry(exc=exc, countdown=30) from exc


@shared_task(bind=True, max_retries=3)
def generate_media_task(self, job_id: str):
    """Background job: generate image/panorama media for an Experience."""
    job = AiGenerationJob.objects.select_related("experience__city").get(pk=job_id)
    job.status = AiGenerationJob.Status.PROCESSING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at"])

    try:
        experience = job.experience
        generator = get_image_generator()
        prompt = (
            f"{experience.city.name} in {experience.year}, {experience.era_label or ''}".strip()
        )
        result = generator.generate(prompt=prompt)
        MediaAsset.objects.create(
            experience=experience,
            type=MediaAsset.Type.STILL_IMAGE,
            storage_path=result["storage_path"],
            source_type=MediaAsset.SourceType.AI_GENERATED,
        )
        job.status = AiGenerationJob.Status.COMPLETED
        job.completed_at = timezone.now()
        job.save(update_fields=["status", "completed_at"])
    except Exception as exc:  # noqa: BLE001
        logger.exception("Media generation failed for job %s", job_id)
        job.status = AiGenerationJob.Status.FAILED
        job.error_message = str(exc)
        job.save(update_fields=["status", "error_message"])
        raise self.retry(exc=exc, countdown=30) from exc
