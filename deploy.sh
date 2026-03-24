#!/bin/bash
# Deploy script for Render

echo "🃏 德州扑克部署脚本"
echo "===================="

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Git not found. Please install Git first."
    exit 1
fi

# Navigate to project directory
cd "$(dirname "$0")"

# Initialize git if not already
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Texas Hold'em Poker game"

# Instructions for GitHub
echo ""
echo "✅ 本地仓库已创建"
echo ""
echo "下一步：推送到 GitHub"
echo "1. 在 GitHub 创建新仓库（不要初始化）"
echo "2. 运行以下命令："
echo ""
echo "   git remote add origin https://github.com/YOUR_USERNAME/poker-game.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. 然后访问 https://dashboard.render.com/ 部署"
echo ""
