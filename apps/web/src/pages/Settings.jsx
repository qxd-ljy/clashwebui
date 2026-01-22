import React, { useState } from 'react';
import {
    Save, Laptop, Power, Wifi, Globe, Network, Route, Server,
    Cpu, Terminal, Key, Shield, Zap, Layers, Activity, Settings as SettingsIcon
} from 'lucide-react';
import Card from '../components/UI/Card';
import './Settings.css';
import { useSettings } from '../contexts/SettingsContext';
import Switch from '../components/UI/Switch';

// Modern Clean Setting Item
const SettingItem = ({ icon: Icon, label, description, children, danger = false }) => (
    <div className={`setting-item group ${danger ? 'danger' : ''}`}>
        <div className="flex items-center gap-4">
            {Icon && (
                <div className={`p-2.5 rounded-xl transition-all duration-300 ${danger ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-primary'}`}>
                    <Icon size={20} strokeWidth={2} />
                </div>
            )}
            <div className="setting-info">
                <div className="setting-label text-[15px] font-medium text-slate-800 group-hover:text-primary transition-colors">{label}</div>
                {description && <div className="setting-desc text-xs text-slate-400 mt-0.5 font-normal">{description}</div>}
            </div>
        </div>
        <div className="setting-control pl-4">
            {children}
        </div>
    </div>
);

const Settings = () => {
    const {
        systemProxy, tunMode, ipv6, lanAccess,
        mixedPort, backendPort, externalController, secret,
        isInitialLoading: loading,
        updateSystemProxy, updateTunMode, updatePreferenceField, updateConfigField
    } = useSettings();

    const toggle = async (key) => {
        if (key === 'systemProxy') await updateSystemProxy(!systemProxy);
        else if (key === 'tunMode') await updateTunMode(!tunMode);
        else if (key === 'ipv6') await updateConfigField('ipv6', !ipv6);
        else if (key === 'lanAccess') await updateConfigField('lanAccess', !lanAccess);
    };

    const handleServiceChange = (field, value) => {
        updatePreferenceField(field, value);
    };

    const saveServiceSettings = () => {
        const btn = document.getElementById('save-btn');
        if (btn) {
            btn.innerHTML = '<span class="flex items-center gap-2"><div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>保存中...</span>';
            setTimeout(() => {
                btn.innerHTML = '<span class="flex items-center gap-2">已保存</span>';
                setTimeout(() => {
                    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-save"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> 保存设置';
                }, 2000);
            }, 800);
        }
    };

    return (
        <div className="h-full overflow-y-auto bg-background p-6 custom-scrollbar animate-fade-in">
            {/* Aligned Container matching Connections/Rules */}
            <div className="max-w-7xl mx-auto pb-20">

                {/* Header Section */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                                <SettingsIcon size={20} />
                            </div>
                            <h1 className="text-2xl font-bold text-text">系统设置</h1>
                        </div>

                        <button
                            id="save-btn"
                            onClick={saveServiceSettings}
                            className="h-10 px-5 bg-primary text-white rounded-xl font-medium shadow-sm hover:bg-primary/90 hover:shadow-md hover:translate-y-[-1px] active:translate-y-[0px] transition-all duration-200 flex items-center gap-2 text-sm"
                        >
                            <Save size={16} />
                            保存设置
                        </button>
                    </div>
                </div>

                <div className="settings-grid">
                    {/* System Settings */}
                    <Card className="modern-card">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                                <Laptop size={18} />
                            </div>
                            <h2 className="text-base font-bold text-slate-800">系统控制</h2>
                        </div>
                        <div className="p-4 space-y-1">
                            <SettingItem icon={Power} label="系统代理" description="自动接管系统 HTTP/HTTPS 流量">
                                <Switch checked={systemProxy} onChange={() => toggle('systemProxy')} noTransition={loading} />
                            </SettingItem>
                            <SettingItem icon={Zap} label="开机自启" description="随系统启动 Clash Verge Rev">
                                <Switch checked={false} onChange={() => { }} noTransition={loading} />
                            </SettingItem>
                        </div>
                    </Card>

                    {/* Network Settings */}
                    <Card className="modern-card">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-500 flex items-center justify-center">
                                <Network size={18} />
                            </div>
                            <h2 className="text-base font-bold text-slate-800">网络连接</h2>
                        </div>
                        <div className="p-4 space-y-1">
                            <SettingItem icon={Wifi} label="允许局域网连接" description="允许其他设备通过 IP 连接">
                                <Switch checked={lanAccess} onChange={() => toggle('lanAccess')} noTransition={loading} />
                            </SettingItem>
                            <SettingItem icon={Globe} label="IPv6 支持" description="启用 IPv6 协议栈支持">
                                <Switch checked={ipv6} onChange={() => toggle('ipv6')} noTransition={loading} />
                            </SettingItem>
                            <SettingItem icon={Shield} label="虚拟网卡 (TUN Mode)" description="接管系统所有流量 (包括非代理软件)">
                                <Switch checked={tunMode} onChange={() => toggle('tunMode')} noTransition={loading} />
                            </SettingItem>
                            <SettingItem icon={Route} label="混合端口 (Mixed Port)">
                                <div className="relative">
                                    <input
                                        type="number"
                                        className="ui-input-clean"
                                        value={mixedPort}
                                        onChange={(e) => handleServiceChange('mixedPort', e.target.value)}
                                    />
                                </div>
                            </SettingItem>
                            <SettingItem icon={Server} label="后端端口 (Backend Port)">
                                <div className="relative">
                                    <input
                                        type="number"
                                        className="ui-input-clean"
                                        value={backendPort}
                                        onChange={(e) => handleServiceChange('backendPort', e.target.value)}
                                    />
                                </div>
                            </SettingItem>
                        </div>
                    </Card>

                    {/* Kernel Settings */}
                    <Card className="modern-card">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center">
                                <Cpu size={18} />
                            </div>
                            <h2 className="text-base font-bold text-slate-800">Clash 内核</h2>
                        </div>
                        <div className="p-4 space-y-1">
                            <SettingItem icon={Activity} label="内核版本">
                                <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-mono font-bold">Mihomo Alpha</span>
                            </SettingItem>
                            <SettingItem icon={Terminal} label="外部控制">
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="ui-input-clean w-40 font-mono text-xs"
                                        value={externalController}
                                        onChange={(e) => handleServiceChange('externalController', e.target.value)}
                                    />
                                </div>
                            </SettingItem>
                            <SettingItem icon={Key} label="API 密钥 (Secret)">
                                <div className="relative">
                                    <input
                                        type="password"
                                        className="ui-input-clean w-40 font-mono text-xs tracking-widest"
                                        placeholder="无密码"
                                        value={secret}
                                        onChange={(e) => handleServiceChange('secret', e.target.value)}
                                    />
                                </div>
                            </SettingItem>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Settings;
