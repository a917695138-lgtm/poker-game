# 德州扑克 - 完美实时对战版 部署指南

## 🎉 项目已完成

**项目位置**: `C:\Users\ao\.qclaw\workspace\poker-perfect\`

### 文件结构
```
poker-perfect/
├── package.json          # 依赖配置
├── server.js             # WebSocket 服务器 (25KB)
├── README.md             # 完整文档
└── public/
    ├── index.html        # 游戏界面 (15KB)
    └── game.js           # 游戏逻辑 (18KB)
```

---

## 🚀 部署到 Render（推荐 - 免费）

### 步骤 1: 上传代码到 GitHub

1. 访问 https://github.com/new
2. 创建新仓库，命名为 `poker-game`
3. 打开命令行，进入项目目录：

```bash
cd C:\Users\ao\.qclaw\workspace\poker-perfect
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/poker-game.git
git push -u origin main
```

### 步骤 2: 部署到 Render

1. 访问 https://dashboard.render.com/
2. 点击 **New +** → **Web Service**
3. 连接你的 GitHub 仓库 `poker-game`
4. 配置：
   - **Name**: `poker-game`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. 点击 **Create Web Service**

### 步骤 3: 获得公网链接

- 部署完成后，Render 会给你一个链接：
  ```
  https://poker-game-xxx.onrender.com
  ```
- 这就是你的游戏链接！分享给朋友即可一起玩

---

## 🎮 游戏特性

✅ **真正的实时对战** - WebSocket 毫秒级同步  
✅ **房间系统** - 6位字母房间码  
✅ **完整德州扑克规则**:
- 10,000 起始筹码
- 1 点底注 + 大小盲注
- 完整下注轮次（翻牌前/翻牌/转牌/河牌）
- 最高下注 40 点
- 加注后重新轮询
- 完整手牌评估（皇家同花顺到高牌）
- 边池计算

✅ **服务器权威架构** - 防作弊  
✅ **断线重连** - 60秒宽限期  
✅ **赌场级 UI** - 墨绿牌桌 + 金色边框  

---

## 📱 如何使用

### 创建房间
1. 打开游戏链接
2. 输入昵称
3. 点击「创建房间」
4. 获得 6 位房间码
5. 分享给朋友

### 加入房间
1. 打开相同链接
2. 输入昵称
3. 输入房间码
4. 点击「加入房间」

### 开始游戏
- 房主点击「开始游戏」
- 所有人实时同步游戏状态

---

## 🔧 本地测试（可选）

```bash
cd C:\Users\ao\.qclaw\workspace\poker-perfect
npm install
npm start
```

打开浏览器访问: http://localhost:3000

---

## ⚠️ 注意事项

1. **Render Free 限制**:
   - 15分钟无活动会休眠
   - 首次访问可能需要 30 秒启动
   - 每月 750 小时免费额度

2. **如果需要 24/7 在线**:
   - 升级到 Render Starter ($7/月)
   - 或使用 Railway/Heroku

---

## 🆘 故障排除

**问题**: 部署失败  
**解决**: 检查 package.json 中的 Node 版本 >= 18

**问题**: WebSocket 连接失败  
**解决**: 确保 Render 的 WebSocket 支持已启用

**问题**: 游戏卡顿  
**解决**: 检查网络连接，或升级 Render 套餐

---

**现在就开始部署吧！** 🚀
