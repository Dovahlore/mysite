FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /mysite

# 1. 更换系统源为阿里云 (加速 apt)
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources

# 2. 安装基础依赖
# 增加了 curl, unzip 用于处理驱动
# 使用国内源更新系统软件（可选，只装最基础依赖）
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    default-libmysqlclient-dev \
    pkg-config \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------
# 3. 核心步骤：安装 Chrome 浏览器 + 在构建阶段下载 ChromeDriver
# ---------------------------------------------------------

# 4. 安装 Python 依赖 (清华源)
COPY requirements.txt /mysite/
RUN pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple \
    && pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 5. 复制代码
COPY . /mysite/

# 6. 启动
ENTRYPOINT ["sh", "-c", "python3 manage.py migrate && python3 manage.py collectstatic --noinput && exec uwsgi --ini /mysite/uwsgi.ini"]
