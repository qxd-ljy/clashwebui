import React, { useState } from 'react';
import { Wifi, Zap, ChevronDown, Rocket, Globe, Monitor, Search, ArrowUpDown, EyeOff, Activity, Loader2 } from 'lucide-react';
import clsx from 'clsx';

// Helper to get icon based on group name
const getGroupIcon = (name) => {
    const n = name.toLowerCase();

    // Initial keywords mapping
    if (n.includes('proxy') || n.includes('us') || n.includes('手动切换') || n.includes('节点')) return <Rocket size={20} className="text-blue-500" />;
    if (n.includes('apple') || n.includes('苹果')) return <Monitor size={20} className="text-gray-500" />;
    if (n.includes('google') || n.includes('谷歌')) return <Search size={20} className="text-red-500" />;
    if (n.includes('telegram') || n.includes('电报')) return <Rocket size={20} className="text-sky-500" />;
    if (n.includes('microsoft') || n.includes('微软')) return <Monitor size={20} className="text-blue-600" />;
    if (n.includes('game') || n.includes('游戏')) return <Zap size={20} className="text-purple-500" />;
    if (n.includes('ai') || n.includes('智能')) return <Zap size={20} className="text-green-500" />;
    if (n.includes('media') || n.includes('媒体')) return <Globe size={20} className="text-pink-500" />;

    // Fallback for unknown
    return <Globe size={20} className="text-text-2" />;
};

const ProxyNode = ({ name, type, latency, testing, udp, tfo, active, onClick, onLatencyClick }) => {
    const isTesting = testing;
    const isTimeout = !isTesting && (!latency || latency === 0);

    return (
        <div
            className={clsx(
                'relative flex items-center justify-between px-4 py-3 rounded-xl border transition-all cursor-pointer h-[64px] hover:shadow-sm group',
                active
                    ? 'bg-blue-50/50 border-blue-200 shadow-sm'
                    : 'bg-white border-transparent hover:bg-gray-50/80 hover:border-border'
            )}
            onClick={onClick}
        >
            {/* Active Indicator Strip */}
            {active && (
                <div className="absolute left-0 top-3 bottom-3 w-[4px] bg-primary rounded-r-md"></div>
            )}

            {/* Left: Name & Tags */}
            <div className={clsx("flex flex-col justify-center gap-1 min-w-0 pr-2", active ? "pl-3" : "")}>
                <span className={clsx(
                    "font-bold text-[14px] truncate leading-tight",
                    active ? "text-primary" : "text-text"
                )}>
                    {name}
                </span>

                <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Protocol Type Chip */}
                    <span className="px-1.5 py-[1px] rounded-[4px] border border-border text-[10px] text-text-2 bg-muted/30 font-medium">
                        {type}
                    </span>
                    {/* Capabilities Chips */}
                    {udp && (
                        <span className="px-1.5 py-[1px] rounded-[4px] border border-border text-[10px] text-text-2 bg-muted/30">
                            UDP
                        </span>
                    )}
                    {tfo && (
                        <span className="px-1.5 py-[1px] rounded-[4px] border border-border text-[10px] text-text-2 bg-muted/30">
                            TFO
                        </span>
                    )}
                </div>
            </div>

            {/* Right: Latency (Clickable) */}
            <div
                className="text-right shrink-0 flex flex-col justify-center items-end pl-2 py-1 -mr-2 cursor-pointer hover:opacity-70 transition-opacity"
                onClick={(e) => {
                    e.stopPropagation();
                    if (!isTesting && onLatencyClick) onLatencyClick();
                }}
                title="点击重新测速"
            >
                {isTesting ? (
                    <Loader2 size={16} className="text-primary animate-spin" />
                ) : (
                    <span className={clsx(
                        "text-[13px] font-medium font-mono",
                        isTimeout ? "text-red-500" : "text-green-500"
                    )}>
                        {isTimeout ? 'Timeout' : latency}
                    </span>
                )}
            </div>
        </div>
    );
};

const ToolbarIcon = ({ icon: Icon, onClick, title }) => (
    <button
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        className="p-1.5 text-text-3 hover:text-text hover:bg-muted rounded-lg transition-colors"
        title={title}
    >
        <Icon size={16} />
    </button>
);

const ProxyGroup = ({ name, type, nodes, activeNode, onSelect, onUrlTest, onNodeUrlTest }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [testing, setTesting] = useState(false);
    const [sortMode, setSortMode] = useState('latency'); // 'default', 'name', 'latency'

    const handleTest = async () => {
        if (testing || !onUrlTest) return;
        setTesting(true);
        try {
            await onUrlTest(name);
        } catch (e) { console.error(e); }
        setTesting(false);
    };

    const handleSort = () => {
        const nextMode = {
            'default': 'name',
            'name': 'latency',
            'latency': 'default'
        };
        setSortMode(nextMode[sortMode]);
    };

    const getSortedNodes = () => {
        const list = [...nodes];
        if (sortMode === 'name') {
            return list.sort((a, b) => a.name.localeCompare(b.name));
        }
        if (sortMode === 'latency') {
            return list.sort((a, b) => {
                // Treat 0 or null/undefined as very high latency (Timeout)
                const getVal = (v) => (v && v > 0) ? v : 9999999;
                return getVal(a.latency) - getVal(b.latency);
            });
        }
        return list;
    };

    const sortedNodes = getSortedNodes();

    return (
        <div className="mb-3 selection:bg-primary/10">
            <div
                className="bg-card rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200"
            >
                {/* Accordion Header */}
                <div
                    className="h-[72px] px-5 flex items-center justify-between cursor-pointer"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                            {getGroupIcon(name)}
                        </div>

                        {/* Title & Info */}
                        <div className="flex flex-col justify-center min-w-0">
                            <h3 className="text-[17px] font-bold text-text truncate leading-tight">{name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="px-1.5 py-[1px] rounded-[5px] text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wide">
                                    {type}
                                </span>
                                <span className="text-xs text-text-3 truncate max-w-[200px]">
                                    {activeNode || '未选择'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 pl-4">
                        {/* Count Badge */}
                        <div className="bg-primary/5 px-2.5 py-1 rounded-full text-xs font-semibold text-primary">
                            {nodes.length}
                        </div>

                        {/* Chevron */}
                        <ChevronDown
                            size={20}
                            className={clsx(
                                "text-text-3 transition-transform duration-300 ease-out",
                                isExpanded && "rotate-180"
                            )}
                        />
                    </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="px-5 pb-5 animate-in slide-in-from-top-1 fade-in duration-200">
                        {/* Internal Toolbar */}
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/40">
                            <ToolbarIcon
                                icon={Activity}
                                title="测试延迟"
                                onClick={handleTest}
                            />
                            <div className="flex items-center">
                                <ToolbarIcon
                                    icon={ArrowUpDown}
                                    title={`排序: ${sortMode === 'default' ? '默认' : sortMode === 'name' ? '名称' : '延迟'}`}
                                    onClick={handleSort}
                                />
                                <span className="text-[10px] text-text-3 ml-1">
                                    {sortMode === 'default' ? '默认' : sortMode === 'name' ? '名称' : '延迟'}
                                </span>
                            </div>

                            <div className={clsx("ml-auto text-[11px] font-medium transition-colors", testing ? "text-primary animate-pulse" : "text-text-3")}>
                                {testing ? '测试中...' : 'Ready'}
                            </div>
                        </div>

                        {/* 2-Column Grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            {sortedNodes.map(node => (
                                <ProxyNode
                                    key={node.name}
                                    {...node}
                                    active={activeNode === node.name}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelect(node.name);
                                    }}
                                    onLatencyClick={() => onNodeUrlTest && onNodeUrlTest(node.name)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(ProxyGroup);
