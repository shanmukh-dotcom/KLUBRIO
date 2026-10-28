"""Cross-platform worker entry point: `python -m app.jobs.worker [queue ...]`.

Uses RQ's SimpleWorker (no fork), so it also runs on Windows during development.
Production workers on Linux can use the regular `rq worker` command.
"""

import sys

from rq import SimpleWorker

from app.jobs.queue import DEFAULT_QUEUE, get_queue, get_redis


def main() -> None:
    names = sys.argv[1:] or [DEFAULT_QUEUE]
    worker = SimpleWorker([get_queue(name) for name in names], connection=get_redis())
    worker.work()


if __name__ == "__main__":
    main()
