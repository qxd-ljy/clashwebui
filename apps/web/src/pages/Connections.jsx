import React, { useEffect, useState } from 'react';
import { getConnections, closeConnection } from '../api/clash';
import { XCircle, ArrowDown, ArrowUp, Globe, Activity, Trash2, Search, Network } from 'lucide-react';

const Connections = () => {
    const [connections, setConnections] = useState([]);
    const [filter, setFilter] = useState('');

    const fetchData = async () => {
        try {
            const data = await getConnections();
            setConnections(data.connections || []);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleClose = async (id) => {
        await closeConnection(id);
        fetchData();
    };

    const handleCloseAll = async () => {
        for (const conn of connections) {
            await closeConnection(conn.id);
        }
        fetchData();
    };

    const filtered = connections.filter(c =>
        c.metadata.host?.includes(filter) ||
        c.metadata.destinationIP?.includes(filter) ||
        c.metadata.network?.includes(filter)
    );

    const getProtocolColor = (network) => {
        if (network === 'tcp') return 'bg-blue-50 text-blue-600 border-blue-200';
        if (network === 'udp') return 'bg-purple-50 text-purple-600 border-purple-200';
        return 'bg-gray-50 text-gray-600 border-gray-200';
    };

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                                <Activity size={20} />
                            </div>
                            <h1 className="text-2xl font-bold text-text">连接</h1>
                        </div>
                        <button
                            onClick={handleCloseAll}
                            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium text-sm hover:bg-red-100 transition-colors flex items-center gap-2 border border-red-200"
                        >
                            断开所有连接
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-2" size={18} />
                        <input
                            type="text"
                            placeholder="搜索连接..."
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-card text-text placeholder:text-text-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>
                </div>

                {/* Connections List */}
                <div className="space-y-2">
                    {filtered.map(c => (
                        <div
                            key={c.id}
                            className="bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all"
                        >
                            <div className="flex items-center gap-4">
                                {/* Main Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[15px] font-bold text-text truncate">
                                            {c.metadata.host || c.metadata.destinationIP}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border uppercase ${getProtocolColor(c.metadata.network)}`}>
                                            {c.metadata.network}
                                        </span>
                                        <span className="text-xs text-text-2 font-medium">
                                            {c.chains.slice().reverse().join(' / ')}
                                        </span>
                                        {c.metadata.sourceIP && (
                                            <span className="text-xs text-text-2 font-mono">
                                                SGP 1
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Traffic Stats */}
                                <div className="flex items-center gap-6 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <ArrowDown size={14} className="text-emerald-500" />
                                        <span className="text-sm font-bold text-text tabular-nums min-w-[60px] text-right">
                                            {formatBytes(c.download)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ArrowUp size={14} className="text-blue-500" />
                                        <span className="text-sm font-bold text-text tabular-nums min-w-[60px] text-right">
                                            {formatBytes(c.upload)}
                                        </span>
                                    </div>
                                </div>

                                {/* Close Button */}
                                <button
                                    onClick={() => handleClose(c.id)}
                                    className="w-8 h-8 shrink-0 rounded-lg hover:bg-red-50 hover:text-red-600 text-text-2 flex items-center justify-center transition-colors"
                                >
                                    <XCircle size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div className="text-center py-20 text-text-2">
                        <Activity size={48} className="mx-auto mb-4 opacity-30" />
                        <p>暂无活动连接</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default Connections;
