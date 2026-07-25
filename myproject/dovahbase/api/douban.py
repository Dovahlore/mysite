import requests
import re
import hashlib
import json
from django.core.cache import cache
from openai import OpenAI
from bs4 import BeautifulSoup
import os
# ==================== AI 解析配置区 =====================
ALIYUN_API_KEY = os.getenv("OPENAI_API_KEY")
ALIYUN_BASE_URL =  os.getenv("OPENAI_BASE_URL")

# ====================================

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

            # 【兜底方案】保存你原本的解析逻辑，防止大模型接口挂掉时程序崩溃
            fallback_parts = h1_text.split(" ", 1)
            fallback_title = fallback_parts[0]
            fallback_original = fallback_parts[1] if len(fallback_parts) > 1 else h1_text

            try:
                client = OpenAI(api_key=ALIYUN_API_KEY, base_url=ALIYUN_BASE_URL)

                system_prompt = (
                    "你是一个专业的影视数据结构化引擎。请对用户提供的豆瓣标题进行精确拆分，分离出“本地化名称”与“外文原名”。\n"
                    "操作规范：\n"
                    "1. 格式强制：仅允许输出合法的JSON对象，数据结构限定为 {\"title\": \"本地化名称\", \"original_title\": \"外文原名\"}。\n"
                    "2. 纯净输出：严禁附加任何Markdown语法标记（如 ```json）或解释性文字。\n"
                    "3. 缺失处理：若源标题缺乏外文原名，则两个字段均需赋值为该本地化名称。\n"
                    "4. 忠于原文：输出的文本必须是对原始输入字符串的精准切片提取，严禁发生任何形式的字符篡改、意译、增删或自动纠错。"
                )

                # 关闭流式输出，直接拿结果
                response = client.chat.completions.create(
                    model="deepseek-v4-flash",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": h1_text}
                    ],
                    temperature=0.1,  # 低温度保证只做信息提取
                    stream=False
                )

                res_str = response.choices[0].message.content.strip()

                # 用正则把 JSON 抠出来（防大模型发癫带上 ```json 等前缀）
                json_match = re.search(r'\{.*\}', res_str, re.DOTALL)
                if json_match:
                    ai_parsed = json.loads(json_match.group(0))
                    data["title"] = ai_parsed.get("title", fallback_title)
                    data["original_title"] = ai_parsed.get("original_title", fallback_original)
                else:
                    data["title"] = fallback_title
                    data["original_title"] = fallback_original

            except Exception as e:
                print(f"[AI 解析标题超时或失败] 使用默认兜底逻辑。错误: {e}")
                data["title"] = fallback_title
                data["original_title"] = fallback_original
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
