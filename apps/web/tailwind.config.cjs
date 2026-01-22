/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Space Grotesk', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
            },
            colors: {
                border: 'var(--border)',
                background: 'var(--bg)',
                card: 'var(--card)',
                muted: 'var(--muted)',
                primary: {
                    DEFAULT: 'var(--primary)',
                    soft: 'var(--primary-soft)',
                },
                text: {
                    DEFAULT: 'var(--text)',
                    2: 'var(--text-2)',
                    3: 'var(--text-3)',
                },
                danger: {
                    DEFAULT: 'var(--danger)',
                    soft: 'var(--danger-soft)',
                    border: 'var(--danger-border)',
                },
                success: 'var(--success)',
                accent: 'var(--accent)', // Purple accent for local actions
                // Neon accent colors
                neon: {
                    blue: '#00D4FF',
                    purple: '#A78BFA',
                    pink: '#F472B6',
                },
            },
            borderRadius: {
                '2xl': 'var(--radius-card)',
                'xl': 'var(--radius-btn)',
                'lg': '10px',
                DEFAULT: '0.25rem',
            },
            boxShadow: {
                'card': 'var(--shadow-card)',
                'glow': '0 0 20px rgba(0, 212, 255, 0.3)',
                'glow-sm': '0 0 10px rgba(0, 212, 255, 0.2)',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
                'shimmer': 'shimmer 2s linear infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                pulseGlow: {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)' },
                    '50%': { boxShadow: '0 0 30px rgba(0, 212, 255, 0.6)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-1000px 0' },
                    '100%': { backgroundPosition: '1000px 0' },
                },
            },
        },
    },
    plugins: [],
}
