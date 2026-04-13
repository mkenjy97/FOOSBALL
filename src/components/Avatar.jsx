import React from 'react';

export default function Avatar({ name, size = "md" }) {
    const colors = ['bg-blue-500', 'bg-purple-600', 'bg-orange-500', 'bg-pink-600', 'bg-emerald-500', 'bg-red-500'];
    const char = name ? name.charAt(0).toUpperCase() : '?';
    const colorIndex = name ? name.length % colors.length : 0;

    const sizes = {
        sm: "w-8 h-8 text-xs",
        md: "w-12 h-12 text-base",
        lg: "w-20 h-20 text-3xl"
    };

    return (
        <div className={`${sizes[size]} ${colors[colorIndex]} rounded-2xl flex items-center justify-center font-black text-white shadow-lg border border-white/20 transform rotate-3`}>
            <span className="-rotate-3">{char}</span>
        </div>
    );
}