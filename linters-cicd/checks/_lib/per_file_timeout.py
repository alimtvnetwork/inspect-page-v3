"""Per-file parse timeout helper (B8) — guard slow regexes/AST parses.

Wrap the per-file work in `with per_file_timeout(seconds=2):` and
catch `PerFileTimeout` to record a SARIF "skipped" finding rather than
hanging the whole run.

Implementation notes:
  - Uses signal.SIGALRM. Linux/macOS only. On Windows the context is a
    no-op (the watchdog already enforces the wall-clock limit).
  - Must not be nested. SIGALRM has only one slot.
  - Default 2 s aligns with spec/02-coding-guidelines/06-cicd-integration/07-performance.md.
"""

from __future__ import annotations

import contextlib
import signal
from typing import Iterator

DEFAULT_SECONDS = 2


class PerFileTimeout(TimeoutError):
    """Raised when per_file_timeout() expires."""


@contextlib.contextmanager
def per_file_timeout(seconds: int = DEFAULT_SECONDS) -> Iterator[None]:
    if not _supports_sigalrm():
        yield
        return
    previous = signal.signal(signal.SIGALRM, _raise_timeout)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous)


def _supports_sigalrm() -> bool:
    return hasattr(signal, "SIGALRM")


def _raise_timeout(signum, frame) -> None:  # noqa: ARG001
    raise PerFileTimeout(f"per-file timeout after {DEFAULT_SECONDS}s")
