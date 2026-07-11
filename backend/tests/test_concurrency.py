import asyncio

from app.core.concurrency import bounded_gather


async def test_preserves_input_order():
    async def worker(n: int) -> int:
        # Later items sleep less, so completion order != input order.
        await asyncio.sleep((10 - n) * 0.001)
        return n * n

    result = await bounded_gather(range(10), worker, limit=4)
    assert result == [n * n for n in range(10)]


async def test_respects_concurrency_limit():
    current = 0
    peak = 0

    async def worker(_: int) -> None:
        nonlocal current, peak
        current += 1
        peak = max(peak, current)
        await asyncio.sleep(0.01)
        current -= 1

    await bounded_gather(range(20), worker, limit=3)
    assert peak <= 3


async def test_empty_items():
    async def worker(x):
        return x

    assert await bounded_gather([], worker, limit=5) == []
