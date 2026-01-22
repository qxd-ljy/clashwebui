import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { getLogsWebSocket } from '../api/clash';

const LogsContext = createContext();

export const useLogs = () => useContext(LogsContext);

export const LogsProvider = ({ children }) => {
    const [logs, setLogs] = useState(() => {
        try {
            const saved = localStorage.getItem('clash_logs');
            console.log('Initial logs load:', saved ? 'Found data' : 'Empty');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Failed to parse logs from localStorage rule', e);
            return [];
        }
    });
    const [isPaused, setIsPaused] = useState(false);
    const bufferRef = useRef([]);
    const isPausedRef = useRef(false);

    // Sync ref with state
    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    // Dedicated effect for persistence
    useEffect(() => {
        try {
            localStorage.setItem('clash_logs', JSON.stringify(logs));
        } catch (e) {
            console.error('Failed to persist logs:', e);
        }
    }, [logs]);

    useEffect(() => {
        const ws = getLogsWebSocket('info');

        ws.onmessage = (event) => {
            if (isPausedRef.current) return;
            try {
                const log = JSON.parse(event.data);
                log.time = new Date().toLocaleTimeString();
                log.id = Date.now() + Math.random().toString(36).substr(2, 9); // Add unique ID
                bufferRef.current.push(log);
            } catch (e) {
                console.error("Log parse error", e);
            }
        };

        const intervalId = setInterval(() => {
            if (bufferRef.current.length > 0) {
                const newLogs = bufferRef.current;
                bufferRef.current = [];

                setLogs(prev => {
                    const updated = [...prev, ...newLogs];
                    if (updated.length > 500) {
                        return updated.slice(-500);
                    }
                    return updated;
                });
            }
        }, 200);

        return () => {
            ws.close();
            clearInterval(intervalId);
        };
    }, []);

    const clearLogs = () => {
        setLogs([]);
        localStorage.removeItem('clash_logs');
    };

    return (
        <LogsContext.Provider value={{ logs, isPaused, setIsPaused, clearLogs }}>
            {children}
        </LogsContext.Provider>
    );
};
