import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { getProxies, setProxy, updateConfig, getConfigs, getProxyDelay } from '../api/clash';
import ProxyGroup from '../components/Proxies/ProxyGroup';
import { Layers, Globe, Zap, Link } from 'lucide-react';
import './Proxies.css';

const Proxies = () => {
    const navigate = useNavigate();
    const { proxyRefreshSignal } = useSettings();
    const [groups, setGroups] = useState([]);
    const [mode, setMode] = useState('rule');

    useEffect(() => {
        getConfigs().then(c => setMode(c.mode?.toLowerCase() || 'rule'));
    }, []);

    const switchMode = async (m) => {
        await updateConfig({ mode: m });
        setMode(m.toLowerCase());
    };

    const selectProxy = async (groupName, nodeName) => {
        try {
            const success = await setProxy(groupName, nodeName);
            if (!success) return;
            setGroups(prev => prev.map(g => {
                if (g.name === groupName) {
                    return { ...g, now: nodeName, activeNode: nodeName };
                }
                return g;
            }));
        } catch (e) {
            console.error(e);
        }
    };

    const testLatency = async (groupName) => {
        const group = groups.find(g => g.name === groupName);
        if (!group) return;

        // Simple concurrency limiter
        const limit = (concurrency) => {
            const queue = [];
            let active = 0;
            const next = () => {
                active--;
                if (queue.length > 0) queue.shift()();
            };
            return (fn) => new Promise((resolve, reject) => {
                const run = async () => {
                    active++;
                    try { resolve(await fn()); } catch (e) { reject(e); } finally { next(); }
                };
                if (active < concurrency) run();
                else queue.push(run);
            });
        };

        const runTask = limit(15); // Run 15 at a time

        await Promise.all(group.nodes.map(node => runTask(async () => {
            try {
                if (node.name === 'REJECT' || node.name === 'DIRECT') return;

                // Set testing state UI
                setGroups(prev => prev.map(g => {
                    if (g.name === groupName) {
                        return {
                            ...g,
                            nodes: g.nodes.map(n => {
                                if (n.name === node.name) return { ...n, testing: true };
                                return n;
                            })
                        };
                    }
                    return g;
                }));

                const res = await getProxyDelay(node.name, 'http://www.gstatic.com/generate_204', 2500);
                const delay = res.delay;

                if (typeof delay !== 'number') throw new Error("Invalid delay");

                // Update Success
                setGroups(prev => prev.map(g => {
                    if (g.name === groupName) {
                        return {
                            ...g,
                            nodes: g.nodes.map(n => {
                                if (n.name === node.name) return { ...n, latency: delay, testing: false };
                                return n;
                            })
                        };
                    }
                    return g;
                }));
            } catch (e) {
                // Update Timeout/Error
                setGroups(prev => prev.map(g => {
                    if (g.name === groupName) {
                        return {
                            ...g,
                            nodes: g.nodes.map(n => {
                                if (n.name === node.name) return { ...n, latency: null, testing: false };
                                return n;
                            })
                        };
                    }
                    return g;
                }));
            }
        })));
    };

    const testNodeLatency = async (groupName, nodeName) => {
        // Update UI to testing
        setGroups(prev => prev.map(g => {
            if (g.name === groupName) {
                return {
                    ...g,
                    nodes: g.nodes.map(n => {
                        if (n.name === nodeName) return { ...n, testing: true };
                        return n;
                    })
                };
            }
            return g;
        }));

        try {
            const res = await getProxyDelay(nodeName, 'http://www.gstatic.com/generate_204', 2500);
            const delay = res.delay;
            if (typeof delay !== 'number') throw new Error("Invalid delay");

            // Update Success
            setGroups(prev => prev.map(g => {
                if (g.name === groupName) {
                    return {
                        ...g,
                        nodes: g.nodes.map(n => {
                            if (n.name === nodeName) return { ...n, latency: delay, testing: false };
                            return n;
                        })
                    };
                }
                return g;
            }));
        } catch (e) {
            // Update Timeout/Error
            setGroups(prev => prev.map(g => {
                if (g.name === groupName) {
                    return {
                        ...g,
                        nodes: g.nodes.map(n => {
                            if (n.name === nodeName) return { ...n, latency: null, testing: false };
                            return n;
                        })
                    };
                }
                return g;
            }));
        }
    };

    const fetchProxies = async () => {
        try {
            const data = await getProxies();
            const proxies = data.proxies;

            const groupList = Object.values(proxies)
                .filter(p => ['Selector', 'URLTest', 'Fallback'].includes(p.type))
                .map(p => ({
                    name: p.name,
                    type: p.type,
                    activeNode: p.now,
                    nodes: p.all.map(name => {
                        const nodeData = proxies[name];
                        return {
                            name: name,
                            type: nodeData ? nodeData.type : 'Unknown',
                            udp: nodeData?.udp,
                            xudp: nodeData?.xudp,
                            tfo: nodeData?.tfo,
                            latency: nodeData ? nodeData.history?.[nodeData.history.length - 1]?.delay : null
                        };
                    })
                }));

            // Priority stable sort
            groupList.sort((a, b) => {
                if (a.name === 'GLOBAL') return -1;
                if (b.name === 'GLOBAL') return 1;
                const getWeight = (type) => (type === 'Selector' ? 1 : 2);
                return getWeight(a.type) - getWeight(b.type);
            });

            setGroups(groupList);
        } catch (e) {
            console.error("Failed to fetch proxies", e);
        }
    };

    useEffect(() => {
        fetchProxies();
        const interval = setInterval(fetchProxies, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, [proxyRefreshSignal]); // Refresh when signal changes

    const modes = [
        { id: 'Rule', label: '规则' },
        { id: 'Global', label: '全局' },
        { id: 'Direct', label: '直连' }
    ];

    const [visibleCount, setVisibleCount] = useState(15);
    const containerRef = useRef(null);

    // Infinite scroll handler
    const handleScroll = (e) => {
        const { scrollTop, clientHeight, scrollHeight } = e.target;
        if (scrollHeight - scrollTop - clientHeight < 300) {
            setVisibleCount(prev => Math.min(prev + 10, groups.length)); // Load 10 more
        }
    };

    const filteredGroups = groups.filter(g => g.name !== 'GLOBAL' || mode === 'global');

    return (
        <div
            ref={containerRef}
            className="h-full overflow-y-auto bg-background p-6 custom-scrollbar"
            onScroll={handleScroll}
        >
            <div className="max-w-7xl mx-auto pb-20">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <Layers size={20} />
                        </div>
                        <h1 className="text-2xl font-bold text-text">代理组</h1>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex bg-muted p-1 rounded-xl">
                            {modes.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => switchMode(m.id)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${mode.toLowerCase() === m.id.toLowerCase() ? 'bg-white text-primary shadow-sm' : 'text-text-2 hover:text-text'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => navigate('/connections')}
                            className="flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors"
                        >
                            <Link size={14} /> 链式代理
                        </button>
                    </div>
                </div>

                {filteredGroups.slice(0, visibleCount).map(group => (
                    <ProxyGroup
                        key={group.name}
                        {...group}
                        onSelect={(nodeName) => selectProxy(group.name, nodeName)}
                        onUrlTest={testLatency}
                        onNodeUrlTest={(nodeName) => testNodeLatency(group.name, nodeName)}
                    />
                ))}

                {visibleCount < filteredGroups.length && (
                    <div className="py-8 flex justify-center">
                        <div className="flex items-center gap-2 text-text-3 text-sm">
                            <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0s' }}></div>
                            <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Proxies;
