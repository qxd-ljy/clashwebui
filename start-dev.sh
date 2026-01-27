#!/bin/bash

# ============ 配置区域 ============
# 尝试从 config.yaml 读取 Python 解释器
PYTHON_INTERPRETER=""
if [ -f "config.yaml" ]; then
    CONFIG_PYTHON=$(grep "interpreter:" config.yaml | head -n 1 | awk -F '"' '{print $2}')
    if [ -n "$CONFIG_PYTHON" ]; then
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
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# ============ 主逻辑路径 ============
cd "$(dirname "$0")" || exit 1

# 确保日志目录存在
PID_DIR="logs"
mkdir -p "$PID_DIR"

PID_BACKEND_FILE="$PID_DIR/backend.pid"
PID_FRONTEND_FILE="$PID_DIR/frontend.pid"

# ============ 参数解析 ============
DAEMON=0
CMD="${1:-start}"
if [[ "$1" == "--daemon" || "$1" == "-d" ]]; then
    DAEMON=1
    CMD="start"
fi

pid_is_running() {
    local pid="$1"
    [[ -n "$pid" ]] && ps -p "$pid" >/dev/null 2>&1
}

# stop：杀进程组（PGID=PID），并确认退出
stop_by_pidfile() {
    local name="$1"
    local f="$2"

    if [[ ! -f "$f" ]]; then
        log_warning "$name：未找到 PID 文件 ($f)"
        return 0
    fi

    local pid
    pid=$(cat "$f" 2>/dev/null)

    if [[ -z "$pid" ]]; then
        log_warning "$name：PID 文件为空 ($f)"
        rm -f "$f"
        return 0
    fi

    if ! pid_is_running "$pid"; then
        log_warning "$name：PID 文件存在但进程不存在 (PID: $pid)"
        rm -f "$f"
        return 0
    fi

    # 先 TERM 整个进程组
    log_info "$name：发送 SIGTERM 到进程组 (PGID: $pid)"
    kill -TERM -"${pid}" 2>/dev/null

    # 等待退出（最多 5 秒）
    for i in 1 2 3 4 5; do
        if ! pid_is_running "$pid"; then
            log_success "$name：已停止 (PGID: $pid)"
            rm -f "$f"
            return 0
        fi
        sleep 1
    done

    # 还没死就 KILL
    log_warning "$name：SIGTERM 无效，发送 SIGKILL 到进程组 (PGID: $pid)"
    kill -KILL -"${pid}" 2>/dev/null
    sleep 1

    if pid_is_running "$pid"; then
        log_error "$name：仍未停止 (PGID: $pid)"
    else
        log_success "$name：已强制停止 (PGID: $pid)"
    fi

    rm -f "$f"
}

status_by_pidfile() {
    local name="$1"
    local f="$2"

    if [[ -f "$f" ]]; then
        local pid
        pid=$(cat "$f" 2>/dev/null)
        if [[ -n "$pid" ]] && pid_is_running "$pid"; then
            log_success "$name：运行中 (PGID: $pid)"
            ps -p "$pid" -o pid,ppid,cmd --no-headers 2>/dev/null | sed 's/^/  /'
        else
            log_warning "$name：未运行（PID 文件存在但进程不存在）"
        fi
    else
        log_warning "$name：未运行（无 PID 文件）"
    fi
}

# ============ 子命令：stop / status ============
if [[ "$CMD" == "stop" ]]; then
    log_info "正在停止 ClashWebUI..."
    stop_by_pidfile "前端" "$PID_FRONTEND_FILE"
    stop_by_pidfile "后端" "$PID_BACKEND_FILE"
    exit 0
fi

if [[ "$CMD" == "status" ]]; then
    log_info "ClashWebUI 状态："
    status_by_pidfile "后端" "$PID_BACKEND_FILE"
    status_by_pidfile "前端" "$PID_FRONTEND_FILE"
    exit 0
fi

# ============ 清理函数（仅前台模式用） ============
cleanup() {
    log_info "正在停止所有服务..."
    stop_by_pidfile "前端" "$PID_FRONTEND_FILE"
    stop_by_pidfile "后端" "$PID_BACKEND_FILE"
    exit 0
}

# 前台模式才注册 Ctrl+C 清理
if [[ "$DAEMON" -eq 0 ]]; then
    trap cleanup SIGINT SIGTERM
fi

log_info "ClashWebUI 开发环境启动脚本"
log_info "Python 解释器: $PYTHON_INTERPRETER"
if [[ "$DAEMON" -eq 1 ]]; then
    log_info "运行模式: 后台 (daemon)"
else
    log_info "运行模式: 前台 (interactive)"
fi
echo ""

# 0. 防止重复启动（如果 PID 存在且进程还在，就提示并退出）
if [[ -f "$PID_BACKEND_FILE" ]]; then
    OLD_PID=$(cat "$PID_BACKEND_FILE" 2>/dev/null)
    if [[ -n "$OLD_PID" ]] && pid_is_running "$OLD_PID"; then
        log_warning "检测到后端可能已在运行 (PGID: $OLD_PID)。如需停止：./start-dev.sh stop"
    fi
fi
if [[ -f "$PID_FRONTEND_FILE" ]]; then
    OLD_PID=$(cat "$PID_FRONTEND_FILE" 2>/dev/null)
    if [[ -n "$OLD_PID" ]] && pid_is_running "$OLD_PID"; then
        log_warning "检测到前端可能已在运行 (PGID: $OLD_PID)。如需停止：./start-dev.sh stop"
    fi
fi

# 1. 检查并安装前端依赖
log_info "步骤 1/4: 检查前端依赖..."
if [ ! -d "apps/web/node_modules" ]; then
    log_warning "前端依赖未安装，正在安装..."
    (cd apps/web && npm install)
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

# 读取端口配置
FRONTEND_PORT=5173
PORT_BACKEND=3000
if [ -f "config.yaml" ]; then
    CONFIG_FRONTEND=$(grep "frontend_dev:" config.yaml | head -n 1 | awk -F ': ' '{print $2}')
    if [ -n "$CONFIG_FRONTEND" ]; then
        FRONTEND_PORT=$CONFIG_FRONTEND
    fi

    CONFIG_BACKEND=$(grep "webui:" config.yaml | head -n 1 | awk -F ': ' '{print $2}')
    if [ -n "$CONFIG_BACKEND" ]; then
        PORT_BACKEND=$CONFIG_BACKEND
    fi
fi

# 3. 启动后端服务（setsid -> 独立会话/进程组）
log_info "步骤 3/4: 启动后端服务..."
setsid $PYTHON_INTERPRETER apps/server/main.py > logs/backend.log 2>&1 < /dev/null &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PID_BACKEND_FILE"
sleep 2

if pid_is_running "$BACKEND_PID"; then
    log_success "后端服务已启动 (PGID: $BACKEND_PID)"
else
    log_error "后端服务启动失败，请检查 logs/backend.log"
    rm -f "$PID_BACKEND_FILE" 2>/dev/null
    exit 1
fi
echo ""

# 4. 启动前端开发服务器（setsid -> 独立会话/进程组）
log_info "步骤 4/4: 启动前端开发服务器..."
(
  cd apps/web || exit 1
  setsid env PORT=$FRONTEND_PORT BACKEND_PORT=$PORT_BACKEND npm run dev > ../../logs/frontend.log 2>&1 < /dev/null &
  FRONTEND_PID=$!
  echo "$FRONTEND_PID" > "../../$PID_FRONTEND_FILE"
)
sleep 2

FRONTEND_PID=$(cat "$PID_FRONTEND_FILE" 2>/dev/null)
if pid_is_running "$FRONTEND_PID"; then
    log_success "前端开发服务器已启动 (PGID: $FRONTEND_PID)"
    log_success "访问地址: http://localhost:$FRONTEND_PORT (热更新)"
else
    log_error "前端开发服务器启动失败，请检查 logs/frontend.log"
    rm -f "$PID_FRONTEND_FILE" 2>/dev/null
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

if [[ "$DAEMON" -eq 1 ]]; then
    log_success "已后台运行（daemon 模式）"
    log_info "停止：./start-dev.sh stop"
    log_info "状态：./start-dev.sh status"
    exit 0
else
    log_info "按 Ctrl+C 停止所有服务"
    wait
fi
