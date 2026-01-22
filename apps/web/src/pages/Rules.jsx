import React, { useEffect, useState, useRef } from 'react';
import { Search, Filter, Shield, Globe, Network } from 'lucide-react';
import { getRules } from '../api/clash';

const Rules = () => {
    const [rules, setRules] = useState([]);
    const [filter, setFilter] = useState('');
    const [visibleCount, setVisibleCount] = useState(50); // Initial render count
    const containerRef = useRef(null);

    useEffect(() => {
        getRules().then(data => {
            setRules(data.rules || []);
        });
    }, []);

    // Reset visible count when filter changes
    useEffect(() => {
        setVisibleCount(50);
        if (containerRef.current) containerRef.current.scrollTop = 0;
    }, [filter]);

    const filtered = rules.filter(r =>
        r.payload.toLowerCase().includes(filter.toLowerCase())
    );

    const getTypeColor = (type) => {
        const colorMap = {
            'DOMAIN': 'bg-blue-50 text-blue-600 border-blue-200',
            'DOMAIN-SUFFIX': 'bg-blue-50 text-blue-600 border-blue-200',
            'DOMAIN-KEYWORD': 'bg-purple-50 text-purple-600 border-purple-200',
            'IP-CIDR': 'bg-emerald-50 text-emerald-600 border-emerald-200',
            'IP-CIDR6': 'bg-teal-50 text-teal-600 border-teal-200',
            'GEOIP': 'bg-orange-50 text-orange-600 border-orange-200',
            'MATCH': 'bg-gray-50 text-gray-600 border-gray-200',
        };
        return colorMap[type] || 'bg-gray-50 text-gray-600 border-gray-200';
    };

    const getProxyColor = (proxy) => {
        if (proxy.includes('代理') || proxy.includes('PROXY')) return 'bg-blue-500 text-white';
        if (proxy.includes('直连') || proxy.includes('DIRECT')) return 'bg-emerald-500 text-white';
        if (proxy.includes('拒绝') || proxy.includes('REJECT')) return 'bg-red-500 text-white';
        return 'bg-gray-500 text-white';
    };

    // Infinite scroll handler
    const handleScroll = (e) => {
        const { scrollTop, clientHeight, scrollHeight } = e.target;
        if (scrollHeight - scrollTop - clientHeight < 300) {
            setVisibleCount(prev => Math.min(prev + 50, filtered.length));
        }
    };

    // Since the scroll wrapper is likely in the parent layout (main element), 
    // we might need to attach this to a specific container or assume the component *is* the scroll container?
    // Looking at App.jsx: <main className="flex-1 overflow-y-auto ...">
    // So `Rules` is inside the scrolling container. 
    // It's better to make `Rules` handle its own scrolling or attach a listener to window/document if needed.
    // BUT, creating a local scroll container `h-full overflow-y-auto` inside `Rules` is safer and more self-contained.

    return (
        <div
            ref={containerRef}
            className="h-full overflow-y-auto bg-background p-6"
            onScroll={handleScroll}
        >
            <div className="max-w-7xl mx-auto pb-20">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                                <Shield size={20} />
                            </div>
                            <h1 className="text-2xl font-bold text-text">规则</h1>
                        </div>
                        <div className="text-sm text-text-2">
                            显示 {Math.min(visibleCount, filtered.length)} / {filtered.length} 条规则
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-2" size={18} />
                        <input
                            type="text"
                            placeholder="搜索规则..."
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-card text-text placeholder:text-text-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>
                </div>

                {/* Rules List */}
                <div className="space-y-2">
                    {filtered.slice(0, visibleCount).map((rule, idx) => (
                        <div
                            key={idx}
                            className="bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                {/* Index */}
                                <div className="w-10 h-10 shrink-0 rounded-lg bg-muted flex items-center justify-center text-text-2 text-sm font-bold group-hover:bg-primary-soft group-hover:text-primary transition-colors">
                                    {idx + 1}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-[15px] font-medium text-text truncate mb-1">
                                        {rule.payload}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getTypeColor(rule.type)}`}>
                                            {rule.type}
                                        </span>
                                    </div>
                                </div>

                                {/* Proxy Badge */}
                                <div className="shrink-0">
                                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${getProxyColor(rule.proxy)}`}>
                                        {rule.proxy}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Loading Indicator */}
                    {visibleCount < filtered.length && (
                        <div className="py-4 text-center text-text-3 text-sm animate-pulse">
                            加载更多规则...
                        </div>
                    )}
                </div>

                {filtered.length === 0 && (
                    <div className="text-center py-20 text-text-2">
                        <Shield size={48} className="mx-auto mb-4 opacity-30" />
                        <p>未找到匹配的规则</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Rules;
