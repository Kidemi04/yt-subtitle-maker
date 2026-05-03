from core.downloader.cookies import build_cookie_opts


def test_no_browser_no_path_returns_empty():
    assert build_cookie_opts(browser="", profile="", txt_path="") == {}


def test_browser_only_returns_cookiesfrombrowser():
    opts = build_cookie_opts(browser="firefox", profile="", txt_path="")
    assert opts == {"cookiesfrombrowser": ("firefox",)}


def test_browser_with_profile_includes_profile():
    opts = build_cookie_opts(browser="firefox", profile="Profile 1", txt_path="")
    assert opts == {"cookiesfrombrowser": ("firefox", "Profile 1")}


def test_txt_path_only_returns_cookiefile():
    opts = build_cookie_opts(browser="", profile="", txt_path="C:/cookies.txt")
    assert opts == {"cookiefile": "C:/cookies.txt"}


def test_browser_takes_precedence_over_txt_path():
    opts = build_cookie_opts(
        browser="firefox", profile="", txt_path="C:/cookies.txt"
    )
    assert "cookiesfrombrowser" in opts
    assert "cookiefile" not in opts
