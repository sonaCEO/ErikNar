from eriknar.core.config import Settings


def test_blank_optional_telegram_settings_are_treated_as_unset() -> None:
    settings = Settings(
        telegram_bot_token="",
        telegram_manager_chat_id="",  # type: ignore[arg-type]
    )

    assert settings.telegram_bot_token is None
    assert settings.telegram_manager_chat_id is None
