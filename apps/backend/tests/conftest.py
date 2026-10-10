import os
import shutil
import socket
import subprocess
import time
import urllib.request
from collections.abc import Iterator
from pathlib import Path

import pytest


def _unused_tcp_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.fixture
def postgres_url(tmp_path: Path) -> Iterator[str]:
    initdb = shutil.which("initdb")
    pg_ctl = shutil.which("pg_ctl")
    if initdb is None or pg_ctl is None:
        pytest.fail("PostgreSQL 16 binaries are required for integration tests")

    data_dir = tmp_path / "postgres"
    port = _unused_tcp_port()
    subprocess.run(
        [
            initdb,
            "-D",
            str(data_dir),
            "-A",
            "trust",
            "-U",
            "postgres",
            "--no-locale",
            "--encoding=UTF8",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    subprocess.run(
        [
            pg_ctl,
            "-D",
            str(data_dir),
            "-l",
            str(tmp_path / "postgres.log"),
            "-o",
            f"-F -p {port} -h 127.0.0.1",
            "-w",
            "start",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    try:
        yield f"postgresql+psycopg://postgres@127.0.0.1:{port}/postgres"
    finally:
        subprocess.run(
            [pg_ctl, "-D", str(data_dir), "-m", "fast", "-w", "stop"],
            check=True,
            capture_output=True,
            text=True,
        )


@pytest.fixture
def migrated_postgres_url(postgres_url: str) -> str:
    subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        check=True,
        env={**os.environ, "ERIKNAR_DATABASE_URL": postgres_url},
        capture_output=True,
        text=True,
    )
    return postgres_url


@pytest.fixture
def minio_server(tmp_path: Path) -> Iterator[dict[str, object]]:
    executable = shutil.which("minio")
    if executable is None:
        pytest.fail("MinIO binary is required for integration tests")

    api_port = _unused_tcp_port()
    console_port = _unused_tcp_port()
    access_key = "integration-user"
    secret_key = "integration-secret"
    log_file = (tmp_path / "minio.log").open("wb")
    process = subprocess.Popen(
        [
            executable,
            "server",
            str(tmp_path / "minio-data"),
            "--address",
            f"127.0.0.1:{api_port}",
            "--console-address",
            f"127.0.0.1:{console_port}",
        ],
        env={
            **os.environ,
            "MINIO_ROOT_USER": access_key,
            "MINIO_ROOT_PASSWORD": secret_key,
        },
        stdout=log_file,
        stderr=subprocess.STDOUT,
    )
    health_url = f"http://127.0.0.1:{api_port}/minio/health/live"
    for _ in range(100):
        if process.poll() is not None:
            log_file.close()
            pytest.fail((tmp_path / "minio.log").read_text())
        try:
            with urllib.request.urlopen(health_url, timeout=0.2) as response:
                if response.status == 200:
                    break
        except OSError:
            time.sleep(0.1)
    else:
        process.terminate()
        process.wait(timeout=5)
        log_file.close()
        pytest.fail("MinIO did not become healthy")

    try:
        yield {
            "endpoint": f"127.0.0.1:{api_port}",
            "access_key": access_key,
            "secret_key": secret_key,
            "public_base_url": f"http://127.0.0.1:{api_port}",
        }
    finally:
        process.terminate()
        process.wait(timeout=5)
        log_file.close()


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"
