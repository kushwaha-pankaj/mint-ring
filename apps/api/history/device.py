"""Resolve a stable per-browser / per-machine device id from request headers."""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from fastapi import Header, HTTPException, Request

_DEVICE_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

_LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1", "localhost"})


def normalise_device_id(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip().lower()
    return cleaned if _DEVICE_RE.match(cleaned) else None


def client_host(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def ip_derived_device_id(request: Request) -> str:
    """Stable id for this machine talking to the API (same IP → same UUID)."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"hm-demo-{client_host(request)}"))


def is_loopback_client(request: Request) -> bool:
    return client_host(request) in _LOOPBACK_HOSTS


def device_id_from_request(request: Request) -> str:
    """Prefer the client UUID; fall back to a deterministic id from the remote IP."""
    explicit = normalise_device_id(request.headers.get("x-hm-device-id"))
    if explicit:
        return explicit
    return ip_derived_device_id(request)


@dataclass(frozen=True)
class GalleryDeviceScope:
    """Ids used to load the gallery for this client."""

    primary: str
    query_ids: tuple[str, ...]
    loopback: bool


def gallery_device_scope(request: Request) -> GalleryDeviceScope:
    """
    Primary id for new writes and orphan backfill.

    query_ids unions browser UUID, IP-stable id, and (on localhost) every pack
    on this server so one dev machine sees all local generations.
    """
    explicit = normalise_device_id(request.headers.get("x-hm-device-id"))
    ip_id = ip_derived_device_id(request)
    primary = explicit or ip_id
    ids: list[str] = []
    for candidate in (explicit, ip_id):
        if candidate and candidate not in ids:
            ids.append(candidate)
    return GalleryDeviceScope(
        primary=primary,
        query_ids=tuple(ids),
        loopback=is_loopback_client(request),
    )


def reconcile_ip_owned_jobs(primary: str, request: Request) -> int:
    """
    Move generations stored under the IP-only alias onto the browser primary id.

    Safe to run on each gallery load: only retags the IP fallback id, not other UUIDs.
    """
    ip_id = ip_derived_device_id(request)
    if primary == ip_id:
        return 0
    from ..design import jobs

    return jobs.reassign_device_id(from_id=ip_id, to_id=primary)


def require_device_id(
    x_hm_device_id: str | None = Header(None, alias="X-HM-Device-Id"),
) -> str:
    device = normalise_device_id(x_hm_device_id)
    if not device:
        raise HTTPException(
            400,
            "Missing or invalid X-HM-Device-Id. The studio assigns one per browser.",
        )
    return device
