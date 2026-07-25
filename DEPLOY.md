# 安全更新部署（保留现有数据卷）

本项目的生产配置会将代码构建到 `web` 镜像中。数据库、Redis、用户上传文件和
收集后的静态文件分别保存在 Docker 命名卷中：

- `db_vol`：MySQL 数据
- `redis_vol`：Redis 数据
- `media_vol`：用户上传文件
- `static_vol`：Django `collectstatic` 输出

重建镜像或重建容器不会删除这些命名卷。不要执行 `docker compose down -v`、不要
手工删除卷，也不要在没有确认 Compose 项目名的情况下换部署目录。

## 1. 在旧服务器上确认当前项目名和实际卷名

进入当前正在运行的网站目录：

```bash
cd /当前/网站目录

docker inspect db --format \
  '{{ index .Config.Labels "com.docker.compose.project" }}'

docker inspect db --format \
  '{{ range .Mounts }}{{ println .Name "->" .Destination }}{{ end }}'
docker inspect web --format \
  '{{ range .Mounts }}{{ println .Name "->" .Destination }}{{ end }}'
docker inspect redis --format \
  '{{ range .Mounts }}{{ println .Name "->" .Destination }}{{ end }}'
```

记下第一条命令输出的 Compose 项目名。后续命令必须在原目录执行，并把当前容器
记录的项目名导出，避免临时构建目录改变项目名：

```bash
project_name="$(docker inspect db --format \
  '{{ index .Config.Labels "com.docker.compose.project" }}')"
test -n "$project_name"
export COMPOSE_PROJECT_NAME="$project_name"
echo "Using existing Compose project: $COMPOSE_PROJECT_NAME"
```

可以用下面的命令再次确认 Compose 将要使用的卷。其名称必须和
`docker inspect` 显示的一致：

```bash
docker compose config --volumes
docker volume ls
```

## 2. 更新前备份

备份会保存在当前部署目录，不会修改卷：

```bash
set -eu
umask 077

stamp="$(date +%Y%m%d-%H%M%S)"
backup_dir="$PWD/backups/$stamp"
mkdir -p "$backup_dir"

cp .env "$backup_dir/env.backup"
cp docker-compose.yml "$backup_dir/docker-compose.yml.backup"

docker compose exec -T db sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction --routines --triggers --all-databases' \
  > "$backup_dir/mysql-all.sql"

docker compose exec -T web \
  tar -C /mysite/media -czf - . \
  > "$backup_dir/media.tar.gz"

docker compose exec -T redis sh -c \
  'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" SAVE'
docker compose exec -T redis \
  tar -C /data -czf - . \
  > "$backup_dir/redis-data.tar.gz"

test -s "$backup_dir/mysql-all.sql"
test -s "$backup_dir/media.tar.gz"
test -s "$backup_dir/redis-data.tar.gz"
echo "Backup ready: $backup_dir"
```

建议再把整个 `backups/$stamp` 下载到另一台机器。只放在同一台服务器上不能防止
磁盘故障。

## 3. 服务器没有 Git 时同步 GitHub 代码

以下示例更新 `devs` 分支。先下载到临时目录，校验 Compose 配置，再覆盖程序文件。
`.env`、证书、备份目录和用户媒体不会被删除。

```bash
set -eu

deploy_dir="$PWD"
project_name="$(docker inspect db --format \
  '{{ index .Config.Labels "com.docker.compose.project" }}')"
test -n "$project_name"
export COMPOSE_PROJECT_NAME="$project_name"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

curl -fL \
  'https://github.com/Dovahlore/mysite/archive/refs/heads/devs.tar.gz' \
  -o "$work_dir/release.tar.gz"
tar -xzf "$work_dir/release.tar.gz" -C "$work_dir"
release_dir="$(find "$work_dir" -mindepth 1 -maxdepth 1 -type d | head -n 1)"

cp "$deploy_dir/.env" "$release_dir/.env"
docker compose \
  --project-directory "$release_dir" \
  -f "$release_dir/docker-compose.yml" \
  config --quiet
docker compose \
  --project-directory "$release_dir" \
  -f "$release_dir/docker-compose.yml" \
  build --pull web

rsync -a --delete \
  --exclude='.env' \
  --exclude='.git/' \
  --exclude='backups/' \
  --exclude='compose/nginx/cert/' \
  --exclude='myproject/media/' \
  "$release_dir/" "$deploy_dir/"
```

如果服务器没有 `rsync`，先安装它。不要直接解压覆盖整个目录，因为那样容易误删
服务器上的 `.env` 或 HTTPS 私钥。

## 4. 构建并切换到新版本

仍然在原部署目录、使用原 Compose 项目名：

```bash
docker compose config --quiet
docker compose up -d --remove-orphans
docker compose ps
docker compose logs --tail=100 web nginx
```

镜像已在临时目录中提前构建，因此同步文件后只需重建容器，切换时间会更短。正在
运行的旧容器不会因为新镜像构建完成而自动改变。

`web` 容器启动时会自动执行 Django 数据库迁移和 `collectstatic`。先完成第 2 步的
数据库备份，再执行本步骤。

这里不需要先运行 `docker compose down`。绝对不要添加 `-v`。

## 5. 本地开发

生产配置不再挂载宿主机源码。本地需要实时看到代码修改时，显式使用开发覆盖文件：

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

生产服务器只使用：

```bash
docker compose up -d --build
```
