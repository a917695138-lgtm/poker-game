# 德州扑克 - 部署包

## 快速部署指南

### 方法 1: Vercel（最简单，2分钟）

1. 访问 https://vercel.com/new
2. 下载本项目文件夹 `poker-perfect`
3. 拖拽上传到 Vercel
4. 自动获得链接

### 方法 2: Netlify（也很简单）

1. 访问 https://app.netlify.com/drop
2. 将整个 `poker-perfect` 文件夹压缩为 zip
3. 拖拽上传
4. 获得链接

### 方法 3: Render（推荐，功能最全）

需要 GitHub 账号：
1. 创建 GitHub 仓库
2. 上传代码
3. 连接 Render

详见 DEPLOY.md

---

## ⚠️ 重要提示

由于我无法直接访问你的 GitHub/Render 账号，需要你手动完成最后一步部署。

**最简单的方案**：
1. 把 `poker-perfect` 文件夹压缩为 `poker-perfect.zip`
2. 访问 https://app.netlify.com/drop
3. 拖拽上传 zip 文件
4. 立即获得游戏链接！

---

## 项目文件清单

- package.json - Node.js 配置
- server.js - WebSocket 服务器
- public/index.html - 游戏界面
- public/game.js - 游戏逻辑
- README.md - 完整文档

---

祝你玩得开心！🎉
