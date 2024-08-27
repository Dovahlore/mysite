# Dovahlore Blog
## 概要
个人照片库+影视记录库
## 功能
### URL
网址可访问：www.dovahwall.cn
### DOVAHWALL 
照片墙，上传一些摄影作品。
登录后访问管理系统，可进行墙体调整。
支持TAG筛选。（在导航栏里）
### DOVAHBASE
影音记录，漫画、电影、剧集。
（登录后）支持检增删改查。
## 实现
基于Django+uwsgi+Nginx+mysql
利用docker实现容器化。
## 部署方法
安装docker环境，设置在compose/nginx/nginx.conf中设置监听server名。
运行docker compose
```
docker compose up
```
完成后连接数据库设置用户与密码（md5加密）
