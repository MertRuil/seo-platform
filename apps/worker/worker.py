import asyncio
import logging
from typing import Dict, Any, Callable, Awaitable
from apps.worker.tasks import run_crawl_job, run_audit_and_ai_job, run_rag_curator_job
from arq import create_pool
from arq.connections import RedisSettings
from packages.config.settings import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("worker")

class AsyncWorkerQueue:
    """In-memory async job queue for development and test execution."""
    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue()
        self._running = False
        self._worker_task: asyncio.Task = None

    async def enqueue(self, task_name: str, **kwargs) -> str:
        job_id = f"job-{id(kwargs)}"
        await self.queue.put((task_name, kwargs))
        logger.info(f"Enqueued job '{task_name}' with args {kwargs}")
        return job_id

    async def run_next_job(self) -> bool:
        if self.queue.empty():
            return False
        task_name, kwargs = await self.queue.get()
        try:
            if task_name == "crawl":
                await run_crawl_job(kwargs["crawl_run_id"])
            elif task_name == "audit_and_ai":
                await run_audit_and_ai_job(kwargs["site_id"], kwargs["crawl_run_id"])
            elif task_name == "rag_curator":
                await run_rag_curator_job(kwargs.get("days", 1))
            else:
                logger.warning(f"Unknown task: {task_name}")
        finally:
            self.queue.task_done()
        return True

class RedisWorkerQueue:
    """Durable queue shared by API and worker processes."""
    async def enqueue(self, task_name: str, **kwargs) -> str:
        redis = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
        try:
            job = await redis.enqueue_job(task_name, **kwargs)
            if job is None:
                raise RuntimeError("Job was not enqueued")
            return job.job_id
        finally:
            await redis.aclose()

async def crawl(ctx, crawl_run_id: str):
    return await run_crawl_job(crawl_run_id)

async def audit_and_ai(ctx, site_id: str, crawl_run_id: str):
    return await run_audit_and_ai_job(site_id, crawl_run_id)

async def rag_curator(ctx, days: int = 1):
    return await run_rag_curator_job(days)

class WorkerSettings:
    functions = [crawl, audit_and_ai, rag_curator]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_jobs = 10

class ResilientWorkerQueue:
    """
    Resilient queue that attempts Redis enqueue with fast timeout, 
    and seamlessly falls back to AsyncWorkerQueue for tests and local development.
    """
    def __init__(self):
        self._async_queue = AsyncWorkerQueue()
        self._redis_queue = RedisWorkerQueue()

    async def enqueue(self, task_name: str, **kwargs) -> str:
        if settings.ENVIRONMENT == "test":
            return await self._async_queue.enqueue(task_name, **kwargs)
        try:
            return await asyncio.wait_for(self._redis_queue.enqueue(task_name, **kwargs), timeout=1.5)
        except Exception as e:
            logger.warning(f"Redis unavailable ({e}), using async in-memory queue.")
            return await self._async_queue.enqueue(task_name, **kwargs)

    async def run_next_job(self) -> bool:
        return await self._async_queue.run_next_job()

worker_queue = ResilientWorkerQueue()

