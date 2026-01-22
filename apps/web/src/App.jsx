import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Proxies from './pages/Proxies';
import Profiles from './pages/Profiles';
import Settings from './pages/Settings';
import Connections from './pages/Connections';
import Rules from './pages/Rules';
import Logs from './pages/Logs';
import Test from './pages/Test';

import { SettingsProvider } from './contexts/SettingsContext';
import { LogsProvider } from './contexts/LogsContext';

import { useLocation } from 'react-router-dom';

const PageContainer = ({ children, isActive }) => {
    return (
        <div
            style={{
                display: isActive ? 'block' : 'none',
                height: '100%',
                width: '100%'
            }}
        >
            {children}
        </div>
    );
};

const MainContent = () => {
    const location = useLocation();
    const p = location.pathname;

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[#f6f7f9]">
            <Sidebar />
            <main className="flex-1 overflow-hidden relative flex flex-col">
                <PageContainer isActive={p === '/'}><Dashboard /></PageContainer>
                <PageContainer isActive={p === '/proxies'}><Proxies /></PageContainer>
                <PageContainer isActive={p === '/profiles'}><Profiles /></PageContainer>
                <PageContainer isActive={p === '/connections'}><Connections /></PageContainer>
                <PageContainer isActive={p === '/rules'}><Rules /></PageContainer>
                <PageContainer isActive={p === '/logs'}><Logs /></PageContainer>
                <PageContainer isActive={p === '/test'}><Test /></PageContainer>
                <PageContainer isActive={p === '/settings'}><Settings /></PageContainer>
            </main>
        </div>
    );
};

function App() {
    return (
        <SettingsProvider>
            <LogsProvider>
                <Router>
                    <MainContent />
                </Router>
            </LogsProvider>
        </SettingsProvider>
    );
}

export default App;
