from core.stt import model_catalog as mc


def test_openai_whisper_uses_existing_checkpoint_check(monkeypatch):
    monkeypatch.setattr(mc, "check_whisper_model", lambda name: name == "turbo")

    state = mc.engine_model_state("openai-whisper")

    assert state["turbo"] is True
    assert state["tiny"] is False


def test_faster_whisper_uses_engine_cache_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(mc, "engine_cache_root", lambda: tmp_path)
    (tmp_path / "faster-whisper" / "turbo").mkdir(parents=True)

    state = mc.engine_model_state("faster-whisper")

    assert state["turbo"] is True
    assert state["large-v3"] is False


def test_mlx_whisper_uses_engine_cache_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(mc, "engine_cache_root", lambda: tmp_path)
    (tmp_path / "mlx-whisper" / "small").mkdir(parents=True)

    state = mc.engine_model_state("mlx-whisper")

    assert state["small"] is True
    assert state["base"] is False


def test_unsupported_engine_model_state_is_clear():
    try:
        mc.engine_model_state("not-real")
    except ValueError as exc:
        assert "unknown engine" in str(exc)
    else:
        raise AssertionError("expected ValueError")
