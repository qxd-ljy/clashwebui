import React, { useEffect, useRef, useMemo } from 'react';
import './Logs.css';
import { Trash2, Pause, Play, List } from 'lucide-react';
import { useLogs } from '../contexts/LogsContext';

const Logs = () => {
    const { logs, isPaused, setIsPaused, clearLogs } = useLogs();

    // Memoize the reversed list to avoid recalculation on every render
    // Only recalculate when the logs array reference changes
    const logsReversed = useMemo(() => {
        return [...logs].reverse();
    }, [logs]);

    return (
        <div className="h-full overflow-y-auto bg-background p-6 custom-scrollbar">
            <div className="max-w-7xl mx-auto pb-20">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <List size={20} />
                        </div>
                        <h1 className="text-2xl font-bold text-text">日志</h1>
                    </div>
                    <div className="header-actions">
                        <button className="ui-button icon-only" onClick={() => setIsPaused(!isPaused)}>
                            {isPaused ? <Play size={18} /> : <Pause size={18} />}
                        </button>
                        <button className="ui-button" onClick={clearLogs}>
                            <Trash2 size={16} style={{ marginRight: 6 }} />
                            清除
                        </button>
                    </div>
                </div>

                <div className="logs-container">
                    {logsReversed.map((log) => (
                        <div key={log.id || Math.random()} className={`log-item type-${log.type}`}>
                            <span className="log-time">{log.time}</span>
                            <span className="log-type">{log.type.toUpperCase()}</span>
                            <span className="log-payload">{log.payload}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Logs;
