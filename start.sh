#!/bin/bash

# ============ 配置区域 ============
# Python 解释器路径（可修改为你的 Python 路径）
PYTHON_INTERPRETER="python"
# 或者使用 conda 环境：
# PYTHON_INTERPRETER="$HOME/miniconda3/envs/paper3/bin/python"

# ============ 颜色定义 ============
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============ 辅助函数 ============
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============ 清理函数 ============
cleanup() {
    log_info "正在停止所有服务..."
    
    # 停止后端
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        log_success "后端服务已停止 (PID: $BACKEND_PID)"
    fi
    
    exit 0
}

# 注册信号处理
trap cleanup SIGINT SIGTERM

# ============ 主逻辑 ============
cd "$(dirname "$0")"

log_info "ClashWebUI 启动脚本"
log_info "Python 解释器: $PYTHON_INTERPRETER"
echo ""

# 1. 检查并构建前端
log_info "步骤 1/3: 检查前端构建..."
if [ ! -d "apps/web/dist" ]; then
    log_warning "前端未构建，开始构建..."
    cd apps/web
    npm install
    npm run build
    cd ../..
    log_success "前端构建完成"
else
    log_success "前端已构建，跳过构建步骤"
fi
echo ""

# 2. 检查 Python 依赖
log_info "步骤 2/3: 检查 Python 依赖..."
$PYTHON_INTERPRETER -c "import fastapi" 2>/dev/null
if [ $? -ne 0 ]; then
    log_warning "检测到缺少依赖，正在安装..."
    $PYTHON_INTERPRETER -m pip install -r requirements.txt
    log_success "依赖安装完成"
else
    log_success "Python 依赖已满足"
fi
echo ""

# 3. 启动后端服务
log_info "步骤 3/3: 启动后端服务..."
$PYTHON_INTERPRETER apps/server/main.py &
BACKEND_PID=$!

# 等待后端启动
sleep 2

# 检查后端是否成功启动
if ps -p $BACKEND_PID > /dev/null; then
    log_success "后端服务已启动 (PID: $BACKEND_PID)"
    echo ""
    log_success "============================================"
    log_success "  ClashWebUI 已启动！"
    log_success "  访问地址: http://localhost:3001"
    log_success "============================================"
    echo ""
    log_info "按 Ctrl+C 停止服务"
    
    # 保持脚本运行
    wait $BACKEND_PID
else
    log_error "后端服务启动失败"
    exit 1
fi
