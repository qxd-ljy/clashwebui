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
# ===========================================

# 导出环境变量供程序使用
export WEBUI_PORT=$WEBUI_PORT
export CLASH_MIXED_PORT=$CLASH_MIXED_PORT
export CLASH_EXTERNAL_CONTROLLER=$CLASH_EXTERNAL_CONTROLLER

echo "启动 ClashWebUI..."
echo "后端端口: $WEBUI_PORT"
echo "使用解释器: $PYTHON_BIN"

# 启动 (确保已安装依赖: pip install -r requirements.txt)
$PYTHON_BIN apps/server/main.py
