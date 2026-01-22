import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Globe, Cloud, Clock, Download, Upload,
    Wifi, Settings, Shield, Router, Zap,
    ChevronRight, MoreHorizontal, PlayCircle, Activity,
    RotateCw, CircuitBoard, Cpu, Search, LayoutDashboard,
    Flag, MapPin, Database, RefreshCw, Layers, Check,
    Monitor, Power, Trash2, Github, LayoutGrid, Info, Server, Terminal, HardDrive
} from 'lucide-react';
import { getTrafficWebSocket, getMemoryWebSocket, getProfiles, getConfigs, getProxies, getConnections, getRules, updateConfig, selectProfile, getVersion, setProxy, getProxyDelay, getSystemInfo } from '../api/clash';
import { useSettings } from '../contexts/SettingsContext';
import Switch from '../components/UI/Switch';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// --- Shared Components for Pixel Perfection ---

const TEST_SITES = [
    { name: 'Apple', icon: LayoutGrid, url: 'http://www.apple.com/library/test/success.html' },
    { name: 'GitHub', icon: Github, url: 'https://github.com/' },
    { name: 'Google', icon: Search, url: 'http://www.gstatic.com/generate_204' },
    { name: 'Youtube', icon: PlayCircle, url: 'https://www.youtube.com/' }
];

const Card = ({ children, className = "" }) => (
    <div className={`bg-card rounded-2xl border border-border shadow-card p-5 flex flex-col ${className}`}>
        {children}
    </div>
);

const Badge = ({ children, className = "" }) => (
    <span className={`px-1.5 py-0.5 rounded-[6px] text-[10px] font-medium border ${className}`}>
        {children}
    </span>
);

const IconButton = ({ icon: Icon, onClick, className = "", spin = false }) => (
    <button onClick={onClick} className={`w-8 h-8 flex items-center justify-center rounded-[8px] text-text-2 hover:bg-muted hover:text-text transition-colors ${className}`}>
        <Icon size={16} className={spin ? "animate-spin" : ""} />
    </button>
);

const SectionTitle = ({ icon: Icon, title }) => (
    <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon size={18} className="text-primary" />}
        <span className="font-bold text-text text-[15px]">{title}</span>
    </div>
);

// --- Component Definition ---

const Dashboard = () => {
    const navigate = useNavigate();
    const [isIpLoading, setIsIpLoading] = useState(false);

    const fetchIpInfo = async () => {
        setIsIpLoading(true);
        try {
            const res = await fetch('/backend/proxy_geoip');
            const data = await res.json();
            setIpInfo({
                ip: data.ip,
                country: data.country,
                country_code: data.country_code,
                organization: data.organization,
                asn: `AS${data.asn}`,
                city: data.city,
                timezone: data.timezone,
                latitude: data.latitude,
                longitude: data.longitude
            });
            setIpCountdown(180);
        } catch (e) {
            console.error('Failed to fetch IP info:', e);
        } finally {
            setIsIpLoading(false);
        }
    };
    const {
        systemProxy, tunMode, isInitialLoading,
        updateSystemProxy, updateTunMode, secret
    } = useSettings();

    const [traffic, setTraffic] = useState({ up: 0, down: 0 });
    const [mode, setMode] = useState('rule');
    const [profiles, setProfiles] = useState([]);
    const [activeProfile, setActiveProfile] = useState(null);
    const [config, setConfig] = useState({});
    const [proxies, setProxies] = useState({});
    const [currentNode, setCurrentNode] = useState(null);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
    const [isNodeMenuOpen, setIsNodeMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('system');
    const [memory, setMemory] = useState(0);
    const [connections, setConnections] = useState({ uploadTotal: 0, downloadTotal: 0, connections: [] });
    const [siteDelays, setSiteDelays] = useState({
        Apple: null,
        GitHub: null,
        Google: null,
        Youtube: null
    });
    const [ipInfo, setIpInfo] = useState({
        ip: '...',
        country: 'Loading...',
        country_code: '',
        organization: '...',
        asn: '...',
        city: '...',
        timezone: '...',
        latitude: '0',
        longitude: '0'
    });
    const [ipCountdown, setIpCountdown] = useState(180);
    const [clashInfo, setClashInfo] = useState({ version: '-', mixedPort: '-', logLevel: '-', ipv6: false, rulesCount: 0, uptime: '-' });
    const [sysInfo, setSysInfo] = useState({ os: '-', autoStart: false, mode: '-', lastCheck: '-', vergeVersion: '-' });

    // Initialize with 30 points of silence to make the chart visible immediately
    const [trafficHistory, setTrafficHistory] = useState(
        Array.from({ length: 30 }, (_, i) => ({
            time: '',
            up: 0,
            down: 0
        }))
    );
    // Auto Update WebSocket
    useEffect(() => {
        const wsTraffic = getTrafficWebSocket(secret);
        const wsMemory = getMemoryWebSocket(secret);

        wsTraffic.onmessage = (e) => {
            const data = JSON.parse(e.data);
            setTraffic(data);
            setTrafficHistory(prev => {
                const newHistory = [...prev, {
                    time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    up: data.up,
                    down: data.down
                }];
                return newHistory.slice(-30);
            });
        };

        wsMemory.onmessage = (e) => {
            const data = JSON.parse(e.data);
            setMemory(data.inuse || 0);
        };

        return () => {
            wsTraffic.close();
            wsMemory.close();
        };
    }, [secret]);

    const handleSiteTest = async (site) => {
        if (!selectedGroup) return;
        setSiteDelays(prev => ({ ...prev, [site.name]: '...' }));
        try {
            const data = await getProxyDelay(selectedGroup, site.url);
            setSiteDelays(prev => ({ ...prev, [site.name]: data.delay ? `${data.delay}ms` : 'Timeout' }));
        } catch (e) {
            setSiteDelays(prev => ({ ...prev, [site.name]: 'Error' }));
        }
    };

    const handleAllSitesTest = () => {
        TEST_SITES.forEach(site => handleSiteTest(site));
    };



    useEffect(() => {
        fetchIpInfo();
        const timer = setInterval(() => {
            setIpCountdown(prev => {
                if (prev <= 1) {
                    fetchIpInfo();
                    return 180;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchData = React.useCallback(async () => {
        try {
            // 1. Profiles
            const profileData = await getProfiles();
            setProfiles(profileData.profiles || []);
            if (profileData.selected) {
                const found = profileData.profiles.find(p => p.id === profileData.selected);
                setActiveProfile(found);
            }

            // 2. Configs & Connections
            const [configData, connData] = await Promise.all([
                getConfigs(),
                getConnections()
            ]);
            setConfig(configData);
            setConnections(connData);
            setMode(configData.mode?.toLowerCase() || 'rule');

            // 3. Proxies
            const proxyData = await getProxies();
            const allProxies = proxyData?.proxies || {};
            setProxies(allProxies);

            // Find Default Group if not set (Heuristic: 'Proxy' > '选择节点' > First Selector)
            let targetGroup = selectedGroup;
            const currentMode = configData.mode?.toLowerCase() || 'rule';

            if (currentMode === 'global') {
                targetGroup = 'GLOBAL';
            } else {
                if (!targetGroup || targetGroup === 'GLOBAL') {
                    // Heuristic: Find the first Selector group in the original configuration order (excluding GLOBAL)
                    const selectors = Object.values(allProxies).filter(p => p.type === 'Selector' && p.name !== 'GLOBAL');
                    // No sort() here - keep the original order from the API

                    if (selectors.length > 0) {
                        targetGroup = selectors[0].name;
                        // Drill down: If the top selector points to another group (e.g. Proxy Select -> Lowest Latency),
                        // show that inner group instead, so the user sees the specific strategy.
                        if (targetGroup && allProxies[targetGroup]) {
                            const nextNodeName = allProxies[targetGroup].now;
                            const nextNode = allProxies[nextNodeName];
                            if (nextNode && (nextNode.type === 'Selector' || nextNode.type === 'URLTest' || nextNode.type === 'Fallback')) {
                                targetGroup = nextNode.name;
                            }
                        }
                    }
                }
            }

            if (targetGroup && allProxies[targetGroup]) {
                if (targetGroup !== selectedGroup) setSelectedGroup(targetGroup);

                // Recursively find the leaf node (actual proxy)
                const getLeafNode = (name) => {
                    const node = allProxies[name];
                    if (!node) return { name, type: 'Unknown' };
                    // If node is a group (Selector, URLTest, Fallback) and has a 'now' selection, recurse
                    if ((node.type === 'Selector' || node.type === 'URLTest' || node.type === 'Fallback') && node.now) {
                        return getLeafNode(node.now);
                    }
                    return node;
                };

                const activeNodeName = allProxies[targetGroup].now;
                const leafNode = getLeafNode(activeNodeName);
                setCurrentNode(leafNode);
            }
            setProxies(allProxies);

            // 5. Fetch Clash & System Info
            const [ver, conf, rules, system] = await Promise.all([
                getVersion(),
                getConfigs(),
                getRules(),
                getSystemInfo()
            ]);

            const formatUptime = (seconds) => {
                const h = Math.floor(seconds / 3600);
                const m = Math.floor((seconds % 3600) / 60);
                const s = seconds % 60;
                return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            };

            setClashInfo({
                version: ver.version,
                mixedPort: conf['mixed-port'] || conf['port'] || '-',
                logLevel: conf['log-level'] || 'info',
                ipv6: conf.ipv6 || false,
                rulesCount: rules.rules?.length || 0,
                uptime: formatUptime(system.uptime)
            });

            setSysInfo({
                os: system.os,
                autoStart: system.auto_start,
                mode: system.mode,
                lastCheck: system.last_check,
                vergeVersion: system.verge_version
            });

        } catch (e) {
            console.error("Failed to fetch dashboard data", e);
        }
    }, [selectedGroup]);

    const handleNodeSelect = async (nodeName) => {
        if (!selectedGroup) return;
        setIsNodeMenuOpen(false);
        try {
            await setProxy(selectedGroup, nodeName);
            // Optimistic update or immediate fetch
            fetchData();
        } catch (e) {
            console.error("Failed to set proxy", e);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Poll every 5s for updates
        return () => clearInterval(interval);
    }, [fetchData]);

    const formatSpeed = (bytes) => {
        if (!bytes || bytes === 0) return '0.00 B/s';
        const k = 1024;
        const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const limitedI = Math.min(i, sizes.length - 1);
        return parseFloat((bytes / Math.pow(k, limitedI)).toFixed(2)) + ' ' + sizes[limitedI];
    };

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0.00 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const limitedI = Math.min(i, sizes.length - 1);
        return parseFloat((bytes / Math.pow(k, limitedI)).toFixed(2)) + ' ' + sizes[limitedI];
    };

    return (
        <div className="h-full overflow-y-auto bg-background p-6 custom-scrollbar animate-fade-in">
            <div className="w-full max-w-7xl mx-auto pb-8">

                {/* Header Actions */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <LayoutDashboard size={20} />
                        </div>
                        <h1 className="text-2xl font-bold text-text">概览</h1>
                    </div>
                    <div className="flex gap-2.5">
                        <button
                            onClick={() => navigate('/logs')}
                            className="h-9 px-4 rounded-xl border border-border bg-card hover:bg-muted flex items-center gap-2 text-sm text-text-2 transition-colors"
                        >
                            <RefreshCw size={16} /> console
                        </button>
                        <button
                            onClick={() => navigate('/settings')}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-card border border-border text-text-2 hover:bg-muted transition-colors"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>

                {/* --- Row 1 & 2: Main Grid --- */}
                <div className="grid grid-cols-12 gap-5 mb-5">

                    {/* 1. Subscription */}
                    <Card className="col-span-7 h-[260px] relative">
                        <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                                    <Cloud size={20} />
                                </div>
                                <span className="text-[17px] font-bold text-text">
                                    {activeProfile ? activeProfile.name : "未选择订阅"}
                                </span>
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-soft text-primary hover:bg-primary-soft/80 transition-colors"
                                >
                                    切换订阅 <ChevronRight size={14} className={showProfileMenu ? "rotate-90" : ""} />
                                </button>

                                {showProfileMenu && (
                                    <div className="absolute right-0 mt-2 w-56 bg-card border border-border shadow-lg rounded-xl z-50 py-1 overflow-hidden">
                                        {profiles.map(p => (
                                            <div
                                                key={p.id}
                                                onClick={async () => {
                                                    await selectProfile(p.id);
                                                    setShowProfileMenu(false);
                                                    fetchData();
                                                }}
                                                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-muted transition-colors flex items-center justify-between ${activeProfile?.id === p.id ? 'text-primary font-bold bg-primary-soft/30' : 'text-text'}`}
                                            >
                                                <span className="truncate">{p.name}</span>
                                                {activeProfile?.id === p.id && <Check size={14} />}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-1.5 text-[13px] text-text-2">
                            <p className="flex items-center gap-2">
                                <span className="opacity-70">来源:</span>
                                <span className="font-mono truncate max-w-[300px]">
                                    {activeProfile?.url ? (() => {
                                        try {
                                            return activeProfile.url.startsWith('http') ? new URL(activeProfile.url).hostname : activeProfile.url;
                                        } catch (e) {
                                            return activeProfile.url;
                                        }
                                    })() : (activeProfile?.type === 'local' ? "本地配置" : "None")}
                                </span>
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="opacity-70">更新:</span>
                                <span className="font-mono">
                                    {activeProfile?.updated ? new Date(activeProfile.updated).toLocaleString() : "-"}
                                </span>
                            </p>
                            <p className="flex items-center gap-2 mt-1">
                                <span className="opacity-70">已使用:</span>
                                <span className="text-text font-medium">
                                    {(activeProfile?.usage?.used && activeProfile.usage.total > 0) ? (activeProfile.usage.used / 1024 ** 3).toFixed(2) : "0.00"}GB
                                </span>
                                <span className="opacity-40">/</span>
                                <span className="opacity-70">
                                    {(activeProfile?.usage?.total && activeProfile.usage.total > 0) ? (activeProfile.usage.total / 1024 ** 3).toFixed(2) + "GB" : "Unlimited"}
                                </span>
                            </p>
                        </div>

                        <div className="mt-auto pt-4">
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-500"
                                    style={{ width: `${activeProfile?.usage?.total ? Math.min(100, (activeProfile.usage.used / activeProfile.usage.total) * 100) : 0}%` }}
                                ></div>
                            </div>
                        </div>
                    </Card>

                    {/* 2. Current Node */}
                    <Card className="col-span-5 h-[260px] relative bg-[#F8FAFC]">
                        <div className="flex justify-between items-center mb-4">
                            <SectionTitle icon={Wifi} title="当前节点" />
                            <div className="flex gap-2 text-text-2 items-center">
                                <Activity size={14} className="hover:text-primary cursor-pointer transition-colors" onClick={() => navigate('/connections')} />
                                <Clock size={14} className="hover:text-primary cursor-pointer transition-colors ml-1" onClick={() => navigate('/proxies')} />
                                <button
                                    onClick={() => navigate('/proxies')}
                                    className="flex items-center gap-1 bg-white border border-border px-2 py-0.5 rounded-full text-primary hover:bg-primary-soft transition-all ml-1 text-[11px] font-medium shadow-sm"
                                >
                                    代理 <ChevronRight size={10} />
                                </button>
                            </div>
                        </div>

                        {/* Node Display - High Fidelity */}
                        <div className="flex items-center gap-3 rounded-2xl border px-4 py-3 bg-[#EFF6FF] border-[#CFE3FF] min-h-[68px] mb-4 shadow-[0_2px_10px_-4px_rgba(59,130,246,0.15)] relative overflow-hidden group">
                            <div className="flex flex-col flex-1 min-w-0 z-10">
                                <div className="truncate text-[15px] font-bold tracking-tight text-text leading-tight mb-1">
                                    {currentNode ? currentNode.name : "未选择节点"}
                                </div>
                                <div className="flex items-center">
                                    <span className="px-2 py-0.5 rounded-[6px] bg-white border border-border text-[9px] font-bold text-text-2 uppercase shadow-sm">
                                        {currentNode ? currentNode.type : "-"}
                                    </span>
                                </div>
                            </div>

                            {/* Latency Pill */}
                            {currentNode && (
                                <div className={`px-2.5 py-1 rounded-full text-[11px] font-black text-white shadow-sm transition-all group-hover:scale-105 z-10 ${currentNode.history && currentNode.history.length > 0 && currentNode.history[currentNode.history.length - 1].delay > 0
                                    ? 'bg-emerald-500'
                                    : 'bg-rose-500'
                                    }`}>
                                    {currentNode.history && currentNode.history.length > 0
                                        ? (currentNode.history[currentNode.history.length - 1].delay === 0 ? 'Timeout' : `${currentNode.history[currentNode.history.length - 1].delay}ms`)
                                        : '-'
                                    }
                                </div>
                            )}
                        </div>

                        {/* Dropdowns */}
                        <div className="grid gap-3 mt-auto relative">
                            {/* Proxy Group Select */}
                            <div className="flex items-center gap-3 relative">
                                <label className="w-14 text-xs text-text-2 shrink-0">代理组</label>
                                <div
                                    className="flex-1 h-10 flex items-center justify-between px-3 rounded-lg border border-border bg-background hover:bg-muted cursor-pointer transition-colors relative z-20"
                                    onClick={() => { setIsGroupMenuOpen(!isGroupMenuOpen); setIsNodeMenuOpen(false); }}
                                >
                                    <span className="text-[13px] font-medium text-text truncate">
                                        {selectedGroup || 'Loading...'}
                                    </span>
                                    <ChevronRight size={14} className={`text-text-2 shrink-0 transition-transform ${isGroupMenuOpen ? '-rotate-90' : 'rotate-90'}`} />
                                </div>
                                {/* Group Menu */}
                                {isGroupMenuOpen && (
                                    <div className="absolute top-full left-[68px] right-0 mt-1 max-h-[160px] overflow-y-auto bg-card border border-border shadow-lg rounded-xl z-50 py-1">
                                        {Object.values(proxies)
                                            .filter(p => p.type === 'Selector' || (p.name === 'GLOBAL' && mode === 'global'))
                                            .map(p => (
                                                <div
                                                    key={p.name}
                                                    onClick={() => { setSelectedGroup(p.name); setIsGroupMenuOpen(false); fetchData(); }}
                                                    className={`px-3 py-2 text-xs cursor-pointer hover:bg-muted transition-colors flex justify-between items-center ${selectedGroup === p.name ? 'text-primary font-bold bg-primary-soft/30' : 'text-text'}`}
                                                >
                                                    <span className="truncate">{p.name}</span>
                                                    <span className="text-[10px] text-text-2 truncate max-w-[80px]">{p.now}</span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* Node Select */}
                            <div className="flex items-center gap-3 relative">
                                <label className="w-14 text-xs text-text-2 shrink-0">节点</label>
                                <div
                                    className="flex-1 h-10 flex items-center justify-between px-3 rounded-lg border border-border bg-background hover:bg-muted cursor-pointer transition-colors relative z-10"
                                    onClick={() => { if (selectedGroup) { setIsNodeMenuOpen(!isNodeMenuOpen); setIsGroupMenuOpen(false); } }}
                                >
                                    <span className="text-[13px] font-medium text-text truncate">
                                        {proxies[selectedGroup]?.now || "-"}
                                    </span>
                                    <ChevronRight size={14} className={`text-text-2 shrink-0 transition-transform ${isNodeMenuOpen ? '-rotate-90' : 'rotate-90'}`} />
                                </div>
                                {/* Node Menu */}
                                {isNodeMenuOpen && selectedGroup && proxies[selectedGroup] && (
                                    <div className="absolute bottom-full left-[68px] right-0 mb-1 max-h-[200px] overflow-y-auto bg-card border border-border shadow-lg rounded-xl z-50 py-1">
                                        {proxies[selectedGroup].all.map(nodeName => {
                                            const node = proxies[nodeName];
                                            const delay = node?.history?.[node.history.length - 1]?.delay;
                                            return (
                                                <div
                                                    key={nodeName}
                                                    onClick={() => handleNodeSelect(nodeName)}
                                                    className={`px-3 py-2 text-xs cursor-pointer hover:bg-muted transition-colors flex justify-between items-center ${proxies[selectedGroup].now === nodeName ? 'text-primary font-bold bg-primary-soft/30' : 'text-text'}`}
                                                >
                                                    <span className="truncate flex-1">{nodeName}</span>
                                                    {(delay || delay === 0) && (
                                                        <span className={`text-[10px] ml-2 shrink-0 ${delay === 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                            {delay === 0 ? 'Timeout' : `${delay}ms`}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* 3. Network Settings */}
                    <Card className="col-span-6 h-auto">
                        <SectionTitle icon={Settings} title="网络设置" />



                        {/* Segmented Control */}
                        <div className="bg-muted p-1 rounded-[14px] flex mb-4">
                            <button
                                onClick={() => setActiveTab('system')}
                                className={`flex-1 py-1.5 text-[13px] font-medium rounded-[12px] transition-all flex items-center justify-center gap-2 ${activeTab === 'system' ? 'bg-primary text-white shadow-sm' : 'text-text-2 hover:text-text'}`}>
                                <Monitor size={16} />
                                系统代理
                            </button>
                            <button
                                onClick={() => setActiveTab('tun')}
                                className={`flex-1 py-1.5 text-[13px] font-medium rounded-[12px] transition-all flex items-center justify-center gap-2 ${activeTab === 'tun' ? 'bg-primary text-white shadow-sm' : 'text-text-2 hover:text-text'}`}>
                                <Activity size={16} />
                                虚拟网卡模式
                            </button>
                        </div>

                        {/* Hint Box & Toggle */}
                        {activeTab === 'system' ? (
                            <>
                                <div className="bg-white border border-primary text-center py-2.5 rounded-lg mb-5 text-xs text-text-2 relative">
                                    {systemProxy ? "系统代理已开启，自动接管流量" : "系统代理已关闭，建议大多数用户打开此选项"}
                                    <span className="inline-block ml-1 border rounded-full w-3.5 h-3.5 text-[10px] leading-3 text-center cursor-help">?</span>
                                </div>
                                <div className="flex items-center justify-between pl-1 pr-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-text-2">
                                            <Power size={16} />
                                        </div>
                                        <span className="text-[14px] font-medium text-text">系统代理</span>
                                        <Settings size={14} className="text-text-2 cursor-pointer hover:text-primary" onClick={() => navigate('/settings')} />
                                    </div>
                                    <Switch
                                        checked={systemProxy}
                                        onChange={() => updateSystemProxy(!systemProxy)}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="bg-white border border-primary text-center py-2.5 rounded-lg mb-5 text-xs text-text-2">
                                    {tunMode ? "TUN 模式已开启，接管系统流量" : "TUN 模式已关闭，适用于特殊应用"}
                                    <span className="inline-block ml-1 border rounded-full w-3.5 h-3.5 text-[10px] leading-3 text-center cursor-help">?</span>
                                </div>
                                <div className="flex items-center justify-between pl-1 pr-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-text-2">
                                            <Shield size={16} />
                                        </div>
                                        <span className="text-[14px] font-medium text-text">虚拟网卡模式</span>
                                        <Settings size={14} className="text-text-2 cursor-pointer hover:text-primary" onClick={() => navigate('/settings')} />
                                    </div>
                                    <Switch
                                        checked={tunMode}
                                        onChange={() => updateTunMode(!tunMode)}
                                    />
                                </div>
                            </>
                        )}
                    </Card>

                    {/* 4. Proxy Mode */}
                    < Card className="col-span-6 h-auto" >
                        <SectionTitle icon={Router} title="代理模式" />

                        <div className="flex gap-3 mb-4">
                            {[
                                { id: 'rule', label: '规则', icon: Router },
                                { id: 'global', label: '全局', icon: Globe },
                                { id: 'direct', label: '直连', icon: Zap }
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={async () => {
                                        try {
                                            const newMode = item.id.charAt(0).toUpperCase() + item.id.slice(1);
                                            await updateConfig({ mode: newMode });
                                            setMode(item.id);
                                            // Refresh data to verify backend state and update UI (including defaultGroup heuristic)
                                            await fetchData();
                                        } catch (e) {
                                            console.error("Failed to switch mode", e);
                                        }
                                    }}
                                    className={`flex-1 h-[84px] flex flex-col items-center justify-center gap-2 rounded-xl border transition-all duration-200 ${mode === item.id
                                        ? 'bg-primary-soft border-primary/20 text-primary shadow-sm'
                                        : 'bg-background border-border text-text-2 hover:bg-muted'
                                        }`}
                                >
                                    <item.icon size={22} className={mode === item.id ? 'text-primary' : 'text-text-2'} />
                                    <span className="text-sm font-bold">{item.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="bg-background border border-border rounded-lg p-3 text-xs text-text-2 text-center leading-relaxed">
                            基于预设规则智能判断流量走向，提供灵活的代理策略
                        </div>
                    </Card >
                </div >

                {/* --- Row 3: Traffic Statistics --- */}
                <Card className="col-span-12 h-auto p-0 overflow-hidden mb-5">
                    <div className="p-5 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shadow-sm">
                            <Activity size={20} />
                        </div>
                        <span className="text-lg font-bold text-text">流量统计</span>
                    </div>

                    {/* Chart Container */}
                    <div className="px-5 pb-5">
                        <div className="h-[220px] min-h-[220px] bg-muted/20 w-full rounded-2xl border border-border p-4 relative overflow-hidden">
                            <div className="absolute top-4 right-6 flex gap-4 text-[11px] font-bold z-10">
                                <div className="flex items-center gap-1.5 text-orange-500">
                                    <div className="w-2 h-2 rounded-full bg-orange-500" /> 上传
                                </div>
                                <div className="flex items-center gap-1.5 text-blue-500">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" /> 下载
                                </div>
                            </div>

                            <div className="w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={trafficHistory}
                                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                                        <XAxis
                                            dataKey="time"
                                            hide={true} // Hide time labels to match reference's minimalist style if they overlap
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis hide={true} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                                            formatter={(val) => formatSpeed(val)}
                                            labelStyle={{ display: 'none' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="up"
                                            stroke="#f97316"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#colorUp)"
                                            isAnimationActive={false}
                                            connectNulls={true}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="down"
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#colorDown)"
                                            isAnimationActive={false}
                                            connectNulls={true}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Stat Grid - 2 Rows, 3 Columns */}
                    <div className="px-5 pb-6">
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: '上传速度', val: formatSpeed(traffic.up), icon: Upload, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' },
                                { label: '下载速度', val: formatSpeed(traffic.down), icon: Download, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
                                { label: '活跃连接', val: connections.connections?.length || '0', icon: RotateCw, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-100' },
                                { label: '上传量', val: formatBytes(connections.uploadTotal || 0), icon: Upload, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' },
                                { label: '下载量', val: formatBytes(connections.downloadTotal || 0), icon: Cloud, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
                                { label: '内存占用', val: formatBytes(memory), icon: Cpu, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
                            ].map((s, i) => (
                                <div key={i} className={`bg-card p-4 rounded-2xl border ${s.border} flex items-center gap-4 hover:shadow-sm transition-all cursor-default group`}>
                                    <div className={`w-11 h-11 rounded-full ${s.bg} flex items-center justify-center ${s.color} transition-transform group-hover:scale-110`}>
                                        <s.icon size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-[13px] text-text-2 font-medium">{s.label}</div>
                                        <div className="font-bold text-text text-lg tracking-tight">{s.val}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card >

                {/* --- Row 4: Site Test & IP Info --- */}
                < div className="grid grid-cols-12 gap-5 mb-5" >
                    {/* Web Tests */}
                    < Card className="col-span-5 h-[240px]" >
                        <div className="flex justify-between items-center mb-5">
                            <SectionTitle icon={Wifi} title="网站测试" />
                            <div className="flex gap-1">
                                <IconButton icon={Wifi} onClick={handleAllSitesTest} />
                                <IconButton icon={MoreHorizontal} onClick={() => navigate('/test')} />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 px-2">
                            {TEST_SITES.map((site, i) => (
                                <div key={i} className="flex flex-col items-center gap-3 group cursor-pointer" onClick={() => handleSiteTest(site)}>
                                    <button className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-primary group-hover:-translate-y-1 group-hover:shadow-lg group-hover:shadow-blue-500/10 flex items-center justify-center transition-all duration-300 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors"></div>
                                        <site.icon size={26} className={siteDelays[site.name] && siteDelays[site.name] !== '...' ? 'text-primary' : ''} />
                                    </button>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[13px] text-text font-medium group-hover:text-primary transition-colors">{site.name}</span>
                                        <span className={`text-xs font-bold font-mono ${!siteDelays[site.name] ? 'text-slate-300' :
                                            siteDelays[site.name] === '...' ? 'text-slate-400' :
                                                siteDelays[site.name] === 'Timeout' || siteDelays[site.name] === 'Error' ? 'text-red-500' :
                                                    'text-emerald-500' // Green for success
                                            } transition-colors`}>
                                            {siteDelays[site.name] || '待检测'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card >

                    {/* IP Info */}
                    < Card className="col-span-7 h-[240px]" >
                        <div className="flex justify-between items-center mb-3">
                            <SectionTitle icon={MapPin} title="IP 信息" />
                            <IconButton icon={RefreshCw} onClick={fetchIpInfo} spin={isIpLoading} />
                        </div>

                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                            <div className="col-span-2 flex items-center gap-2 mb-2">
                                {ipInfo.country_code ? (
                                    <span className="w-5 h-4 bg-muted border rounded-sm relative overflow-hidden shadow-sm">
                                        <img
                                            src={`https://flagcdn.com/w40/${ipInfo.country_code.toLowerCase()}.png`}
                                            alt={ipInfo.country_code}
                                            className="w-full h-full object-cover"
                                        />
                                    </span>
                                ) : (
                                    <span className="w-5 h-4 bg-muted border rounded-sm"></span>
                                )}
                                <span className="text-lg font-bold text-text">{ipInfo.country}</span>
                            </div>

                            <div className="space-y-3 text-[13px] text-text-2">
                                <p className="flex justify-between border-b border-border/50 pb-1">
                                    <span>IP:</span>
                                    <span className="font-mono text-text font-medium">{ipInfo.ip}</span>
                                </p>
                                <p className="flex justify-between border-b border-border/50 pb-1">
                                    <span>自治域:</span>
                                    <span className="text-text font-medium">{ipInfo.asn}</span>
                                </p>
                                <p className="text-xs pt-2 text-text-2 opacity-60">自动刷新: {ipCountdown}s</p>
                            </div>

                            <div className="space-y-3 text-[13px] text-text-2">
                                <p className="flex justify-between border-b border-border/50 pb-1">
                                    <span>服务商:</span>
                                    <span className="text-text font-medium truncate ml-2" title={ipInfo.organization}>{ipInfo.organization}</span>
                                </p>
                                <p className="flex justify-between border-b border-border/50 pb-1">
                                    <span>位置:</span>
                                    <span className="text-text font-medium truncate ml-2">{ipInfo.city}, {ipInfo.country}</span>
                                </p>
                                <p className="flex justify-between border-b border-border/50 pb-1">
                                    <span>时区:</span>
                                    <span className="text-text font-medium">{ipInfo.timezone}</span>
                                </p>
                                <p className="text-right text-[10px] font-mono text-text-2 opacity-60 pt-2">
                                    {ipInfo.country_code}, {ipInfo.longitude}, {ipInfo.latitude}
                                </p>
                            </div>
                        </div>
                    </Card >
                </div >

                {/* --- Row 5: Info Cards --- */}
                <div className="grid grid-cols-12 gap-5 mb-5 pb-10">
                    {/* Clash Info */}
                    <Card className="col-span-6 h-auto p-0 overflow-hidden">
                        <div className="p-4 border-b border-border flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-400 flex items-center justify-center">
                                <CircuitBoard size={18} />
                            </div>
                            <span className="font-bold text-text text-[15px]">Clash 信息</span>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex justify-between items-center text-[13px]">
                                <span className="text-text-2">内核版本</span>
                                <span className="font-bold text-text tracking-tight">{clashInfo.version}</span>
                            </div>
                            <div className="h-px w-full bg-border/40"></div>
                            <div className="flex justify-between items-center text-[13px]">
                                <span className="text-text-2">系统代理地址</span>
                                <span className="font-mono text-text font-bold">127.0.0.1:{clashInfo.mixedPort}</span>
                            </div>
                            <div className="h-px w-full bg-border/40"></div>
                            <div className="flex justify-between items-center text-[13px]">
                                <span className="text-text-2">混合代理端口</span>
                                <span className="text-text font-bold">-</span>
                            </div>
                            <div className="h-px w-full bg-border/40"></div>
                            <div className="flex justify-between items-center text-[13px]">
                                <span className="text-text-2">运行时间</span>
                                <span className="font-mono text-text font-bold">{clashInfo.uptime}</span>
                            </div>
                            <div className="h-px w-full bg-border/40"></div>
                            <div className="flex justify-between items-center text-[13px]">
                                <span className="text-text-2">规则数量</span>
                                <span className="text-text font-bold">{clashInfo.rulesCount}</span>
                            </div>
                        </div>
                    </Card>

                    {/* System Info */}
                    <Card className="col-span-6 h-auto p-0 overflow-hidden">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-400 flex items-center justify-center">
                                    <Info size={18} />
                                </div>
                                <span className="font-bold text-text text-[15px]">系统信息</span>
                            </div>
                            <Settings size={18} className="text-text-2 hover:text-primary cursor-pointer transition-colors" onClick={() => navigate('/settings')} />
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex justify-between items-center text-[13px]">
                                <span className="text-text-2">操作系统信息</span>
                                <span className="font-bold text-text">{sysInfo.os}</span>
                            </div>
                            <div className="h-px w-full bg-border/40"></div>
                            <div className="flex justify-between items-center text-[13px]">
                                <span className="text-text-2">开机自启</span>
                                <Badge className="bg-white text-text-2 border-border/60 px-3 py-1 font-bold">
                                    {sysInfo.autoStart ? '已开启' : '未启用'}
                                </Badge>
                            </div>
                            <div className="h-px w-full bg-border/40"></div>
                            <div className="flex justify-between items-center text-[13px]">
                                <span className="text-text-2">运行模式</span>
                                <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                                    <Database size={14} className="text-emerald-500" />
                                    <span>{sysInfo.mode}</span>
                                </div>
                            </div>
                            <div className="h-px w-full bg-border/40"></div>
                            <div className="flex justify-between items-center text-[13px]">
                                <span className="text-text-2">最后检查更新</span>
                                <span className="text-text font-bold underline underline-offset-4 decoration-border/60">{sysInfo.lastCheck}</span>
                            </div>
                            <div className="h-px w-full bg-border/40"></div>
                            <div className="flex justify-between items-center text-[13px]">
                                <span className="text-text-2">Verge 版本</span>
                                <span className="font-bold text-text">{sysInfo.vergeVersion}</span>
                            </div>
                        </div>
                    </Card>
                </div>

            </div >
        </div >
    );
};

export default Dashboard;
