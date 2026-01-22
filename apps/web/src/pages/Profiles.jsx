import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Check, DownloadCloud, FileText, Sparkles, Zap, Link as LinkIcon, ArrowRight, Clock, MoreHorizontal, Play, Edit3, FileCode, List, Globe, FolderOpen, Settings, X, Save, Layout, Share2, Layers } from 'lucide-react';
import Card from '../components/UI/Card';
import { getProfiles, importProfile, selectProfile, deleteProfile, updateProfile, patchProfile, getProfileContent, updateProfileContent } from '../api/clash';
import yaml from 'js-yaml';
import Switch from '../components/UI/Switch';

import { useSettings } from '../contexts/SettingsContext';

const Profiles = () => {
    const { triggerProxyRefresh } = useSettings();
    const [profiles, setProfiles] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [switching, setSwitching] = useState(false);
    const [isCreatingLocal, setIsCreatingLocal] = useState(false);
    const [localYaml, setLocalYaml] = useState('');
    const [localName, setLocalName] = useState('');

    // Edit Modal State
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState('info');
    const [editingProfile, setEditingProfile] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);
    const [editForm, setEditForm] = useState({
        name: '',
        desc: '',
        url: '',
        ua: '',
        interval: 0,
        autoUpdate: false,
        useSystemProxy: false,
        allowUnsafe: false
    });

    // Rules Editor State
    const [rulesList, setRulesList] = useState([]);
    const [newRule, setNewRule] = useState({ type: 'DOMAIN-SUFFIX', content: '', proxy: 'DIRECT' });

    // Proxies Editor State
    const [proxyList, setProxyList] = useState([]);
    const [proxyGroups, setProxyGroups] = useState([]);
    const [newNodesText, setNewNodesText] = useState('');

    useEffect(() => {
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        try {
            const data = await getProfiles();
            setProfiles(data.profiles || []);
            setSelectedId(data.selected);
        } catch (e) {
            console.error(e);
        }
    };

    const handleImport = async () => {
        if (!importUrl) return;
        setLoading(true);
        try {
            await importProfile({
                type: 'remote',
                url: importUrl,
                name: `Profile ${profiles.length + 1}`
            });
            setImportUrl('');
            setIsImporting(false);
            fetchProfiles();
        } catch (e) {
            alert('Import failed: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLocal = async () => {
        if (!localYaml || !localName) {
            alert('请输入配置名称和YAML内容');
            return;
        }
        setLoading(true);
        try {
            await importProfile({
                type: 'local',
                content: localYaml,
                name: localName
            });
            setLocalYaml('');
            setLocalName('');
            setIsCreatingLocal(false);
            fetchProfiles();
        } catch (e) {
            alert('创建失败: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (id) => {
        if (id === selectedId || switching) return; // Prevent double-click during switch

        setSwitching(true);
        try {
            await selectProfile(id);
            await fetchProfiles();
            triggerProxyRefresh(); // Notify Proxies page to reload
        } catch (e) {
            console.error(e);
            alert('切换订阅失败');
        } finally {
            setSwitching(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!confirm('确认删除该订阅？')) return;
        try {
            await deleteProfile(id);
            fetchProfiles();
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdate = async (e, id) => {
        e.stopPropagation();
        setUpdatingId(id);
        try {
            await updateProfile(id);
            fetchProfiles();
            alert('订阅已更新！');
        } catch (e) {
            console.error(e);
            alert('更新失败');
        } finally {
            setUpdatingId(null);
        }
    };

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    useEffect(() => {
        const loadContent = async () => {
            if (activeTab === 'file' && editingProfile && !editForm.content) {
                try {
                    const res = await getProfileContent(editingProfile.id);
                    setEditForm(prev => ({ ...prev, content: res.content || '' }));
                } catch (e) {
                    console.error("Failed to load profile content", e);
                }
            } else if ((activeTab === 'rules' || activeTab === 'proxies') && editingProfile) {
                // Ensure content is loaded
                let content = editForm.content;
                if (!content) {
                    try {
                        const res = await getProfileContent(editingProfile.id);
                        content = res.content || '';
                        setEditForm(prev => ({ ...prev, content: content }));
                    } catch (e) {
                        console.error("Failed to load profile content", e);
                        return;
                    }
                }

                // Parse Content
                try {
                    const doc = yaml.load(content) || {};

                    // Always parse proxies/groups to populate dropdowns
                    setProxyList(doc.proxies || []);
                    setProxyGroups(doc['proxy-groups'] || []);

                    if (activeTab === 'rules') {
                        // Parse Rules
                        const parsedRules = (doc.rules || []).map(ruleStr => {
                            const [type, content, proxy] = ruleStr.split(',').map(s => s.trim());
                            return { type, content, proxy, original: ruleStr };
                        });
                        setRulesList(parsedRules);
                    }
                } catch (e) {
                    console.error("Failed to parse YAML", e);
                }
            }
        };
        loadContent();
    }, [activeTab, editingProfile]);

    // Rule Handlers
    const handleAddRule = () => {
        if (!newRule.content) return;
        const ruleStr = `${newRule.type},${newRule.content},${newRule.proxy}`;
        const updatedRules = [ruleStr, ...(rulesList.map(r => r.original))];
        updateYamlContent({ rules: updatedRules });
        setRulesList([{ ...newRule, original: ruleStr }, ...rulesList]);
        setNewRule({ ...newRule, content: '' });
    };

    const handleDeleteRule = (index) => {
        const updatedList = [...rulesList];
        updatedList.splice(index, 1);
        setRulesList(updatedList);
        updateYamlContent({ rules: updatedList.map(r => r.original) });
    };

    // Proxy Handlers
    const handleAddProxies = () => {
        // Simple placeholder for bulk add (assuming URIs or YAML list)
        // For now, let's just append to proxies list if valid
        // Real implementation requires robust URI parsing (vmess:// etc)
        // Here we just mock update for UX demo as requested
        alert("暂支持在 '编辑文件' 中批量导入");
    };

    const handleDeleteProxy = (index) => {
        const updatedList = [...proxyList];
        updatedList.splice(index, 1);
        setProxyList(updatedList);
        updateYamlContent({ proxies: updatedList });
    };

    const handleDeleteGroup = (index) => {
        const updatedList = [...proxyGroups];
        updatedList.splice(index, 1);
        setProxyGroups(updatedList);
        updateYamlContent({ 'proxy-groups': updatedList });
    };

    // Helper to update specific fields in YAML content
    const updateYamlContent = (updates) => {
        try {
            const doc = yaml.load(editForm.content) || {};
            const newDoc = { ...doc, ...updates };
            const newContent = yaml.dump(newDoc);
            setEditForm(prev => ({ ...prev, content: newContent }));
        } catch (e) {
            console.error("Failed to update YAML content", e);
        }
    };

    const handleEditInfo = (profile) => {
        setEditingProfile(profile);
        setEditForm({
            name: profile.name,
            desc: profile.desc || '',
            url: profile.url || '',
            ua: profile.ua || '',
            interval: profile.interval || 0,
            autoUpdate: profile.auto_update || false,
            useSystemProxy: profile.use_system_proxy || false,
            allowUnsafe: profile.allow_unsafe || false
        });
        setActiveTab('info');
        setIsEditing(true);

    };

    const handleSaveEdit = async () => {
        if (!editingProfile) return;
        try {
            // 1. Update Metadata
            const payload = {
                name: editForm.name,
                desc: editForm.desc,
                url: editForm.url,
                ua: editForm.ua,
                interval: parseInt(editForm.interval || 0),
                auto_update: editForm.autoUpdate,
                use_system_proxy: editForm.useSystemProxy,
                allow_unsafe: editForm.allowUnsafe
            };

            await patchProfile(editingProfile.id, payload);

            // 2. Update Content (if changed)
            if (editForm.content) {
                await updateProfileContent(editingProfile.id, editForm.content);
            }

            setIsEditing(false);
            fetchProfiles();
        } catch (e) {
            console.error(e);
            alert('保存失败: ' + e.message);
        }
    };

    return (
        <div className="h-full overflow-y-auto bg-background p-6 custom-scrollbar animate-fade-in">
            <div className="max-w-7xl mx-auto pb-20">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <Sparkles size={20} />
                        </div>
                        <h1 className="text-2xl font-bold text-text">订阅管理</h1>
                    </div>
                </div>

                {/* Import Area - Premium Design */}
                <div className="mb-8 animate-slide-up">
                    <div className="glass-card p-1.5 border-glow max-w-4xl mx-auto rounded-[1.25rem] flex items-center bg-card/30 backdrop-blur-md">
                        <div className="flex-1 flex items-center px-4 gap-3">
                            <LinkIcon size={20} className="text-primary/70" />
                            <input
                                type="text"
                                placeholder="粘贴您的订阅链接 (URL)"
                                className="w-full h-12 bg-transparent border-none text-text placeholder:text-text-3 focus:outline-none focus:ring-0 text-base font-medium"
                                value={importUrl}
                                onChange={(e) => setImportUrl(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={handleImport}
                            disabled={loading || !importUrl}
                            className={`
                                h-11 px-8 rounded-xl font-medium transition-all duration-300 flex items-center gap-2
                                ${!importUrl || loading
                                    ? 'bg-muted text-text-3 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]'
                                }
                            `}
                        >
                            {loading ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" />
                                    <span>解析中...</span>
                                </>
                            ) : (
                                <>
                                    <span>导入</span>
                                    <ArrowRight size={18} className="opacity-80" />
                                </>
                            )}
                        </button>

                        <div className="w-[1px] h-8 bg-border/50 mx-1"></div>

                        <button
                            onClick={() => setIsCreatingLocal(!isCreatingLocal)}
                            className="h-11 px-5 rounded-xl font-medium flex items-center gap-2 text-text-2 hover:text-accent hover:bg-accent/5 transition-all duration-300 active:scale-[0.98]"
                        >
                            <FileText size={18} className="group-hover:rotate-12 transition-transform duration-300" />
                            <span>本地创建</span>
                        </button>
                    </div>
                </div>

                {/* Local Creation Modal */}
                {isCreatingLocal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl animate-scale-in border border-border">
                            <div className="p-6 border-b border-border">
                                <h2 className="text-xl font-display font-bold text-text">创建本地配置</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-2 mb-1.5">配置名称</label>
                                    <input
                                        type="text"
                                        placeholder="例如：My Local Config"
                                        className="w-full h-12 px-4 rounded-xl border border-border bg-muted/50 text-text placeholder:text-text-3 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                                        value={localName}
                                        onChange={(e) => setLocalName(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-2 mb-1.5">配置内容 (YAML)</label>
                                    <textarea
                                        placeholder="粘贴或编辑 YAML 配置..."
                                        className="w-full h-64 px-4 py-3 rounded-xl border border-border bg-muted/50 text-text placeholder:text-text-3 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all font-mono text-sm resize-none"
                                        value={localYaml}
                                        onChange={(e) => setLocalYaml(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-border flex justify-end gap-3 bg-muted/30 rounded-b-2xl">
                                <button
                                    onClick={() => {
                                        setIsCreatingLocal(false);
                                        setLocalName('');
                                        setLocalYaml('');
                                    }}
                                    className="px-6 py-2.5 bg-background border border-border hover:bg-muted text-text-2 rounded-xl font-medium transition-all"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleCreateLocal}
                                    disabled={loading}
                                    className="px-8 py-2.5 bg-gradient-to-r from-accent to-primary text-white rounded-xl font-medium disabled:opacity-50 hover:shadow-lg hover:shadow-accent/30 transition-all duration-300 hover:scale-105 disabled:hover:scale-100"
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <RefreshCw size={16} className="animate-spin" />
                                            创建中...
                                        </span>
                                    ) : '创建'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Profile Modal (Multi-tab) */}
                {isEditing && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="w-full max-w-4xl bg-card rounded-2xl shadow-2xl animate-scale-in border border-border flex h-[75vh] overflow-hidden">

                            {/* Sidebar */}
                            <div className="w-64 bg-muted/30 border-r border-border p-4 flex flex-col gap-2 shrink-0">
                                <h2 className="text-lg font-display font-bold text-text px-3 py-2 flex items-center gap-2 mb-2">
                                    <Edit3 size={20} className="text-primary" />
                                    编辑配置
                                </h2>

                                <button
                                    onClick={() => setActiveTab('info')}
                                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all font-medium ${activeTab === 'info' ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20' : 'text-text-2 hover:bg-muted hover:text-text'}`}
                                >
                                    <Layout size={18} />
                                    <span>基本信息</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('file')}
                                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all font-medium ${activeTab === 'file' ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20' : 'text-text-2 hover:bg-muted hover:text-text'}`}
                                >
                                    <FileCode size={18} />
                                    <span>配置文件</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('rules')}
                                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all font-medium ${activeTab === 'rules' ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20' : 'text-text-2 hover:bg-muted hover:text-text'}`}
                                >
                                    <List size={18} />
                                    <span>规则管理</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('proxies')}
                                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all font-medium ${activeTab === 'proxies' ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20' : 'text-text-2 hover:bg-muted hover:text-text'}`}
                                >
                                    <Layers size={18} />
                                    <span>代理组</span>
                                </button>

                                <div className="mt-auto pt-4 border-t border-border/50 space-y-2">
                                    <button
                                        onClick={(e) => {
                                            if (confirm('确认删除该配置？')) {
                                                handleDelete(e, editingProfile.id);
                                                setIsEditing(false);
                                            }
                                        }}
                                        className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all font-medium text-danger hover:bg-danger/10"
                                    >
                                        <Trash2 size={18} />
                                        <span>删除配置</span>
                                    </button>
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 flex flex-col min-w-0 bg-card">
                                {/* Header */}
                                <div className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 bg-muted/10">
                                    <div className="flex items-center gap-3">
                                        <div className="text-sm text-text-2">
                                            正在编辑: <span className="font-medium text-text">{editingProfile?.name}</span>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-xs font-medium border ${editingProfile?.type === 'remote' ? 'border-primary/20 bg-primary/5 text-primary' : 'border-accent/20 bg-accent/5 text-accent'}`}>
                                            {editingProfile?.type === 'remote' ? 'REMOTE' : 'LOCAL'}
                                        </div>
                                    </div>
                                    <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-muted rounded-full transition-colors text-text-2 hover:text-text">
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Scrollable Content */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

                                    {/* INFO TAB */}
                                    {activeTab === 'info' && (
                                        <div className="space-y-6 animate-fade-in">
                                            {/* Name */}
                                            <div>
                                                <label className="block text-sm font-medium text-text-2 mb-1.5 ml-1">名称</label>
                                                <input
                                                    type="text"
                                                    className="w-full h-11 px-4 rounded-xl border border-border bg-transparent text-text focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                                                    value={editForm.name}
                                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                />
                                            </div>

                                            {/* Desc */}
                                            <div>
                                                <label className="block text-sm font-medium text-text-2 mb-1.5 ml-1">描述</label>
                                                <input
                                                    type="text"
                                                    className="w-full h-11 px-4 rounded-xl border border-border bg-transparent text-text focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-text-3"
                                                    placeholder="暂无描述"
                                                    value={editForm.desc}
                                                    onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })}
                                                />
                                            </div>

                                            {/* URL (Remote Only) */}
                                            {editingProfile?.type === 'remote' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-text-2 mb-1.5 ml-1">订阅链接</label>
                                                    <div className="relative">
                                                        <textarea
                                                            className="w-full h-24 p-4 rounded-xl border border-border bg-transparent text-text focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none font-mono text-sm leading-relaxed custom-scrollbar pl-10"
                                                            value={editForm.url}
                                                            onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                                                        />
                                                        <LinkIcon size={16} className="absolute left-3.5 top-4 text-text-3" />
                                                    </div>
                                                </div>
                                            )}

                                            {/* User Agent */}
                                            <div>
                                                <label className="block text-sm font-medium text-text-2 mb-1.5 ml-1">User Agent</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-transparent text-text focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-text-3"
                                                        placeholder="默认"
                                                        value={editForm.ua}
                                                        onChange={(e) => setEditForm({ ...editForm, ua: e.target.value })}
                                                    />
                                                    <Globe size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                {/* Timeout */}
                                                <div>
                                                    <label className="block text-sm font-medium text-text-2 mb-1.5 ml-1">HTTP 请求超时</label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            className="w-full h-11 pl-4 pr-12 rounded-xl border border-border bg-transparent text-text focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-text-3"
                                                            value={editForm.timeout || ''}
                                                            placeholder="0"
                                                            onChange={(e) => setEditForm({ ...editForm, timeout: e.target.value })}
                                                        />
                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-3">秒</span>
                                                    </div>
                                                </div>
                                                {/* Interval */}
                                                <div>
                                                    <label className="block text-sm font-medium text-text-2 mb-1.5 ml-1">更新间隔</label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            className="w-full h-11 pl-4 pr-12 rounded-xl border border-border bg-transparent text-text focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-text-3"
                                                            value={editForm.interval || ''}
                                                            placeholder="0"
                                                            onChange={(e) => setEditForm({ ...editForm, interval: e.target.value })}
                                                        />
                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-3">分钟</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Toggles */}
                                            <div className="space-y-4 pt-2">
                                                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 hover:border-border transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                                            <Settings size={18} />
                                                        </div>
                                                        <span className="text-sm font-medium text-text">使用系统代理更新</span>
                                                    </div>
                                                    <Switch
                                                        checked={editForm.useSystemProxy}
                                                        onChange={(val) => setEditForm({ ...editForm, useSystemProxy: val })}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 hover:border-border transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                                                            <Zap size={18} />
                                                        </div>
                                                        <span className="text-sm font-medium text-text">允许无效证书 <span className="text-danger-soft text-xs ml-1">(危险)</span></span>
                                                    </div>
                                                    <Switch
                                                        checked={editForm.allowUnsafe}
                                                        onChange={(val) => setEditForm({ ...editForm, allowUnsafe: val })}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 hover:border-border transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                                                            <RefreshCw size={18} />
                                                        </div>
                                                        <span className="text-sm font-medium text-text">允许自动更新</span>
                                                    </div>
                                                    <Switch
                                                        checked={editForm.autoUpdate}
                                                        onChange={(val) => setEditForm({ ...editForm, autoUpdate: val })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* EDIT FILE TAB */}
                                    {activeTab === 'file' && (
                                        <div className="h-full flex flex-col animate-fade-in">
                                            <div className="flex-1 relative rounded-xl border border-border bg-white overflow-hidden flex font-mono text-sm leading-6 group">
                                                {/* Left: Line Numbers */}
                                                <div className="w-12 bg-gray-50 border-r border-gray-100 text-right pr-3 pt-4 text-xs text-text-3 select-none leading-6 font-mono opacity-50 z-20">
                                                    {(editForm.content || '').split('\n').map((_, i) => (
                                                        <div key={i}>{i + 1}</div>
                                                    ))}
                                                </div>

                                                {/* Right: Editor Area */}
                                                <div className="relative flex-1 h-full overflow-hidden">
                                                    {/* Syntax Highlighter (Underlay) */}
                                                    <pre
                                                        className="absolute inset-0 m-0 p-0 pl-3 pt-4 font-mono text-sm leading-6 pointer-events-none z-0 overflow-hidden"
                                                        aria-hidden="true"
                                                        ref={(ref) => {
                                                            if (ref && document.getElementById('yaml-textarea')) {
                                                                // Sync initial scroll
                                                                ref.scrollTop = document.getElementById('yaml-textarea').scrollTop;
                                                            }
                                                        }}
                                                        id="yaml-pre"
                                                    >
                                                        {(editForm.content || '').split('\n').map((line, i) => {
                                                            // Simple YAML Syntax Highlighting
                                                            if (line.trim().startsWith('#')) {
                                                                return <div key={i} className="text-gray-400">{line || '\n'}</div>;
                                                            }
                                                            const match = line.match(/^(\s*)([^:]+)(:)(.*)$/);
                                                            if (match) {
                                                                const [_, indent, key, colon, val] = match;
                                                                return (
                                                                    <div key={i}>
                                                                        <span>{indent}</span>
                                                                        <span className="text-green-600 font-semibold">{key}</span>
                                                                        <span className="text-gray-500">{colon}</span>
                                                                        <span className="text-blue-600">{val}</span>
                                                                    </div>
                                                                );
                                                            }
                                                            return <div key={i} className="text-gray-800">{line || '\n'}</div>;
                                                        })}
                                                    </pre>

                                                    {/* Editor Input (Overlay) */}
                                                    <textarea
                                                        id="yaml-textarea"
                                                        className="absolute inset-0 w-full h-full p-0 pl-3 pt-4 bg-transparent text-transparent caret-black resize-none outline-none custom-scrollbar leading-6 font-mono z-10 selection:bg-blue-200/50"
                                                        spellCheck={false}
                                                        value={editForm.content || ''}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                                                        onScroll={(e) => {
                                                            const pre = document.getElementById('yaml-pre');
                                                            if (pre) pre.scrollTop = e.target.scrollTop;
                                                        }}
                                                        placeholder="# Config content..."
                                                        style={{ fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace' }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-2 text-xs text-text-3 flex items-center justify-between px-1">
                                                <span>YAML 格式 • UTF-8</span>
                                                <div className="flex gap-4">
                                                    <span>Ln {(editForm.content || '').split('\n').length}, Col 1</span>
                                                    <span>{(editForm.content || '').length} 字符</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {/* EDIT RULES TAB */}
                                    {activeTab === 'rules' && (
                                        <div className="h-full flex flex-col gap-4 animate-fade-in">
                                            {/* Add Rule Form */}
                                            <div className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-3">
                                                <div className="flex gap-3">
                                                    <div className="w-1/3">
                                                        <select
                                                            className="w-full h-10 px-3 rounded-lg bg-card border border-border text-text text-sm outline-none focus:border-primary"
                                                            value={newRule.type}
                                                            onChange={e => setNewRule({ ...newRule, type: e.target.value })}
                                                        >
                                                            <option value="DOMAIN-SUFFIX">DOMAIN-SUFFIX</option>
                                                            <option value="DOMAIN">DOMAIN</option>
                                                            <option value="DOMAIN-KEYWORD">DOMAIN-KEYWORD</option>
                                                            <option value="IP-CIDR">IP-CIDR</option>
                                                            <option value="SRC-IP-CIDR">SRC-IP-CIDR</option>
                                                            <option value="GEOIP">GEOIP</option>
                                                            <option value="DST-PORT">DST-PORT</option>
                                                            <option value="SRC-PORT">SRC-PORT</option>
                                                            <option value="MATCH">MATCH</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            className="w-full h-10 px-3 rounded-lg bg-card border border-border text-text text-sm outline-none focus:border-primary placeholder:text-text-3"
                                                            placeholder="example.com"
                                                            value={newRule.content}
                                                            onChange={e => setNewRule({ ...newRule, content: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="w-1/4">
                                                        <select
                                                            className="w-full h-10 px-3 rounded-lg bg-card border border-border text-text text-sm outline-none focus:border-primary"
                                                            value={newRule.proxy}
                                                            onChange={e => setNewRule({ ...newRule, proxy: e.target.value })}
                                                        >
                                                            <option value="" disabled>选择策略</option>
                                                            <optgroup label="基础">
                                                                <option value="DIRECT">DIRECT</option>
                                                                <option value="REJECT">REJECT</option>
                                                            </optgroup>
                                                            {proxyGroups.length > 0 && (
                                                                <optgroup label="策略组">
                                                                    {proxyGroups.map((group, i) => (
                                                                        <option key={i} value={group.name}>{group.name}</option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                        </select>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleAddRule}
                                                    className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Plus size={16} />
                                                    <span>添加前置规则</span>
                                                </button>
                                            </div>

                                            {/* Rules List */}
                                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                                {rulesList.map((rule, index) => (
                                                    <div key={index} className="flex items-center justify-between p-3 bg-card border border-border/50 rounded-xl hover:border-primary/30 transition-colors group">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="font-medium text-text truncate max-w-[200px]" title={rule.content}>{rule.content || 'MATCH'}</div>
                                                            <div className="flex gap-2">
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">{rule.type}</span>
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20">{rule.proxy}</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeleteRule(index)}
                                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-3 hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                                {rulesList.length === 0 && (
                                                    <div className="flex flex-col items-center justify-center h-full text-text-3 opacity-50">
                                                        <List size={40} className="mb-2" />
                                                        <p>暂无规则</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* EDIT PROXIES TAB */}
                                    {activeTab === 'proxies' && (
                                        <div className="h-full flex flex-col gap-4 animate-fade-in">
                                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3">
                                                <Sparkles className="text-yellow-500 mt-0.5" size={18} />
                                                <div className="text-sm">
                                                    <p className="text-yellow-500 font-medium mb-1">高级节点管理</p>
                                                    <p className="text-text-2">当前仅支持查看和删除。如需批量导入或编辑详细参数，请移步“配置文件”标签页直接修改 YAML。</p>
                                                </div>
                                            </div>

                                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
                                                {/* Proxy Groups */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-3 px-1">
                                                        <h3 className="text-sm font-medium text-text-2 flex items-center gap-2">
                                                            <Layers size={14} /> 策略组 ({proxyGroups.length})
                                                        </h3>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {proxyGroups.map((group, i) => (
                                                            <div key={i} className="flex items-center justify-between p-3 bg-card border border-border/50 rounded-xl group hover:border-primary/30 transition-all">
                                                                <div>
                                                                    <div className="font-medium text-text">{group.name}</div>
                                                                    <div className="text-xs text-text-3 mt-0.5">Type: {group.type}</div>
                                                                </div>
                                                                <button onClick={() => handleDeleteGroup(i)} className="opacity-0 group-hover:opacity-100 p-2 text-text-3 hover:text-danger"><Trash2 size={16} /></button>
                                                            </div>
                                                        ))}
                                                        {proxyGroups.length === 0 && <div className="text-center text-sm text-text-3 py-4">无策略组</div>}
                                                    </div>
                                                </div>

                                                {/* Proxies */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-3 px-1">
                                                        <h3 className="text-sm font-medium text-text-2 flex items-center gap-2">
                                                            <Globe size={14} /> 代理节点 ({proxyList.length})
                                                        </h3>
                                                        <button onClick={handleAddProxies} className="text-xs text-primary hover:underline">批量导入</button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {proxyList.map((proxy, i) => (
                                                            <div key={i} className="flex items-center justify-between p-3 bg-card border border-border/50 rounded-xl group hover:border-primary/30 transition-all">
                                                                <div>
                                                                    <div className="font-medium text-text">{proxy.name}</div>
                                                                    <div className="text-xs text-text-3 mt-0.5">Type: {proxy.type} | Server: {proxy.server}</div>
                                                                </div>
                                                                <button onClick={() => handleDeleteProxy(i)} className="opacity-0 group-hover:opacity-100 p-2 text-text-3 hover:text-danger"><Trash2 size={16} /></button>
                                                            </div>
                                                        ))}
                                                        {proxyList.length === 0 && <div className="text-center text-sm text-text-3 py-4">无代理节点</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                </div>

                                {/* Footer */}
                                <div className="h-20 border-t border-border flex justify-end items-center gap-3 px-6 bg-muted/20 shrink-0">
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="px-6 py-2.5 rounded-xl font-medium text-text-2 hover:bg-muted transition-colors active:scale-95 duration-200"
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        className="px-6 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-medium hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2"
                                    >
                                        <Save size={18} />
                                        <span>保存设置</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Profiles Grid */}
                <div className="grid grid-cols-3 gap-4">
                    {profiles.map((profile, index) => (
                        <div
                            key={profile.id}
                            onClick={() => handleSelect(profile.id)}
                            className={`
                                group relative min-h-[160px] flex flex-col overflow-hidden rounded-2xl transition-all duration-300 cursor-pointer
                                hover:scale-[1.02] hover:shadow-xl
                                ${selectedId === profile.id
                                    ? 'glass-card ring-2 ring-primary shadow-xl shadow-primary/10'
                                    : 'glass-card hover:ring-1 hover:ring-primary/30'
                                }
                                ${switching ? 'pointer-events-none' : ''}
                            `}
                            style={{
                                animation: `slideUp 0.4s ease-out ${index * 0.1}s both`
                            }}
                        >
                            {/* Loading Overlay */}
                            {switching && (
                                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center animate-fade-in">
                                    <div className="flex flex-col items-center gap-2">
                                        <RefreshCw size={24} className="text-primary animate-spin" />
                                        <span className="text-sm text-text-2">切换中...</span>
                                    </div>
                                </div>
                            )}
                            {/* Gradient Background on Hover */}
                            <div className={`
                                absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
                                bg-gradient-to-br from-primary/5 via-transparent to-accent/5
                            `} />

                            {/* Active Glow Effect */}
                            {selectedId === profile.id && (
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
                            )}

                            <div className="relative p-5 h-full flex flex-col">
                                {/* Header with Icon and Name */}
                                <div className="flex items-start gap-3 mb-4">
                                    <div className={`
                                        w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300
                                        ${selectedId === profile.id
                                            ? 'bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/30'
                                            : 'bg-muted/80 backdrop-blur-sm text-text-2 group-hover:bg-primary/10 group-hover:text-primary'
                                        }
                                    `}>
                                        <FileText size={20} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className={`text-base font-display font-bold truncate ${selectedId === profile.id ? 'text-primary' : 'text-text'}`}>
                                                {profile.name}
                                            </h3>
                                            {selectedId === profile.id && (
                                                <Check size={14} className="text-primary shrink-0" />
                                            )}
                                        </div>
                                        {profile.url && (
                                            <p className="text-xs text-text-2 truncate font-mono">
                                                {(() => {
                                                    try {
                                                        return new URL(profile.url).hostname;
                                                    } catch {
                                                        return profile.url;
                                                    }
                                                })()}
                                            </p>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-1 items-center">
                                        {profile.type === 'remote' && (
                                            <button
                                                onClick={(e) => handleUpdate(e, profile.id)}
                                                className="p-1.5 hover:bg-primary/10 rounded-lg text-text-2 hover:text-primary transition-all active:scale-95"
                                                title="更新订阅"
                                            >
                                                <RefreshCw size={14} className={(switching && selectedId === profile.id) || (updatingId === profile.id) ? "animate-spin" : ""} />
                                            </button>
                                        )}

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditInfo(profile);
                                            }}
                                            className="p-1.5 hover:bg-primary/10 rounded-lg text-text-2 hover:text-primary transition-all active:scale-95"
                                            title="配置设置"
                                        >
                                            <Settings size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Traffic Info */}
                                {profile.usage && profile.usage.total > 0 && (
                                    <div className="space-y-2 mb-3">
                                        <div className="flex justify-between items-baseline text-xs">
                                            <span className="text-text-2">
                                                {formatBytes(profile.usage.used || 0)} / {formatBytes(profile.usage.total)}
                                            </span>
                                            <span className="text-text-2">
                                                {Math.round(((profile.usage.used || 0) / profile.usage.total) * 100)}%
                                            </span>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${Math.min(((profile.usage.used || 0) / profile.usage.total) * 100, 100)}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Update Time - Only for remote profiles */}
                                {profile.type === 'remote' && (
                                    <div className="flex items-center gap-1.5 mt-auto pt-3 text-xs text-text-2/80 font-mono">
                                        <Clock size={12} />
                                        <span>
                                            更新于 {profile.updated ? new Date(profile.updated).toLocaleString('zh-CN', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) : '未记录'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Empty State */}
                    {profiles.length === 0 && (
                        <div className="glass-card p-20 text-center animate-fade-in col-span-3">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
                                <DownloadCloud size={40} className="text-text-3" />
                            </div>
                            <h3 className="text-xl font-display font-bold text-text mb-2">暂无订阅配置</h3>
                            <p className="text-text-2 mb-6">点击右上角&quot;导入订阅&quot;按钮添加您的第一个配置</p>
                            <button
                                onClick={() => setIsImporting(true)}
                                className="px-6 py-2.5 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 transition-colors"
                            >
                                立即导入
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profiles;
