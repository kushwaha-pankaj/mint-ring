from . import mesh


def test_rodin_provider_is_valid_and_labelled(monkeypatch):
    monkeypatch.setenv("DESIGN_MESH", "rodin")
    provider = mesh.resolve_provider(
        angles_in_pack=True,
        angle_count=4,
        cardinal_view_count=4,
        distinct_cardinal_count=4,
    )

    assert provider == "rodin"
    assert mesh.provider_label(provider) == "Hyper3D Rodin Gen-2 3D"


def test_auto_prefers_rodin_when_cardinal_views_are_available(monkeypatch):
    monkeypatch.setenv("DESIGN_MESH", "auto")
    provider = mesh.resolve_provider(
        angles_in_pack=True,
        angle_count=4,
        cardinal_view_count=4,
        distinct_cardinal_count=4,
    )

    assert provider == "rodin"
