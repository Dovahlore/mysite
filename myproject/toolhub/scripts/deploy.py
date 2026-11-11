# -*- coding: utf-8 -*-
"""toolhub 站点工具发布脚本：增量镜像 → 服务器 → 线上验证。

用法（Windows PowerShell，站点根目录执行）：
  python myproject\\toolhub\\scripts\\deploy.py --tag bfish-v7-20261112
      # base 缺省 = 服务器 .env 当前 APP_IMAGE；tag 自动补 docker-mysite-app: 前缀
  python myproject\\toolhub\\scripts\\deploy.py --tag xxx --base docker-mysite-app:bfish-v6-20261111
  python myproject\\toolhub\\scripts\\deploy.py --tag xxx --rm /mysite/toolhub/static/tools/<旧目录>
      # --rm 可多次：本次要删除的路径（镜像内），删除场景必带（COPY 不删除文件）
  python myproject\\toolhub\\scripts\\deploy.py --tag xxx --verify-path /static/tools/bfish/streaming-worker.js
      # --verify-path 可多次：额外要求线上 200 的路径
  python myproject\\toolhub\\scripts\\deploy.py --tag xxx --base <现tag> --dry-run
      # 预检：只做本地检查并打印 Dockerfile，不构建不部署

前提：本机 docker 可用；python 装了 paramiko；SSH 私钥可达（默认 C:/Users/mayuq/.ssh/id_rsa）。
流程与坑的完整说明见 myproject/toolhub/RELEASE.md。
"""
import argparse
import gzip
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

import paramiko

HERE = os.path.dirname(os.path.abspath(__file__))
SITE_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
MYPROJECT = os.path.join(SITE_ROOT, "myproject")
DOCKERFILE = os.path.join(MYPROJECT, "Dockerfile.update")

HOST, USER = "8.152.162.201", "root"
DEFAULT_KEY = r"C:/Users/mayuq/.ssh/id_rsa"
REMOTE_SITE = "/home/dovahlore/Documents/docker-mysite"
BASE_PREFIX = "docker-mysite-app:"
HOME_URL = "https://www.dovahwall.cn"

STEPS_OK = True


def step(label, cond, detail=""):
    global STEPS_OK
    print("[%s] %s%s" % ("OK " if cond else "FAIL", label, (" -- " + detail) if detail else ""), flush=True)
    STEPS_OK = STEPS_OK and bool(cond)
    return cond


def ssh_connect(key):
    cli = paramiko.SSHClient()
    cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    cli.connect(HOST, username=USER, key_filename=key, timeout=30)
    return cli


def run(cli, cmd, timeout=600):
    _in, out, err = cli.exec_command(cmd, timeout=timeout)
    rc = out.channel.recv_exit_status()
    return rc, out.read().decode("utf-8", "replace").strip(), err.read().decode("utf-8", "replace").strip()


def image_exists_local(tag):
    p = subprocess.run(["docker", "images", "-q", tag], capture_output=True, text=True)
    return bool(p.stdout.strip())


def full_tag(tag):
    return tag if tag.startswith(BASE_PREFIX) else BASE_PREFIX + tag


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tag", required=True, help="新镜像 tag（自动补 docker-mysite-app: 前缀）")
    ap.add_argument("--base", help="基础镜像 tag；缺省=服务器 .env 的 APP_IMAGE")
    ap.add_argument("--rm", action="append", default=[], help="镜像内要删除的路径，可多次")
    ap.add_argument("--verify-path", action="append", default=[], help="额外要求线上 200 的路径，可多次")
    ap.add_argument("--key", default=DEFAULT_KEY, help="SSH 私钥路径")
    ap.add_argument("--dry-run", action="store_true", help="预检：不写 Dockerfile 不构建不部署")
    args = ap.parse_args()

    tag = full_tag(args.tag)

    # ---- 1) 解析 base ----
    cli = None
    base = full_tag(args.base) if args.base else None
    if base is None:
        try:
            cli = ssh_connect(args.key)
            env = run(cli, "grep '^APP_IMAGE=' %s/.env" % REMOTE_SITE)[1]
            m = re.search(r"APP_IMAGE=(\S+)", env)
            if not m:
                step("解析服务器 APP_IMAGE", False, env or "(empty)")
                sys.exit(1)
            base = m.group(1)
        finally:
            if cli:
                cli.close()
    print("新镜像: %s\n基座:   %s" % (tag, base))

    # ---- 2) 本地预检 ----
    step("站点树存在", os.path.isdir(MYPROJECT), MYPROJECT)
    step("基座镜像本地存在", image_exists_local(base),
         "不存在时：确认 tag 拼写，或该基座需先在本机构建/推送（见 RELEASE.md）")
    dirty = subprocess.run(["git", "-C", SITE_ROOT, "status", "--short"],
                           capture_output=True, text=True).stdout.strip()
    if dirty:
        print("[提醒] 工作树有未提交改动（发布前建议按 RELEASE.md 第 3 步先 commit）:")
        print("\n".join("    " + l for l in dirty.splitlines()[:10]))
    if not STEPS_OK:
        sys.exit(1)

    # ---- 3) Dockerfile.update ----
    lines = ["FROM %s" % base] + ["RUN rm -rf %s" % p for p in args.rm] + ["COPY . /mysite/"]
    content = "\n".join(lines) + "\n"
    if args.dry_run:
        print("\n[dry-run] 将写入 %s：\n%s" % (DOCKERFILE, content))
        print("[dry-run] 预检通过，未做任何写操作。")
        sys.exit(0)
    with open(DOCKERFILE, "w", encoding="ascii", newline="\n") as f:
        f.write(content)
    with open(DOCKERFILE, "r") as f:
        step("Dockerfile.update 写入", f.read() == content)

    # ---- 4) 构建 ----
    p = subprocess.run(["docker", "build", "-f", DOCKERFILE, "-t", tag, MYPROJECT],
                       capture_output=True, text=True)
    step("docker build", p.returncode == 0, (p.stdout or p.stderr).splitlines()[-1][:120] if (p.stdout or p.stderr) else "")
    if p.returncode != 0:
        print(p.stdout[-3000:]); print(p.stderr[-3000:])
        sys.exit(1)

    # ---- 5) 传输 + 部署 ----
    tmp = tempfile.mkdtemp(prefix="toolhub_deploy_")
    tar = os.path.join(tmp, "image.tar.gz")
    try:
        print("docker save | gzip ...", flush=True)
        p1 = subprocess.Popen(["docker", "save", tag], stdout=subprocess.PIPE)
        with gzip.open(tar, "wb") as f:
            while True:
                chunk = p1.stdout.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
        p1.wait()
        step("docker save", p1.returncode == 0 and os.path.getsize(tar) > 10 ** 6,
             "%.1f MB" % (os.path.getsize(tar) / 1e6))

        cli = ssh_connect(args.key)
        try:
            t0 = time.time()
            sftp = cli.open_sftp()
            sftp.put(tar, "/tmp/toolhub_deploy.tar.gz")
            sftp.close()
            step("SFTP 上传", True, "%.0fs" % (time.time() - t0))

            rc, o, e = run(cli, "docker load -i /tmp/toolhub_deploy.tar.gz")
            step("docker load", rc == 0 and tag in (o + e), (o or e).splitlines()[-1] if (o or e) else "")

            rc, o, e = run(cli, "cd %s && sed -i 's|^APP_IMAGE=.*|APP_IMAGE=%s|' .env && "
                                "docker compose up -d --no-deps web" % (REMOTE_SITE, tag), timeout=300)
            step("切 .env 并 up web", rc == 0, o or e)

            print("等待 collectstatic（~35s，期间 502 正常）...", flush=True)
            time.sleep(35)
            rc, o, e = run(cli, "cd %s && docker compose restart nginx" % REMOTE_SITE, timeout=180)
            step("重启 nginx", rc == 0)
            time.sleep(5)

            # ---- 6) 线上验证（服务器侧 curl，公网域名） ----
            def get(path, follow=True):
                cmd = "curl -sk%s -o /dev/null -w '%%{http_code}' %s%s" % (
                    "L" if follow else "", HOME_URL, path)
                return run(cli, cmd, timeout=60)[1].strip()

            home_body = run(cli, "curl -sk %s/" % HOME_URL, timeout=60)[1]
            step("主页 200 且工具墙渲染", "/s/t/" in home_body)
            tool_ids = sorted(set(re.findall(r'href="/s/t/([a-z0-9_-]+)/"', home_body)))
            for tid in tool_ids:
                got = get("/s/t/%s/" % tid)
                step("工具页 /s/t/%s/ 200" % tid, got == "200", "got " + got)
            step("/s/ime 200", get("/s/ime") == "200", "got " + get("/s/ime"))
            for vp in args.verify_path:
                got = get(vp)
                step("附加验证 %s 200" % vp, got == "200", "got " + got)

            # 删除场景：collectstatic 卷残留清理提示 + 执行
            if args.rm:
                for path in args.rm:
                    m = re.search(r"/static/(tools/[^/]+/[^/]+)", path)
                    if m:
                        rc, o, e = run(cli, "cd %s && docker compose exec -T web rm -rf /mysite/collect_static/%s"
                                       % (REMOTE_SITE, m.group(1)))
                        step("清卷残留 %s" % m.group(1), rc == 0, o or e)

            run(cli, "rm -f /tmp/toolhub_deploy.tar.gz")
            step("服务器 tar 已清", run(cli, "ls /tmp/toolhub_deploy.tar.gz 2>/dev/null | wc -l")[1].strip() == "0")

            print("\n=== 服务器现存 mysite 镜像 ===")
            print(run(cli, "docker images docker-mysite-app --format '{{.Tag}}'")[1])
            print("\n[收尾提示]")
            print("  1) 确认零引用后删旧镜像（dovime-20261109 是 scheduler 在用，勿删）:")
            print("     docker rmi %s" % base)
            print("  2) 本地 .env 的 APP_IMAGE 同步为 %s" % tag)
            print("  3) 按 RELEASE.md 第 3 步 commit/push（Dockerfile.update 记得随发布提交）")
        finally:
            cli.close()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    sys.exit(0 if STEPS_OK else 1)


if __name__ == "__main__":
    main()
