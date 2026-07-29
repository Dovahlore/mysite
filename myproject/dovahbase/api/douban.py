import requests
import re
import hashlib
import json
from django.core.cache import cache
from bs4 import BeautifulSoup
from mysite.ai_models import fast_model_providers


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
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
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


TITLE_SPLIT_SYSTEM_PROMPT = (
    "你是一个专业的影视数据结构化引擎。请对用户提供的豆瓣标题进行精确拆分，"
    "分离出“本地化名称”与“外文原名”。\n"
    "操作规范：\n"
    "1. 格式强制：仅允许输出合法的JSON对象，数据结构限定为 "
    "{\"title\": \"本地化名称\", \"original_title\": \"外文原名\"}。\n"
    "2. 纯净输出：严禁附加任何Markdown语法标记或解释性文字。\n"
    "3. 缺失处理：若源标题缺乏外文原名，则两个字段均需赋值为该本地化名称。\n"
    "4. 忠于原文：输出文本必须是原始输入的精准切片，严禁篡改、意译、增删或纠错。"
)


def _split_douban_title(h1_text):
    fallback_parts = h1_text.split(" ", 1)
    fallback_title = fallback_parts[0]
    fallback_original = fallback_parts[1] if len(fallback_parts) > 1 else h1_text

    from openai import OpenAI

    try:
        providers = fast_model_providers()
    except ValueError as exc:
        print(f"[fast provider configuration failed] {exc}")
        return fallback_title, fallback_original

    for provider in providers:
        try:
            client = OpenAI(
                api_key=provider["api_key"],
                base_url=provider["base_url"],
                timeout=provider.get("timeout", 15.0),
                max_retries=provider.get("max_retries", 0),
            )
            response = client.chat.completions.create(
                model=provider["model"],
                messages=[
                    {"role": "system", "content": TITLE_SPLIT_SYSTEM_PROMPT},
                    {"role": "user", "content": h1_text},
                ],
                temperature=0.1,
                stream=False,
            )
            content = response.choices[0].message.content
            json_match = re.search(r"\{.*\}", str(content or ""), re.DOTALL)
            if not json_match:
                raise ValueError("model response does not contain a JSON object")

            parsed = json.loads(json_match.group(0))
            title = parsed.get("title")
            original_title = parsed.get("original_title")
            if (
                not isinstance(title, str)
                or not title
                or not isinstance(original_title, str)
                or not original_title
                or title not in h1_text
                or original_title not in h1_text
            ):
                raise ValueError("model response is not an exact title substring")

            return title, original_title
        except Exception as exc:
            print(f"[{provider['name']} title split failed] {exc}")

    return fallback_title, fallback_original


def _run_douban_spider_uncached(keyword, cat="1002"):
    data = {
        'success': False,
        'error': '',
        'title': '',
        'original_title': '',
        'year': '',
        'aliases': [],
        'poster_url': '',
        'genres': []
    }

    try:
        # 创建会话（curl‑cffi 支持 TLS 指纹模拟）
        session = requests.Session()

        headers_base = {
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": "https://movie.douban.com/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        }

        # --- 搜索页 ---
        search_url = "https://www.douban.com/search"
        params = {"cat": cat, "q": keyword}

        resp = session.get(
            search_url,
            params=params,
            headers={
                **headers_base,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            },
            timeout=15
        )

        if resp.status_code != 200:
            data["error"] = f"搜索页面返回状态 {resp.status_code}"
            return data

        soup = BeautifulSoup(resp.text, "html.parser")

        # 找第一个搜索结果
        result_node = soup.select_one(".result")
        if not result_node:
            result_node = soup.select_one(".result-list .result")

        if not result_node:
            data["error"] = "未找到相关电影"
            return data

        link_tag = result_node.select_one(".content .title a")
        if not link_tag:
            data["error"] = "搜索结果中找不到链接"
            return data

        raw_href = link_tag.get("href", "")
        id_match = re.search(r"subject(?:/|%2F)(\d+)", raw_href)
        if not id_match:
            data["error"] = "无法解析 ID"
            return data
        print(f"movie id {id_match}")
        movie_id = id_match.group(1)
        detail_url = f"https://movie.douban.com/subject/{movie_id}/"

        html = fetch_with_sec(detail_url)

        soup_detail = BeautifulSoup(html, "html.parser")

        # ==================================================
        # 1. 标题 (✨ 此处已替换为大模型 AI 解析逻辑 ✨)
        # ==================================================
        h1_span = soup_detail.select_one('h1 span[property="v:itemreviewed"]')
        if h1_span:
            h1_text = h1_span.get_text(strip=True)
            data["title"], data["original_title"] = _split_douban_title(h1_text)
        # ==================================================

        # 2. 年份
        year_span = soup_detail.select_one(".year")
        if year_span:
            data["year"] = year_span.get_text(strip=True).strip("()")

        # 3. 类型
        data["genres"] = [
            g.get_text(strip=True)
            for g in soup_detail.select('span[property="v:genre"]')
        ]

        # 4. 又名
        info_div = soup_detail.select_one("#info")
        if info_div:
            for span in info_div.find_all("span", class_="pl"):
                if "又名" in span.get_text():
                    raw_text = span.next_sibling
                    if raw_text:
                        text_clean = raw_text.strip()
                        if text_clean:
                            data["aliases"] = [
                                x.strip()
                                for x in text_clean.split("/")
                                if x.strip()
                            ]
                    break

        # 5. 海报（直接从详情页拿）
        main_pic = soup_detail.select_one("#mainpic img")
        if main_pic:
            low_url = main_pic.get("src")
            high_url = re.sub(r'/s_ratio_.*?/', '/m/', low_url)
            high_url = re.sub(r'jpg', 'webp', high_url)
            data["poster_url"] = high_url

        # 6. 首次
        release_dates = soup_detail.select('span[property="v:initialReleaseDate"]')
        if release_dates:
            # 提取所有日期
            dates = []
            for date_span in release_dates:
                date_str = date_span.get('content', '')  # 获取 content 属性
                date_match = re.match(r'(\d{4}-\d{2}-\d{2})', date_str)
                if date_match:
                    dates.append(date_match.group(1))

            # 找到最早的日期
            if dates:
                earliest_date = min(dates)
                data["date"] = earliest_date[:7]

        data["success"] = True
        return data

    except Exception as e:
        data["error"] = str(e)
        return data


def run_douban_spider(keyword, cat="1002"):
    """Cache costly Douban and model lookups by normalized search input."""
    normalized = " ".join(str(keyword).strip().lower().split())
    digest = hashlib.sha256(f"{cat}:{normalized}".encode("utf-8")).hexdigest()
    cache_key = f"douban:lookup:v1:{digest}"

    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    result = _run_douban_spider_uncached(keyword, cat)
    # Successful metadata is stable. Briefly cache failures so temporary
    # upstream errors do not linger while repeated clicks are still absorbed.
    timeout = 12 * 60 * 60 if result.get("success") else 3 * 60
    cache.set(cache_key, result, timeout=timeout)
    return result
