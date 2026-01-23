#!/bin/bash

# ============ 配置区域 ============
# 尝试从 config.yaml 读取 Python 解释器
if [ -f "config.yaml" ]; then
    CONFIG_PYTHON=$(grep "interpreter:" config.yaml | head -n 1 | awk -F '"' '{print $2}')
    if [ ! -z "$CONFIG_PYTHON" ]; then
        # 展开 $HOME 变量
        PYTHON_INTERPRETER=${CONFIG_PYTHON//\$HOME/$HOME}
    fi
fi
# 如果配置为空，默认使用 python
if [ -z "$PYTHON_INTERPRETER" ]; then
    PYTHON_INTERPRETER="python"
fi

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
    
    # 停止前端
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        log_success "前端开发服务器已停止 (PID: $FRONTEND_PID)"
    fi
    
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

log_info "ClashWebUI 开发环境启动脚本"
log_info "Python 解释器: $PYTHON_INTERPRETER"
echo ""

# 1. 检查并安装前端依赖
log_info "步骤 1/4: 检查前端依赖..."
if [ ! -d "apps/web/node_modules" ]; then
    log_warning "前端依赖未安装，正在安装..."
    cd apps/web
    npm install
    cd ../..
    log_success "前端依赖安装完成"
else
    log_success "前端依赖已安装"
fi
echo ""

# 2. 检查 Python 依赖
log_info "步骤 2/4: 检查 Python 依赖..."
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
log_info "步骤 3/4: 启动后端服务..."
$PYTHON_INTERPRETER apps/server/main.py > logs/backend.log 2>&1 &
BACKEND_PID=$!
sleep 2

if ps -p $BACKEND_PID > /dev/null; then
    log_success "后端服务已启动 (PID: $BACKEND_PID)"
else
    log_error "后端服务启动失败，请检查 logs/backend.log"
    exit 1
fi
echo ""

# 4. 启动前端开发服务器
log_info "步骤 4/4: 启动前端开发服务器..."

# 读取前端端口配置
FRONTEND_PORT=5173
# 读取后端端口配置 (供 Vite 代理使用)
PORT_BACKEND=3001

if [ -f "config.yaml" ]; then
    # 读取前端端口
    CONFIG_FRONTEND=$(grep "frontend_dev:" config.yaml | head -n 1 | awk -F ': ' '{print $2}')
    if [ ! -z "$CONFIG_FRONTEND" ]; then
        FRONTEND_PORT=$CONFIG_FRONTEND
    fi
    # 读取后端端口
    CONFIG_BACKEND=$(grep "webui:" config.yaml | head -n 1 | awk -F ': ' '{print $2}')
    if [ ! -z "$CONFIG_BACKEND" ]; then
        PORT_BACKEND=$CONFIG_BACKEND
    fi
fi

cd apps/web
# 传递 BACKEND_PORT 环境变量给 Vite
PORT=$FRONTEND_PORT BACKEND_PORT=$PORT_BACKEND npm run dev > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ../..
sleep 2

if ps -p $FRONTEND_PID > /dev/null; then
    log_success "前端开发服务器已启动 (PID: $FRONTEND_PID)"
    log_success "访问地址: http://localhost:$FRONTEND_PORT (热更新)"
else
    log_error "前端开发服务器启动失败，请检查 logs/frontend.log"
    cleanup
    exit 1
fi
echo ""

log_success "============================================"
log_success "  ClashWebUI 开发环境已启动！"
log_success "  前端开发: http://localhost:$FRONTEND_PORT (热更新)"
log_success "  后端服务: http://localhost:$PORT_BACKEND (稳定)"
log_success "============================================"
echo ""
log_warning "【重要提示】"
log_warning "由于 Vite WebSocket 代理问题，建议使用:"
log_warning "  👉 http://localhost:$PORT_BACKEND (推荐)"
log_warning ""
log_info "日志文件:"
log_info "  后端: logs/backend.log"
log_info "  前端: logs/frontend.log"
echo ""
log_info "按 Ctrl+C 停止所有服务"

# 保持脚本运行
wait
