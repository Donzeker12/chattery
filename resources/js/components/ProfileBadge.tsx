import { router } from '@inertiajs/react';
import { useState } from 'react';
import Avatar from './Avatar';

interface User {
    id: number;
    name: string;
    email: string;
    profile_photo_url?: string | null;
    is_admin?: boolean;
}

interface ProfileBadgeProps {
    user: User;
    showMenu?: boolean;
}

export default function ProfileBadge({ user, showMenu = true }: ProfileBadgeProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => showMenu && setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
                <Avatar 
                    photoUrl={user.profile_photo_url}
                    name={user.name}
                    size="md"
                />
                <div className="text-left">
                    <p className="font-medium text-gray-800">{user.name}</p>
                    {user.is_admin && (
                        <span className="text-xs text-indigo-600">👑 Admin</span>
                    )}
                </div>
                {showMenu && (
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                )}
            </button>

            {/* Dropdown Menu */}
            {showMenu && isMenuOpen && (
                <>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsMenuOpen(false)}
                    />
                    
                    {/* Menu */}
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        <button
                            onClick={() => {
                                router.visit('/profile');
                                setIsMenuOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors flex items-center gap-2"
                        >
                            <span>👤</span>
                            <span>Profiel Instellingen</span>
                        </button>
                        
                        {user.is_admin && (
                            <button
                                onClick={() => {
                                    router.visit('/admin');
                                    setIsMenuOpen(false);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors flex items-center gap-2"
                            >
                                <span>👑</span>
                                <span>Admin Panel</span>
                            </button>
                        )}
                        
                        <div className="border-t border-gray-200 my-1"></div>
                        
                        <button
                            onClick={() => {
                                router.post('/logout');
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors flex items-center gap-2 text-red-600"
                        >
                            <span>🚪</span>
                            <span>Uitloggen</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
