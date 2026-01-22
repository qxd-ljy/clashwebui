import React, { createContext, useContext, useState, useEffect } from 'react';
import { getProfiles, getConfigs, updatePreferences, updateConfig } from '../api/clash';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        systemProxy: false,
        tunMode: false,
        ipv6: false,
        lanAccess: true,
        mixedPort: 7890,
        backendPort: 3001,
        externalController: '127.0.0.1:9092',
        secret: '',
        clashBinaryPath: '~/.bin/clash',
        clashConfigDir: '~/.config/clash',
        pythonInterpreterPath: null,
        webuiWorkingDirectory: null,
        isInitialLoading: true
    });

    const fetchAllSettings = async () => {
        try {
            const [profilesData, configData] = await Promise.all([
                getProfiles(),
                getConfigs()
            ]);

            const preferences = profilesData.preferences || {};

            setSettings(prev => ({
                ...prev,
                systemProxy: preferences.system_proxy || false,
                tunMode: preferences.tun_mode || configData.tun?.enable || false,
                ipv6: configData.ipv6 || false,
                lanAccess: configData['allow-lan'] || false,
                mixedPort: preferences.mixed_port || configData.port || 7890,
                backendPort: preferences.backend_port || 3001,
                externalController: preferences.external_controller || configData['external-controller'] || '127.0.0.1:9092',
                secret: preferences.secret !== undefined ? preferences.secret : (configData.secret || ''),
                clashBinaryPath: preferences.clash_binary_path || '~/.bin/clash',
                clashConfigDir: preferences.clash_config_dir || '~/.config/clash',
                pythonInterpreterPath: preferences.python_interpreter_path || null,
                webuiWorkingDirectory: preferences.webui_working_directory || null,
                isInitialLoading: false
            }));
        } catch (error) {
            console.error("Failed to fetch settings:", error);
            setSettings(prev => ({ ...prev, isInitialLoading: false }));
        }
    };

    useEffect(() => {
        fetchAllSettings();
    }, []);

    const updateSystemProxy = async (val) => {
        setSettings(prev => ({ ...prev, systemProxy: val }));
        await updatePreferences({ system_proxy: val });
    };

    const updateTunMode = async (val) => {
        setSettings(prev => ({ ...prev, tunMode: val }));
        await Promise.all([
            updatePreferences({ tun_mode: val }),
            updateConfig({ tun: { enable: val } })
        ]);
    };

    const updatePreferenceField = async (field, value) => {
        // Map frontend camelCase to backend snake_case if necessary
        const fieldMap = {
            mixedPort: 'mixed_port',
            backendPort: 'backend_port',
            externalController: 'external_controller',
            secret: 'secret'
        };

        setSettings(prev => ({ ...prev, [field]: value }));

        const backendField = fieldMap[field] || field;
        await updatePreferences({ [backendField]: value });
    };

    const updateConfigField = async (field, value) => {
        const fieldMap = {
            ipv6: 'ipv6',
            lanAccess: 'allow-lan'
        };

        setSettings(prev => ({ ...prev, [field]: value }));
        const backendField = fieldMap[field] || field;
        await updateConfig({ [backendField]: value });
    };

    const [proxyRefreshSignal, setProxyRefreshSignal] = useState(0);

    const triggerProxyRefresh = () => {
        setProxyRefreshSignal(prev => prev + 1);
    };

    return (
        <SettingsContext.Provider value={{
            ...settings,
            updateSystemProxy,
            updateTunMode,
            updatePreferenceField,
            updateConfigField,
            refreshSettings: fetchAllSettings,
            proxyRefreshSignal,
            triggerProxyRefresh
        }}>
            {children}
        </SettingsContext.Provider>
    );
};
