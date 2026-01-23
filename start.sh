#!/bin/bash

# ================= 配置区域 =================
# Python 解释器路径 (例如: python3, /usr/bin/python3, ./venv/bin/python)
PYTHON_BIN="python3"

# WebUI 端口 (后端与前端统一端口)
WEBUI_PORT=3001

# Clash 混合代理端口
CLASH_MIXED_PORT=7890

# Clash 控制接口
CLASH_EXTERNAL_CONTROLLER="127.0.0.1:9090"
# 前端开发模式 (0=关闭, 1=开启)
# 开启后将运行 `npm run dev` (适用于开发调试)
START_FRONTEND_DEV=0
# 前端端口 (仅在开发模式下有效)
FRONTEND_PORT=5173
# ===========================================

# 导出环境变量供程序使用
export WEBUI_PORT=$WEBUI_PORT
export CLASH_MIXED_PORT=$CLASH_MIXED_PORT
export CLASH_EXTERNAL_CONTROLLER=$CLASH_EXTERNAL_CONTROLLER

echo "启动 ClashWebUI..."
echo "后端端口: $WEBUI_PORT"
echo "使用解释器: $PYTHON_BIN"

# 启动前端开发服务器 (如果开启)
if [ "$START_FRONTEND_DEV" -eq 1 ]; then
    echo "正在启动前端开发服务器 (端口 $FRONTEND_PORT)..."
    cd apps/web
    # 尝试设置端口并在后台运行，日志输出到 frontend.log
    PORT=$FRONTEND_PORT nohup npm run dev > ../../frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "前端已在后台运行 (PID: $FRONTEND_PID)，日志: frontend.log"
    cd ../..
    
    # 捕获退出信号以清理后台进程
    trap "kill $FRONTEND_PID" EXIT
fi

# 启动 (确保已安装依赖: pip install -r requirements.txt)
$PYTHON_BIN apps/server/main.py
