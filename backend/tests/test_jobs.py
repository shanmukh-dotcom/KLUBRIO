from rq import Queue, SimpleWorker

from app.jobs.example import ping


def test_example_job_runs_through_redis(redis):
    queue = Queue("test-example", connection=redis)
    queue.empty()
    job = queue.enqueue(ping, "hello")

    SimpleWorker([queue], connection=redis).work(burst=True)

    job.refresh()
    assert job.is_finished
    assert job.return_value() == "pong: hello"
