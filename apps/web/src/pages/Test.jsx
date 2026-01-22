import React, { useState, useEffect } from 'react';
import { Play, RefreshCw, Globe, CheckCircle2, XCircle, AlertCircle, Loader2, Plus, Trash2, PlayCircle } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

const DEFAULT_SERVICES = [
    {
        id: 'bilibili_cn',
        name: '哔哩哔哩大陆',
        icon: '📺',
        url: 'https://api.bilibili.com/x/web-interface/nav',
        match: 'isLogin',
        type: 'json'
    },
    {
        id: 'bilibili_hk_mo_tw',
        name: '哔哩哔哩港澳台',
        icon: '📺',
        url: 'https://api.bilibili.com/pgc/player/web/playurl?cid=1&bvid=BV15b4y1e73H&qn=0&type=&otype=json&ep_id=361623',
        match: '"code":0',
        type: 'text'
    },
    {
        id: 'openai',
        name: 'ChatGPT / OpenAI',
        icon: '🤖',
        url: 'https://chat.openai.com',
        match: 'Not available', // Negative match usually
        type: 'status'
    },
    {
        id: 'youtube',
        name: 'YouTube Premium',
        icon: '▶️',
        url: 'https://www.youtube.com/premium',
        match: 'Premium',
        type: 'text'
    },
    {
        id: 'netflix',
        name: 'Netflix',
        icon: '🎬',
        url: 'https://www.netflix.com/title/81298418', // specific title
        match: 'Not Available', // negative
        type: 'status'
    },
    {
        id: 'disney',
        name: 'Disney+',
        icon: '🏰',
        url: 'https://www.disneyplus.com',
        match: 'available',
        type: 'status'
    },
    {
        id: 'google',
        name: 'Google Service',
        icon: '🔍',
        url: 'https://www.google.com/generate_204',
        match: '204',
        type: 'status'
    },
    {
        id: 'telegram',
        name: 'Telegram',
        icon: '✈️',
        url: 'https://web.telegram.org',
        match: '',
        type: 'status'
    },
    {
        id: 'twitter',
        name: 'Twitter / X',
        icon: '🐦',
        url: 'https://twitter.com',
        match: '',
        type: 'status'
    },
    {
        id: 'github',
        name: 'GitHub',
        icon: '🐙',
        url: 'https://github.com',
        match: '',
        type: 'status'
    },
    {
        id: 'instagram',
        name: 'Instagram',
        icon: '📸',
        url: 'https://www.instagram.com',
        match: '',
        type: 'status'
    }
];

const Test = () => {
    const { mixedPort } = useSettings();
    const [results, setResults] = useState({});
    const [testing, setTesting] = useState({});
    const [customServices, setCustomServices] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);

    // New Service Form State
    const [newService, setNewService] = useState({
        name: '',
        url: '',
        match: '',
        type: 'status',
        icon: '🌐'
    });

    useEffect(() => {
        const saved = localStorage.getItem('custom_test_services');
        if (saved) {
            try {
                setCustomServices(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load custom services", e);
            }
        }
    }, []);

    const saveCustomServices = (services) => {
        setCustomServices(services);
        localStorage.setItem('custom_test_services', JSON.stringify(services));
    };

    const handleAddService = () => {
        if (!newService.name || !newService.url) return;

        const service = {
            ...newService,
            id: 'custom_' + Date.now()
        };

        const updated = [...customServices, service];
        saveCustomServices(updated);
        setShowAddModal(false);
        setNewService({ name: '', url: '', match: '', type: 'status', icon: '🌐' });
    };

    const handleDeleteService = (id) => {
        if (window.confirm('确定要删除这个测试项吗？')) {
            const updated = customServices.filter(s => s.id !== id);
            saveCustomServices(updated);
        }
    };

    const runTest = async (service) => {
        setTesting(prev => ({ ...prev, [service.id]: true }));

        try {
            const res = await fetch('/backend/test/unlock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: service.url,
                    match: service.match,
                    type: service.type
                })
            });
            const data = await res.json();

            setResults(prev => ({
                ...prev,
                [service.id]: {
                    ...data,
                    updated: new Date().toLocaleString()
                }
            }));
        } catch (error) {
            console.error(error);
            setResults(prev => ({
                ...prev,
                [service.id]: {
                    status: 'failed',
                    latency: 'Error',
                    info: 'Network Error',
                    updated: new Date().toLocaleString()
                }
            }));
        } finally {
            setTesting(prev => ({ ...prev, [service.id]: false }));
        }
    };

    const allServices = [...DEFAULT_SERVICES, ...customServices];

    const runAll = () => {
        allServices.forEach(s => runTest(s));
    };

    return (
        <div className="h-full overflow-y-auto bg-background p-6 custom-scrollbar animate-fade-in">
            <div className="max-w-7xl mx-auto pb-20 relative">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <PlayCircle size={20} />
                        </div>
                        <h1 className="text-2xl font-bold text-text">流媒体测试</h1>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-border text-text rounded-xl hover:bg-muted transition-all font-medium"
                        >
                            <Plus size={18} />
                            <span>添加测试</span>
                        </button>

                        <button
                            onClick={runAll}
                            disabled={Object.values(testing).some(t => t)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            {Object.values(testing).some(t => t) ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} fill="currentColor" />}
                            <span>测试全部</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {allServices.map(service => {
                        const res = results[service.id];
                        const isTesting = testing[service.id];
                        const isCustom = service.id.startsWith('custom_');

                        return (
                            <div key={service.id} className="bg-white rounded-2xl p-5 border border-border shadow-sm hover:shadow-md transition-all duration-300 group relative">
                                {isCustom && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteService(service.id); }}
                                        className="absolute top-2 right-2 p-1.5 text-text-3 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}

                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-xl">
                                            {service.icon}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-text text-base">{service.name}</h3>
                                            {res?.info && (
                                                <span className="text-xs text-text-3 font-mono mt-0.5 block">
                                                    {res.updated.split(' ')[1]}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => runTest(service)}
                                        disabled={isTesting}
                                        className={`p-2 rounded-full hover:bg-muted transition-colors text-text-3 ${isTesting ? 'animate-spin text-primary' : 'hover:text-primary'}`}
                                    >
                                        <RefreshCw size={18} />
                                    </button>
                                </div>

                                <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {isTesting ? (
                                                <span className="text-sm text-text-2 flex items-center gap-2">
                                                    <Loader2 size={14} className="animate-spin" />
                                                    检测中...
                                                </span>
                                            ) : res ? (
                                                <>
                                                    {res.status === 'success' ? (
                                                        <span className="flex items-center gap-1.5 text-success font-medium text-sm bg-success/10 px-2.5 py-1 rounded-lg">
                                                            <CheckCircle2 size={14} />
                                                            支持
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-danger font-medium text-sm bg-danger/10 px-2.5 py-1 rounded-lg" title={res.info}>
                                                            <XCircle size={14} />
                                                            {res.info === 'Failed' ? '不支持' : res.info}
                                                        </span>
                                                    )}

                                                    {res.info && res.status === 'success' && (
                                                        <span className="flex items-center gap-1 text-primary font-medium text-xs bg-primary/10 px-2 py-0.5 rounded text-nowrap">
                                                            <Globe size={12} />
                                                            {res.info}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-text-3 text-sm">
                                                    <AlertCircle size={14} />
                                                    待检测
                                                </span>
                                            )}
                                        </div>

                                        {res?.latency && !isTesting && (
                                            <span className={`text-xs font-mono ${parseInt(res.latency) > 300 ? 'text-orange-500' : 'text-emerald-500'}`}>
                                                {res.latency}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {showAddModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-border">
                                <h2 className="text-xl font-bold text-text">添加自定义测试</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-2 mb-1.5">显示名称</label>
                                    <input
                                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:outline-none focus:border-primary text-text"
                                        placeholder="例如：My Website"
                                        value={newService.name}
                                        onChange={e => setNewService({ ...newService, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-2 mb-1.5">图标 URL (Emoji)</label>
                                    <input
                                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:outline-none focus:border-primary text-text"
                                        placeholder="🌍"
                                        value={newService.icon}
                                        onChange={e => setNewService({ ...newService, icon: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-2 mb-1.5">测试地址 (URL)</label>
                                    <input
                                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg focus:outline-none focus:border-primary text-text"
                                        placeholder="https://example.com"
                                        value={newService.url}
                                        onChange={e => setNewService({ ...newService, url: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-2 mb-1.5">匹配关键字 (可选)</label>
                                    <div className="flex gap-2 mb-2">
                                        <select
                                            className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-text"
                                            value={newService.type}
                                            onChange={e => setNewService({ ...newService, type: e.target.value })}
                                        >
                                            <option value="status">状态码</option>
                                            <option value="text">网页文本</option>
                                        </select>
                                        <input
                                            className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-lg focus:outline-none focus:border-primary text-text text-sm"
                                            placeholder={newService.type === 'status' ? '留空则检查 2xx/3xx' : '网页包含的内容'}
                                            value={newService.match}
                                            onChange={e => setNewService({ ...newService, match: e.target.value })}
                                        />
                                    </div>
                                    <p className="text-xs text-text-3">
                                        {newService.type === 'status'
                                            ? '默认检查 HTTP 状态码是否成功。也可填 "404" 来指定匹配。'
                                            : '检查响应内容中是否包含该字符串。以 "!" 开头表示不包含。'}
                                    </p>
                                </div>
                            </div>
                            <div className="p-4 bg-muted/30 border-t border-border flex justify-end gap-3">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 text-text-2 hover:bg-muted rounded-lg transition-colors font-medium text-sm"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleAddService}
                                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm shadow-sm"
                                >
                                    保存
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Test;
