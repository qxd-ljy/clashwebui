import React from 'react';
import { Save, Wifi, Globe, Network, Server, Terminal, Key, FolderOpen, FileCode, Zap, Power } from 'lucide-react';
import Card from '../components/UI/Card';
import './Settings.css';
import { useSettings } from '../contexts/SettingsContext';
import Switch from '../components/UI/Switch';

const Settings = () => {
    const {
        systemProxy, tunMode, ipv6, lanAccess,
        mixedPort, backendPort, externalController, secret,
        clashBinaryPath, clashConfigDir,
        pythonInterpreterPath, webuiWorkingDirectory,
        isInitialLoading: loading,
        updateSystemProxy, updateTunMode,
        updatePreferenceField, updateConfigField,
        refreshSettings
    } = useSettings();

    const [autoStartEnabled, setAutoStartEnabled] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    // Refresh settings when component mounts (page is visited)
    React.useEffect(() => {
        refreshSettings();
    }, []);

    React.useEffect(() => {
        // Use relative path to leverage Vite proxy
        fetch('/backend/auto_start/status')
            .then(res => res.json())
            .then(data => setAutoStartEnabled(data.enabled))
            .catch(err => console.error('Failed to fetch auto-start status:', err));
    }, []);

    const toggleAutoStart = async () => {
        try {
            const res = await fetch('/backend/auto_start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enable: !autoStartEnabled })
            });
            const data = await res.json();
            if (data.success) {
                setAutoStartEnabled(req => !req); // Toggle local state based on success
            }
        } catch (err) {
            console.error('Failed to toggle auto-start:', err);
            // Revert on error if needed, or just log
            setAutoStartEnabled(prev => !prev); // Revert UI
        }
    };

    const toggle = async (key) => {
        if (key === 'systemProxy') await updateSystemProxy(!systemProxy);
        else if (key === 'tunMode') await updateTunMode(!tunMode);
        else if (key === 'ipv6') await updatePreferenceField('ipv6', !ipv6);
        else if (key === 'lanAccess') await updatePreferenceField('lanAccess', !lanAccess);
    };

    const saveSettings = async () => {
        setIsSaving(true);
        setTimeout(() => setIsSaving(false), 1000);
    };

    return (
        <div className="h-full overflow-y-auto bg-background p-6 custom-scrollbar">
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-text flex items-center gap-2">
                        <Server className="text-primary" size={24} strokeWidth={2.5} />
                        设置
                    </h1>
                    <button
                        onClick={saveSettings}
                        disabled={isSaving}
                        className="h-9 px-4 bg-primary text-white rounded-lg font-medium shadow-sm hover:bg-primary/90 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                        <Save size={16} />
                        {isSaving ? '保存中...' : '保存设置'}
                    </button>
                </div>

                <div className="space-y-5">

                    {/* 网络设置 */}
                    <Card className="modern-card">
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <Network size={18} className="text-primary" strokeWidth={2.5} />
                                <h2 className="text-base font-semibold text-slate-800">网络设置</h2>
                            </div>
                        </div>
                        <div className="p-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                                            <Wifi size={18} className="text-slate-600" strokeWidth={2} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-800">允许局域网</div>
                                            <div className="text-xs text-slate-500">其他设备可访问</div>
                                        </div>
                                    </div>
                                    <Switch checked={lanAccess} onChange={() => toggle('lanAccess')} noTransition={loading} />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                                            <Globe size={18} className="text-slate-600" strokeWidth={2} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-800">TUN 模式</div>
                                            <div className="text-xs text-slate-500">内核级接管</div>
                                        </div>
                                    </div>
                                    <Switch checked={tunMode} onChange={() => toggle('tunMode')} noTransition={loading} />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                                            <Globe size={18} className="text-slate-600" strokeWidth={2} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-800">IPv6 支持</div>
                                            <div className="text-xs text-slate-500">启用IPv6转发</div>
                                        </div>
                                    </div>
                                    <Switch checked={ipv6} onChange={() => toggle('ipv6')} noTransition={loading} />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                                            <Zap size={18} className="text-slate-600" strokeWidth={2} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-800">系统代理</div>
                                            <div className="text-xs text-slate-500">控制Clash进程</div>
                                        </div>
                                    </div>
                                    <Switch checked={systemProxy} onChange={() => toggle('systemProxy')} noTransition={loading} />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Clash 配置 */}
                    <Card className="modern-card">
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <Terminal size={18} className="text-primary" strokeWidth={2.5} />
                                <h2 className="text-base font-semibold text-slate-800">Clash 配置</h2>
                            </div>
                        </div>
                        <div className="p-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                                        <Server size={14} />
                                        外部控制地址
                                    </label>
                                    <input
                                        type="text"
                                        value={externalController}
                                        onChange={(e) => updatePreferenceField('externalController', e.target.value)}
                                        placeholder="127.0.0.1:9092"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                                        <Key size={14} />
                                        API 密钥
                                    </label>
                                    <input
                                        type="password"
                                        value={secret}
                                        onChange={(e) => updatePreferenceField('secret', e.target.value)}
                                        placeholder="留空表示无密钥"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-2 block">混合端口</label>
                                    <input
                                        type="number"
                                        value={mixedPort}
                                        onChange={(e) => updatePreferenceField('mixedPort', parseInt(e.target.value) || 7890)}
                                        placeholder="7890"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-2 block">后端端口</label>
                                    <input
                                        type="number"
                                        value={backendPort}
                                        onChange={(e) => updatePreferenceField('backendPort', parseInt(e.target.value) || 3001)}
                                        placeholder="3001"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* 路径配置 */}
                    <Card className="modern-card">
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <FolderOpen size={18} className="text-primary" strokeWidth={2.5} />
                                <h2 className="text-base font-semibold text-slate-800">路径配置</h2>
                            </div>
                        </div>
                        <div className="p-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                                        <FileCode size={14} />
                                        Clash 二进制
                                    </label>
                                    <input
                                        type="text"
                                        value={clashBinaryPath}
                                        onChange={(e) => updatePreferenceField('clashBinaryPath', e.target.value)}
                                        placeholder="~/.bin/clash"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                                        <FolderOpen size={14} />
                                        配置目录
                                    </label>
                                    <input
                                        type="text"
                                        value={clashConfigDir}
                                        onChange={(e) => updatePreferenceField('clashConfigDir', e.target.value)}
                                        placeholder="~/.config/clash"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                                        <Terminal size={14} />
                                        Python 解释器
                                    </label>
                                    <input
                                        type="text"
                                        value={pythonInterpreterPath || ''}
                                        onChange={(e) => updatePreferenceField('pythonInterpreterPath', e.target.value || null)}
                                        placeholder="自动检测"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                                        <FolderOpen size={14} />
                                        WebUI 工作目录
                                    </label>
                                    <input
                                        type="text"
                                        value={webuiWorkingDirectory || ''}
                                        onChange={(e) => updatePreferenceField('webuiWorkingDirectory', e.target.value || null)}
                                        placeholder="当前目录"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* 系统控制 */}
                    <Card className="modern-card">
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <Power size={18} className="text-primary" strokeWidth={2.5} />
                                <h2 className="text-base font-semibold text-slate-800">开机自启</h2>
                            </div>
                        </div>
                        <div className="p-5">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                                        <Power size={18} className="text-slate-600" strokeWidth={2} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-slate-800">开机自动启动</div>
                                        <div className="text-xs text-slate-500">Clash Core + WebUI 随系统启动</div>
                                    </div>
                                </div>
                                <Switch checked={autoStartEnabled} onChange={toggleAutoStart} noTransition={loading} />
                            </div>
                        </div>
                    </Card>

                </div>
            </div>
        </div>
    );
};

export default Settings;
