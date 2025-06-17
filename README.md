## **项目介绍**

本项目基于 [garethgeorge/backrest](https://github.com/garethgeorge/backrest) 项目汉化。

Backrest 是基于 [restic](https://restic.net/) 构建的可通过网页访问的备份解决方案。Backrest 提供了一个封装 restic 命令行的 WebUI，方便创建仓库、浏览快照和恢复文件。此外，Backrest 还可以在后台运行，提供自动调度快照和管理仓库健康的功能。

通过利用 restic 成熟、高速、可靠且安全的备份能力，Backrest 增加了一个直观易用的界面。

Backrest 使用 Go 语言开发，作为单一的轻量级二进制程序发布，仅依赖 restic。它能够安全地创建新仓库或管理现有仓库。存储配置完成后，WebUI 处理大多数操作，同时也支持直接使用强大的 [restic CLI](https://restic.readthedocs.io/en/latest/manual_rest.html) 进行高级操作。

## 主要特性

- **网页界面**：可本地或远程访问（适合 NAS 部署）
- **多平台支持**：
  - Linux 64 位
  - Windows 64 位
  - [Docker](https://hub.docker.com/r/garethgeorge/backrest)
- **备份管理**：
  - 导入现有 restic 仓库
  - 定时备份和维护（如 prune、check、forget 等）
  - 浏览快照和恢复文件
  - 支持通知（Discord、Slack、Shoutrrr、Gotify、Healthchecks）
  - 支持备份前后执行自定义脚本
- **存储支持**：
  - 兼容 rclone 远程存储
  - 支持所有 restic 存储后端（S3、B2、Azure、GCS、本地、SFTP 等）

------

# 用户指南

[查看 Backrest 官方文档](https://garethgeorge.github.io/backrest/introduction/getting-started)。

# 安装

Backrest 打包为单个可执行文件，可直接运行于 Linux 和 Windows 64 位系统。首次运行时会下载并安装 restic。

### 快速启动选项

1. **预编译版本**：从 [发行页面](https://github.com/garethgeorge/backrest/releases) 下载
2. **Docker**：使用 `garethgeorge/backrest:latest` 镜像 ([Docker Hub](https://hub.docker.com/r/garethgeorge/backrest))
   - 包含 rclone 及常用 Unix 工具
   - 轻量版镜像使用 `garethgeorge/backrest:scratch`
3. **从源码编译**：见下文“编译”章节

安装完成后，访问 `http://localhost:9898`（默认端口）。首次启动会提示创建用户名和密码。

> [!注意]
>  如需修改默认端口，请设置环境变量 `BACKREST_PORT`（例如 `BACKREST_PORT=0.0.0.0:9898` 以监听所有接口）。
>  Backrest 会使用系统中已安装且兼容的 restic，如无则自动下载并更新。你也可以通过设置 `BACKREST_RESTIC_COMMAND` 指定 restic 路径。

### Docker Compose 示例配置

```
yaml复制编辑version: "3.8"
services:
  backrest:
    image: garethgeorge/backrest:latest
    container_name: backrest
    hostname: backrest
    volumes:
      - ./backrest/data:/data
      - ./backrest/config:/config
      - ./backrest/cache:/cache
      - ./backrest/tmp:/tmp
      - /path/to/backup/data:/userdata
      - /path/to/local/repos:/repos
    environment:
      - BACKREST_DATA=/data
      - BACKREST_CONFIG=/config/config.json
      - XDG_CACHE_HOME=/cache
      - TMPDIR=/tmp
      - TZ=America/Los_Angeles
    ports:
      - "9898:9898"
    restart: unless-stopped
```

## Linux 平台运行

1. 下载最新发行版：[发行页面](https://github.com/garethgeorge/backrest/releases)

2. 安装方式：

   a) 推荐使用安装脚本：

   ```
   sh复制编辑mkdir backrest && tar -xzvf backrest_Linux_x86_64.tar.gz -C backrest
   cd backrest && sudo ./install.sh
   ```

   脚本会：

   - 将 Backrest 二进制文件移动到 `/usr/local/bin`
   - 创建并启动 systemd 服务

   b) 手动使用 systemd：

   ```
   sh复制编辑sudo mv backrest /usr/local/bin/backrest
   sudo tee /etc/systemd/system/backrest.service > /dev/null <<EOT
   [Unit]
   Description=Backrest
   After=network.target
   
   [Service]
   Type=simple
   User=$(whoami)
   ExecStart=/usr/local/bin/backrest
   Environment="BACKREST_PORT=127.0.0.1:9898"
   
   [Install]
   WantedBy=multi-user.target
   EOT
   sudo systemctl enable --now backrest
   ```

   c) 使用 cron 简单启动：

   ```
   sh复制编辑sudo mv backrest /usr/local/bin/backrest
   (crontab -l 2>/dev/null; echo "@reboot /usr/local/bin/backrest") | crontab -
   ```

3. 访问 `http://localhost:9898` 验证运行
    systemd 服务状态查看：`sudo systemctl status backrest`

> [!注意]
>  systemd 中默认仅监听 localhost，如需监听所有接口，执行 `sudo systemctl edit backrest` 并添加：
>
> ```
> ini复制编辑[Service]
> Environment="BACKREST_PORT=0.0.0.0:9898"
> ```
>
> 保存后执行 `sudo systemctl daemon-reload` 和 `sudo systemctl restart backrest`

## Windows 平台运行

1. 从 [发行页面](https://github.com/garethgeorge/backrest/releases) 下载 Windows 安装程序 `Backrest-setup-x86_64.exe`
2. 安装程序会将 Backrest 及托盘应用安装到 `%localappdata%\Programs\Backrest\`
3. 托盘应用会随登录启动，监控 Backrest 状态

> [!提示]
>  如需修改默认端口，安装前设置用户环境变量 `BACKREST_PORT`，路径：设置 > 关于 > 高级系统设置 > 环境变量，新增用户变量，值为 `127.0.0.1:端口号`（如 `127.0.0.1:8080`）
>  安装后需更改端口时，重新运行安装程序更新快捷方式。

# 配置

## Unix 系统环境变量

| 变量                      | 说明              | 默认值                                                      |
| ------------------------- | ----------------- | ----------------------------------------------------------- |
| `BACKREST_PORT`           | 绑定端口          | 127.0.0.1:9898（Docker 镜像为 0.0.0.0:9898）                |
| `BACKREST_CONFIG`         | 配置文件路径      | `$HOME/.config/backrest/config.json`                        |
| `BACKREST_DATA`           | 数据目录路径      | `$HOME/.local/share/backrest`                               |
| `BACKREST_RESTIC_COMMAND` | restic 二进制路径 | Backrest 管理的 restic 版本，位于 `$XDG_DATA_HOME/backrest` |
| `XDG_CACHE_HOME`          | 缓存目录路径      |                                                             |



## Windows 系统环境变量

| 变量                      | 说明              | 默认值                                                 |
| ------------------------- | ----------------- | ------------------------------------------------------ |
| `BACKREST_PORT`           | 绑定端口          | 127.0.0.1:9898                                         |
| `BACKREST_CONFIG`         | 配置文件路径      | `%appdata%\backrest`                                   |
| `BACKREST_DATA`           | 数据目录路径      | `%appdata%\backrest\data`                              |
| `BACKREST_RESTIC_COMMAND` | restic 二进制路径 | Backrest 管理的 restic，位于 `C:\Program Files\restic` |
| `XDG_CACHE_HOME`          | 缓存目录路径      |                                                        |
