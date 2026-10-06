import asyncio

import pytest

from eriknar.telegram.worker import _process_outbox


class RecoveringProcessor:
    def __init__(self) -> None:
        self.calls = 0
        self.recovered = asyncio.Event()

    async def run_once(self) -> bool:
        self.calls += 1
        if self.calls == 1:
            raise ConnectionError("database temporarily unavailable")
        self.recovered.set()
        return False


@pytest.mark.anyio
async def test_outbox_loop_survives_database_failure() -> None:
    processor = RecoveringProcessor()
    task = asyncio.create_task(_process_outbox(processor, 0.001))  # type: ignore[arg-type]
    try:
        await asyncio.wait_for(processor.recovered.wait(), timeout=1)
    finally:
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    assert processor.calls >= 2
