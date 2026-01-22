import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../UI/Card';

const TrafficChart = ({ data = [] }) => {
    return (
        <Card title="流量监控" className="traffic-card">
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#5e5ce6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#5e5ce6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#30d158" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#30d158" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" vertical={false} />
                        <XAxis dataKey="time" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} unit=" KB/s" />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#2d2d2d', border: '1px solid #444', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Area type="monotone" dataKey="download" stroke="#5e5ce6" fillOpacity={1} fill="url(#colorDown)" strokeWidth={2} />
                        <Area type="monotone" dataKey="upload" stroke="#30d158" fillOpacity={1} fill="url(#colorUp)" strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default TrafficChart;
