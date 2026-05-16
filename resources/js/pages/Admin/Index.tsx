import { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import axios from '@/lib/axios';
import Avatar from '@/components/Avatar';

interface User {
    id: number;
    name: string;
    is_admin: boolean;
    is_banned: boolean;
    is_hidden: boolean;
    is_online: boolean;
    account_type: string;
    created_at: string;
    last_seen: string;
    profile_photo_url?: string | null;
}

interface ScreenshotEvent {
    id: number;
    user_name: string;
    chat_label: string;
    trigger: string;
    happened_at: string;
}

interface Props {
    users: User[];
    total_users: number;
    online_users: number;
    screenshot_events: ScreenshotEvent[];
    screenshot_events_last_24h: number;
}

export default function AdminIndex({ users: initialUsers, total_users, online_users, screenshot_events, screenshot_events_last_24h }: Props) {
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [activeTab, setActiveTab] = useState<'users' | 'security'>('users');

    const handleBan = async (userId: number) => {
        if (!confirm('Weet je zeker dat je deze gebruiker wilt bannen?')) {
            return;
        }

        try {
            const response = await axios.post(`/admin/ban/${userId}`);
            if (response.data.success) {
                // Update the user in the list
                setUsers(users.map(user => 
                    user.id === userId ? { ...user, is_banned: true } : user
                ));
                alert(response.data.message);
            }
        } catch (error: any) {
            alert(error.response?.data?.message || 'Er ging iets mis bij het bannen');
        }
    };

    const handleUnban = async (userId: number) => {
        try {
            const response = await axios.post(`/admin/unban/${userId}`);
            if (response.data.success) {
                // Update the user in the list
                setUsers(users.map(user => 
                    user.id === userId ? { ...user, is_banned: false } : user
                ));
                alert(response.data.message);
            }
        } catch (error: any) {
            alert(error.response?.data?.message || 'Er ging iets mis bij het unbannen');
        }
    };

    const handleHide = async (userId: number) => {
        if (!confirm('Weet je zeker dat je deze gebruiker wilt verbergen?')) {
            return;
        }

        try {
            const response = await axios.post(`/admin/hide/${userId}`);
            if (response.data.success) {
                // Update the user in the list
                setUsers(users.map(user => 
                    user.id === userId ? { ...user, is_hidden: true } : user
                ));
                alert(response.data.message);
            }
        } catch (error: any) {
            alert(error.response?.data?.message || 'Er ging iets mis bij het verbergen');
        }
    };

    const handleUnhide = async (userId: number) => {
        try {
            const response = await axios.post(`/admin/unhide/${userId}`);
            if (response.data.success) {
                // Update the user in the list
                setUsers(users.map(user => 
                    user.id === userId ? { ...user, is_hidden: false } : user
                ));
                alert(response.data.message);
            }
        } catch (error: any) {
            alert(error.response?.data?.message || 'Er ging iets mis bij het zichtbaar maken');
        }
    };

    const handleSetAccountType = async (userId: number, newType: 'model' | 'user') => {
        const label = newType === 'model' ? 'model maken' : 'model-status verwijderen';
        if (!confirm(`Weet je zeker dat je deze gebruiker wilt ${label}?`)) return;
        try {
            const response = await axios.post(`/admin/account-type/${userId}`, { account_type: newType });
            if (response.data.success) {
                setUsers(users.map(user =>
                    user.id === userId ? { ...user, account_type: response.data.account_type } : user
                ));
                alert(response.data.message);
            }
        } catch (error: any) {
            alert(error.response?.data?.message || 'Er ging iets mis');
        }
    };

    return (
        <>
            <Head title="Admin Panel" />
            <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500">
                {/* Header */}
                <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
                    <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
                        <div className="flex gap-4">
                            <Link
                                href="/chat"
                                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition"
                            >
                                Chat
                            </Link>
                            <Link
                                href="/logout"
                                method="post"
                                as="button"
                                className="px-4 py-2 bg-red-500/80 hover:bg-red-600 text-white rounded-lg transition"
                            >
                                Uitloggen
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
                            <h2 className="text-xl font-semibold text-white mb-2">Totaal Gebruikers</h2>
                            <p className="text-3xl font-bold text-white">{total_users}</p>
                            <p className="text-white/80">Geregistreerde accounts</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
                            <h2 className="text-xl font-semibold text-white mb-2">Online Gebruikers</h2>
                            <p className="text-3xl font-bold text-white flex items-center gap-2">
                                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                                {online_users}
                            </p>
                            <p className="text-white/80">Actief in de laatste 5 minuten</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
                            <h2 className="text-xl font-semibold text-white mb-2">Screenshot Pogingen</h2>
                            <p className="text-3xl font-bold text-white">{screenshot_events_last_24h}</p>
                            <p className="text-white/80">Gelogd in de laatste 24 uur</p>
                        </div>
                    </div>

                    <div className="mb-6 flex flex-wrap gap-2">
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-2 rounded-lg transition ${
                                activeTab === 'users'
                                    ? 'bg-white text-purple-700 font-semibold'
                                    : 'bg-white/15 hover:bg-white/25 text-white'
                            }`}
                        >
                            Gebruikers
                        </button>
                        <button
                            onClick={() => setActiveTab('security')}
                            className={`px-4 py-2 rounded-lg transition ${
                                activeTab === 'security'
                                    ? 'bg-white text-purple-700 font-semibold'
                                    : 'bg-white/15 hover:bg-white/25 text-white'
                            }`}
                        >
                            Security events
                        </button>
                    </div>

                    {activeTab === 'security' && (
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl overflow-hidden mb-6">
                            <div className="p-6">
                                <h2 className="text-xl font-semibold text-white mb-1">Recente Screenshot Pogingen</h2>
                                <p className="text-white/75 text-sm">Dit zijn gedetecteerde sneltoets-acties (geen 100% garantie op echte screenshots).</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-white/5 border-y border-white/20">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">Gebruiker</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">Gesprek</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">Trigger</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">Wanneer</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {screenshot_events.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-4 text-sm text-white/70">Nog geen screenshot-pogingen gelogd.</td>
                                            </tr>
                                        ) : (
                                            screenshot_events.map((event) => (
                                                <tr key={event.id} className="hover:bg-white/5 transition">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{event.user_name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/90">{event.chat_label}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">{event.trigger}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">{event.happened_at}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Users Table */}
                    {activeTab === 'users' && (
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl overflow-hidden">
                        <div className="p-6">
                            <h2 className="text-xl font-semibold text-white mb-4">Gebruikers</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-white/5 border-y border-white/20">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                                            ID
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                                            Naam
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                                            Aangemaakt
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                                            Laatst gezien
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                                            Zichtbaarheid
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                                            Acties
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {users.map((user) => (
                                        <tr key={user.id} className="hover:bg-white/5 transition">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                                                {user.id}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                                                <div className="flex items-center gap-3">
                                                    <Avatar
                                                        photoUrl={user.profile_photo_url}
                                                        name={user.name}
                                                        size="sm"
                                                        isOnline={user.is_online}
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <span>{user.name}</span>
                                                        {user.is_admin && (
                                                            <span className="px-2 py-1 text-xs bg-yellow-500/80 text-white rounded">
                                                                Admin
                                                            </span>
                                                        )}
                                                        {!user.is_admin && user.account_type === 'model' && (
                                                            <span className="px-2 py-1 text-xs bg-pink-500/80 text-white rounded">
                                                                Model
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                                                {user.created_at}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                                                {user.last_seen}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {user.is_banned ? (
                                                    <span className="px-2 py-1 text-xs bg-red-500/80 text-white rounded">
                                                        Gebanned
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs bg-green-500/80 text-white rounded">
                                                        Actief
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {user.is_hidden ? (
                                                    <span className="px-2 py-1 text-xs bg-purple-500/80 text-white rounded">
                                                        Verborgen
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs bg-blue-500/80 text-white rounded">
                                                        Zichtbaar
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                                {!user.is_admin && (
                                                    <>
                                                        {user.is_banned ? (
                                                            <button
                                                                onClick={() => handleUnban(user.id)}
                                                                className="px-3 py-1 bg-green-500/80 hover:bg-green-600 text-white rounded transition"
                                                            >
                                                                Unban
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleBan(user.id)}
                                                                className="px-3 py-1 bg-red-500/80 hover:bg-red-600 text-white rounded transition"
                                                            >
                                                                Ban
                                                            </button>
                                                        )}
                                                        {user.is_hidden ? (
                                                            <button
                                                                onClick={() => handleUnhide(user.id)}
                                                                className="px-3 py-1 bg-blue-500/80 hover:bg-blue-600 text-white rounded transition"
                                                            >
                                                                Zichtbaar
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleHide(user.id)}
                                                                className="px-3 py-1 bg-purple-500/80 hover:bg-purple-600 text-white rounded transition"
                                                            >
                                                                Verbergen
                                                            </button>
                                                        )}
                                                        {user.account_type === 'model' ? (
                                                            <button
                                                                onClick={() => handleSetAccountType(user.id, 'user')}
                                                                className="px-3 py-1 bg-pink-600/80 hover:bg-pink-700 text-white rounded transition"
                                                            >
                                                                Model verwijderen
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleSetAccountType(user.id, 'model')}
                                                                className="px-3 py-1 bg-pink-400/80 hover:bg-pink-500 text-white rounded transition"
                                                            >
                                                                Model maken
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    )}
                </div>
            </div>
        </>
    );
}
