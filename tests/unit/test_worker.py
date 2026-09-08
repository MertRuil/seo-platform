import pytest
from apps.worker.worker import AsyncWorkerQueue

@pytest.mark.asyncio
async def test_worker_enqueue_and_process():
    worker = AsyncWorkerQueue()
    job_id = await worker.enqueue("noop_test", param=123)
    assert job_id.startswith("job-")
    assert not worker.queue.empty()

    handled = await worker.run_next_job()
    assert handled is True
    assert worker.queue.empty()
