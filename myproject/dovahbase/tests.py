import requests
import re
import hashlib
import time
from urllib.parse import urlparse, parse_qs


def calc_sol(cha, difficulty=4):
    """
    模拟豆瓣 JS PoW
    """
    nonce = 0
    target = "0" * difficulty

    while True:
        h = hashlib.sha512(f"{cha}{nonce}".encode()).hexdigest()
        if h.startswith(target):
            return nonce
        nonce += 1


def build_session():
    s = requests.Session()
    s.headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://movie.douban.com/",
    }
    return s


def fetch_with_sec(url):
    s = build_session()

    r = s.get(url, allow_redirects=False, timeout=10)

    # ---- 没触发风控 ----
    if r.status_code == 200:
        return r.text

    # ---- 触发 sec ----
    if r.status_code in (301, 302):
        sec_url = r.headers.get("Location")
        if not sec_url.startswith("http"):
            sec_url = "https://sec.douban.com" + sec_url

        sec_page = s.get(sec_url, timeout=10)

        # --- 替换解析 ---
        tok, cha, red = parse_sec_form(sec_page.text)
        sol = calc_sol(cha)
        payload = {"tok": tok, "cha": cha, "sol": sol, "red": red}
        r2 = s.post("https://sec.douban.com/c", data=payload, timeout=10)
        final = s.get(red, timeout=10)
        return final.text

    raise Exception(f"unexpected status {r.status_code}")

from bs4 import BeautifulSoup

def parse_sec_form(html):
    """
    从 sec 页面解析 tok/cha/red
    """
    soup = BeautifulSoup(html, "html.parser")
    form = soup.find("form", id="sec")
    if not form:
        raise Exception("sec form not found")

    tok = form.find("input", id="tok")["value"]
    cha = form.find("input", id="cha")["value"]
    red = form.find("input", id="red")["value"]
    return tok, cha, red

# ------------------ 使用 ------------------

if __name__ == "__main__":
    url = "https://movie.douban.com/subject/3541415/"
    html = fetch_with_sec(url)
    soup = BeautifulSoup(html, "html.parser")
    print(soup.prettify())