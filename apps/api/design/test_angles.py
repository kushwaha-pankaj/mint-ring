import asyncio

from . import pipeline
from .engine import GenerationResult


class _FakeAngleEngine:
    name = "fake"
    supports_img2img = True
    supports_edit = True
    supports_turntable = True

    def __init__(self) -> None:
        self.calls: list[tuple[str, float | str]] = []

    async def text_to_image(self, prompt, *, seed, size=(1024, 1024)):
        raise AssertionError("text_to_image should not be used for angles")

    async def image_to_image(
        self, prompt, reference_bytes, *, seed, strength=0.6, size=(1024, 1024)
    ):
        self.calls.append(("image_to_image", prompt))
        return GenerationResult(image_bytes=b"image-to-image", seed=seed)

    async def edit(self, instruction, reference_bytes, *, seed, size=(1024, 1024)):
        self.calls.append(("edit", instruction))
        return GenerationResult(image_bytes=b"edit", seed=seed)

    async def rotate_view(
        self,
        reference_bytes,
        *,
        horizontal_angle,
        seed,
        vertical_angle=0.0,
    ):
        self.calls.append(("rotate", float(horizontal_angle)))
        return GenerationResult(image_bytes=b"rotate", seed=seed)


def test_angles_default_to_numeric_turntable(monkeypatch, tmp_path):
    engine = _FakeAngleEngine()
    updates = []

    monkeypatch.setenv("DESIGN_ANGLES", "turntable")
    monkeypatch.setattr(pipeline, "pack_dir", lambda _job_id: tmp_path)
    monkeypatch.setattr(pipeline.jobs, "get_status", lambda _job_id: "running")
    monkeypatch.setattr(
        pipeline.jobs,
        "update_stage",
        lambda job_id, stage, state: updates.append((job_id, stage, state)),
    )

    asyncio.run(pipeline._run_angles("job-1", engine, b"hero"))

    assert engine.calls == [
        ("rotate", 0.0),
        ("rotate", 90.0),
        ("rotate", 180.0),
        ("rotate", 270.0),
    ]
    assert updates[-1][1] == "angles"
    assert updates[-1][2].status == "done"
    assert [item["degrees"] for item in updates[-1][2].angle_urls] == [0, 90, 180, 270]


def test_angles_can_still_use_prompt_edit_fallback(monkeypatch, tmp_path):
    engine = _FakeAngleEngine()

    monkeypatch.setenv("DESIGN_ANGLES", "kontext")
    monkeypatch.setattr(pipeline, "pack_dir", lambda _job_id: tmp_path)
    monkeypatch.setattr(pipeline.jobs, "get_status", lambda _job_id: "running")
    monkeypatch.setattr(pipeline.jobs, "update_stage", lambda *_args: None)

    asyncio.run(pipeline._run_angles("job-1", engine, b"hero"))

    assert [kind for kind, _payload in engine.calls] == ["edit", "edit", "edit", "edit"]
