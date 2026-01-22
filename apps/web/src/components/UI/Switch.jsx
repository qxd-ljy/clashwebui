import React from 'react';
import './Switch.css';

const Switch = ({ checked, onChange, noTransition }) => (
    <button
        className={`ui-switch ${checked ? 'checked' : ''} ${noTransition ? 'no-transition' : ''}`}
        onClick={() => onChange(!checked)}
    >
        <div className={`switch-thumb ${noTransition ? 'no-transition' : ''}`} />
    </button>
);

export default Switch;
