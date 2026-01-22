import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Globe, FileJson, Link, Ruler,
    FileText, Settings, ArrowUp, ArrowDown, Construction, PlayCircle
} from 'lucide-react';
import Logo from '../UI/Logo';

import { getTrafficWebSocket, getMemoryWebSocket } from '../../api/clash';
import { useSettings } from '../../contexts/SettingsContext';
import { useState, useEffect } from 'react';

const formatSpeed = (speed) => {
    if (speed < 1024) return `${speed} B/s`;
    if (speed < 1024 * 1024) return `${(speed / 1024).toFixed(2)} KB/s`;
    return `${(speed / 1024 / 1024).toFixed(2)} MB/s`;
};

const formatMemory = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const Sidebar = () => {
    const navItems = [
        { path: '/', label: '首页', icon: LayoutDashboard },
        { path: '/proxies', label: '代理', icon: Globe },
        { path: '/profiles', label: '订阅', icon: FileJson },
        { path: '/connections', label: '连接', icon: Link },
        { path: '/rules', label: '规则', icon: Ruler },
        { path: '/logs', label: '日志', icon: FileText },
        { path: '/test', label: '测试', icon: PlayCircle },
        { path: '/settings', label: '设置', icon: Settings },
    ];

    const { secret } = useSettings();
    const [traffic, setTraffic] = useState({ up: 0, down: 0 });
    const [memory, setMemory] = useState(0);

    useEffect(() => {
        const wsTraffic = getTrafficWebSocket(secret);
        wsTraffic.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setTraffic(data);
        };

        const wsMemory = getMemoryWebSocket(secret);
        wsMemory.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data && data.inuse) {
                setMemory(data.inuse);
            }
        };

        return () => {
            wsTraffic.close();
            wsMemory.close();
        };
    }, [secret]);

    return (
        <aside className="w-[240px] h-full bg-card border-r border-border flex flex-col shrink-0 font-sans z-50">
            {/* Brand Header */}
            <div className="h-[72px] flex items-center px-6 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="text-text">
                        <Logo size={32} />
                    </div>
                    <span className="text-xl font-bold text-text tracking-tight">ClashWebUI</span>
                </div>
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 px-4 py-2 flex flex-col gap-1 overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 h-[44px] rounded-xl text-[15px] font-medium transition-all duration-200 ${isActive
                                ? 'bg-primary-2 text-primary font-semibold'
                                : 'text-text-2 hover:bg-muted hover:text-text'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon
                                    size={20}
                                    className={`${isActive ? 'text-primary' : 'text-text-2'}`}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                                <span>{item.label}</span>
                                {isActive && <div className="ml-auto w-1 h-3.5 bg-primary rounded-full"></div>}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Footer Status */}
            <div className="p-5 border-t border-border bg-card/50 backdrop-blur-sm">
                <div className="space-y-2 mb-3">
                    <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-text-2 flex items-center gap-1.5 opacity-80">
                            <ArrowUp size={12} /> {formatSpeed(traffic.up)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-text-2 flex items-center gap-1.5 opacity-80">
                            <ArrowDown size={12} /> {formatSpeed(traffic.down)}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-text-2 opacity-80">
                    <Construction size={12} />
                    <span>{formatMemory(memory)}</span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
