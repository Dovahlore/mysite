FROM python:3.10.13
MAINTAINER dovahlore
 # 设置 python 环境变量
ENV PYTHONUNBUFFERED 1
# 容器内创建项目目录
RUN mkdir -p /mysite
WORKDIR /mysite
# 将当前目录下文件 放入容器指定目录
ADD . /mysite
# 更新pip
RUN /usr/local/bin/python -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple

# 安装依赖
RUN pip3 install -r requirements.txt -i  https://pypi.tuna.tsinghua.edu.cn/simple/


# 启动项目脚本 增加执行权限
ENTRYPOINT WORKDIR /mysite && ADD . /mysite
ENTRYPOINT python3 manage.py makemigrations && python3 manage.py migrate && uwsgi --ini /mysite/uwsgi.ini
