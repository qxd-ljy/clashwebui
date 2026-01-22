import React from 'react';

export const Logo = ({ size = 32, className = "" }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id="logo-gradient" x1="0" y1="100" x2="100" y2="0" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4F46E5" /> {/* Indigo-600 */}
                    <stop offset="1" stopColor="#818CF8" /> {/* Indigo-400 */}
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            {/* Outer Hexagon/Shield suggestion */}
            <path
                d="M50 5 L93.3 30 V80 L50 105 L6.7 80 V30 L50 5Z"
                stroke="url(#logo-gradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity="0.2"
            />

            {/* Inner "Spark" / Network Node */}
            <path
                d="M50 25 L65 50 L50 75 L35 50 Z"
                fill="url(#logo-gradient)"
                filter="url(#glow)"
            />

            {/* Orbital Rings / Connection Paths */}
            <path
                d="M50 25 C70 25 85 40 85 50 C85 70 70 80 50 80"
                stroke="url(#logo-gradient)"
                strokeWidth="6"
                strokeLinecap="round"
            />
            <path
                d="M50 75 C30 75 15 60 15 50 C15 30 30 20 50 20"
                stroke="url(#logo-gradient)"
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.6"
            />
        </svg>
    );
};

export default Logo;
