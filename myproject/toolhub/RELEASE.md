# toolhub 工具发布指南（以吞食鱼 bfish 为例）

目标读者：**任何 agent（或人）**，拿到改好的工具代码后，照本文从第 1 步走到第 7 步即可安全发布到
www.dovahwall.cn。以 bfish（吞食鱼）为Running Example，流程对任何 drop-in 工具（cball 等）通用。
仓库里自带一键部署脚本：`myproject/toolhub/scripts/deploy.py`（见第 4 步）。

## 0. 环境档案（前提）

| 项 | 值 |
| --- | --- |
| 站点源码树 | `D:\mayuq\OneDrive - bupt.edu.cn\Projects\docker-mysite`（git 分支 `devs`，远端 github.com/Dovahlore/mysite） |
| 工具目录 | `myproject/toolhub/static/tools/<id>/`（tool.json + index.html + 任意 js/资源） |
| 服务器 | `8.152.162.201`（www.dovahwall.cn），用户 `root`，**SSH 必须用 paramiko**（本机 ssh.exe 被静默拦截） |
| SSH 私钥 | `C:/Users/mayuq/.ssh/id_rsa` |
| 服务器项目目录 | `/home/dovahlore/Documents/docker-mysite`（compose 栈：web/nginx/db/redis/scheduler + 无关服务） |
| 本地 dev 栈 | `cd 站点根 && docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`（**必须带两个 -f**，dev 覆盖不会自动加载；bind mount 实时代码，http://127.0.0.1:8080） |
| 镜像命名 | `<工具>-v<N>-<YYYYMMDD>`，如 `bfish-v6-20261111`（全名 `docker-mysite-app:<tag>`） |

**红线**：`dovime-20261109` 镜像是 scheduler 容器在用的，任何时候不要删；服务器上 db/redis/数据卷零接触。

## 1. 确认改动清单

```powershell
cd 'D:\mayuq\OneDrive - bupt.edu.cn\Projects\docker-mysite'
git status --short          # 看本次改了/加了/删了哪些文件
```

- **纯新增/修改**（最顺路径）：直接往下走。
- **有删除**（下线文件或整个工具）：记住被删路径，第 4 步必须带 `--rm`，且第 5 步后要清 collectstatic 卷残留（见下）。

tool.json 可改 `name/description`（墙卡文案随发布自动更新），字段规范见 `myproject/toolhub/README.md`。

## 2. 发布前检查（本地，全过才许往下）

```powershell
# a) 语法：每个 .js 过一遍（含 index.html 内联脚本：导出后一并 check）
#    （参考脚本：AutoClaw 工作区 _work/check_bfish_v6.py 的做法——正则抓 <script> 无 src 的块导出为 js 再 check）
node --check <每个改动过的 js>

# b) 引用完整性：index.html 的 <script src> 覆盖所有新文件；无 http(s) 外链；无 fetch/XHR/WebSocket
#    （游戏必须是自包含纯前端；Web Worker 用 new URL('xx.js', document.currentScript.src) 同目录加载是允许的）

# c) 本地栈收集 + 全量测试
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T web sh -c "cd /mysite && python manage.py collectstatic --no-input && python manage.py test --no-input"
# 基线 87 测全绿（2026-11-11）；toolhub 测试不依赖具体游戏内容，一般直接绿

# d) HTTP 冒烟（127.0.0.1:8080）：主页墙卡出现新描述、/s/t/<id>/ 200、每个新 js 200
```

**PowerShell 铁律**：内联 `python -c "..."` 带引号/大括号必炸，一律写 .py 脚本文件再执行。

## 3. git 提交推送

```powershell
git add myproject/toolhub
git commit -m "bfish vN: <一句话改动>"
git push origin devs
```

GitHub 443 经常抖（Connection reset/timeout）：push 失败不阻塞发布（部署走镜像不走 git），但要把
「devs 领先 origin N commit 待补推」记进交付报告，网络恢复后补推。

## 4. 构建 + 部署（一键脚本）

```powershell
cd 'D:\mayuq\OneDrive - bupt.edu.cn\Projects\docker-mysite'
python myproject\toolhub\scripts\deploy.py --tag docker-mysite-app:bfish-v7-20261112
# base 缺省自动取服务器当前 APP_IMAGE（增量基座）
# 有删除时：--rm /mysite/toolhub/static/tools/<被删路径>
# 额外要验证的路径可加：--verify-path /static/tools/bfish/streaming-worker.js
# 只想预检不部署：--dry-run --base docker-mysite-app:<现tag>
```

脚本内部流程（等价手工步骤，排查时对照）：

1. 在 `myproject/Dockerfile.update` 写 `FROM <base>`（+删除时的 `RUN rm -rf <路径>`）`+ COPY . /mysite/`；
2. `docker build -f myproject/Dockerfile.update -t <tag> myproject`；
3. `docker save | gzip`（流式）→ paramiko SFTP 上传 `/tmp/*.tar.gz` → 服务器 `docker load`；
4. `sed -i 's|^APP_IMAGE=.*|APP_IMAGE=<tag>|' .env && docker compose up -d --no-deps web`（**只动 web**）；
5. 等 ~35s（容器启动自动跑 collectstatic，期间 curl 会 502 属正常）→ `docker compose restart nginx`；
6. 线上验证（见第 5 步清单）→ 清服务器 tar。

### 两条增量镜像铁律（踩过坑）

- **COPY 只覆盖不删除**：基础镜像里已删的文件会原样留在新镜像里（registry 会一直发现它）。
  本次有任何删除 → Dockerfile 必须加 `RUN rm -rf <路径>` 再 COPY。
- **collectstatic 卷残留**：静态卷跨容器保留且 collectstatic 从不清理已删源文件。
  删除工具/文件后必须补一刀：
  `docker compose exec -T web sh -c "rm -rf /mysite/collect_static/tools/<旧工具目录>"`。

## 5. 线上验证清单（https://www.dovahwall.cn）

- [ ] 主页 200，工具墙卡描述已是新版文案
- [ ] `/s/t/<id>/` 工具页 200
- [ ] 每个 js 模块（含 Web Worker 文件）`/static/tools/<id>/<文件>` 200
- [ ] 健康邻居：`/s/t/cball/` 200、`/s/ime` 200
- [ ] 已下线工具仍 404（如 `/s/t/g2048/`）
- [ ] 删除场景额外确认：旧静态文件 404 + 卷内无残留（`docker compose exec web ls /mysite/collect_static/tools/`）

## 6. 收尾

```powershell
# a) 服务器删被替换的旧镜像（先核对零引用：docker ps -a 的 Image 列表 + .env；dovime-20261109 别动！）
docker rmi docker-mysite-app:<旧tag>
# b) 本地 .env 的 APP_IMAGE 同步成新 tag（保持本地栈与生产一致）
# c) 服务器/本地临时 tar 清理（脚本已自动）
```

## 7. 回滚

- 旧镜像还在：服务器 `.env` 的 APP_IMAGE 改回旧 tag + `docker compose up -d --no-deps web`，30 秒内生效。
- 旧镜像已删：`git checkout <上一发布 commit> -- myproject/toolhub/static/tools/<id>` 恢复文件，按本文重发一版即可
  （内容型回滚，无历史风险）。

## 附：本次管线沉淀史

V4（潮汐远征，纯新增）→ g2048 下线（删除场景，踩出两条铁律）→ V6（深蓝群域，模块化+Web Worker，纯增量）。
当前生产镜像 `bfish-v6-20261111`；演进与脚本（check/deploy/cleanup 族）见各次发布记录。
