import { useState, useEffect, useRef } from 'react';
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
    const [activeTab, setActiveTab] = useState<'users' | 'security' | 'emojis'>('users');

    // Custom emoji state
    const [customEmojis, setCustomEmojis] = useState<{id: number; name: string; url: string}[]>([]);
    const [emojiName, setEmojiName] = useState('');
    const [emojiFile, setEmojiFile] = useState<File | null>(null);
    const [emojiPreview, setEmojiPreview] = useState<string | null>(null);
    const [emojiError, setEmojiError] = useState<string | null>(null);
    const [emojiLoading, setEmojiLoading] = useState(false);
    const emojiFileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (activeTab === 'emojis' && customEmojis.length === 0) {
            axios.get('/api/custom-emojis').then(res => setCustomEmojis(res.data));
        }
    }, [activeTab]);

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
                            <p className="text-3xl font-bold text-white">
                                {online_users}
                            </p>
                            <p className="text-white/80">Actief in de laatste 30 seconden</p>
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
                        <button
                            onClick={() => setActiveTab('emojis')}
                            className={`px-4 py-2 rounded-lg transition ${
                                activeTab === 'emojis'
                                    ? 'bg-white text-purple-700 font-semibold'
                                    : 'bg-white/15 hover:bg-white/25 text-white'
                            }`}
                        >
                            Custom Emojis
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

                    {activeTab === 'emojis' && (
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
                            <h2 className="text-xl font-semibold text-white mb-4">Custom Emojis beheren</h2>

                            {/* Upload form */}
                            <div className="bg-white/10 rounded-xl p-4 mb-6">
                                <h3 className="text-white font-medium mb-3">Nieuwe emoji uploaden</h3>
                                <div className="flex flex-wrap gap-3 items-end">
                                    <div>
                                        <label className="text-white/80 text-sm block mb-1">Naam <span className="text-white/50">(alleen a-z, 0-9, _)</span></label>
                                        <input
                                            type="text"
                                            value={emojiName}
                                            onChange={e => setEmojiName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                            placeholder="bijv. party_blob"
                                            className="px-3 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/20 focus:outline-none focus:border-white/50 w-48"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-white/80 text-sm block mb-1">Afbeelding / GIF (max 2MB)</label>
                                        <input
                                            ref={emojiFileRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/gif,image/webp"
                                            className="hidden"
                                            onChange={e => {
                                                const f = e.target.files?.[0] ?? null;
                                                setEmojiFile(f);
                                                setEmojiPreview(f ? URL.createObjectURL(f) : null);
                                            }}
                                        />
                                        <button
                                            onClick={() => emojiFileRef.current?.click()}
                                            className="px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white border border-white/20 transition flex items-center gap-2"
                                        >
                                            {emojiPreview ? (
                                                <img src={emojiPreview} className="w-6 h-6 object-contain rounded" alt="preview" />
                                            ) : (
                                                <span>📁</span>
                                            )}
                                            <span>{emojiFile ? emojiFile.name : 'Kies bestand'}</span>
                                        </button>
                                    </div>
                                    <button
                                        disabled={emojiLoading || !emojiName || !emojiFile}
                                        onClick={async () => {
                                            if (!emojiFile || !emojiName) return;
                                            setEmojiLoading(true);
                                            setEmojiError(null);
                                            try {
                                                const fd = new FormData();
                                                fd.append('name', emojiName);
                                                fd.append('image', emojiFile);
                                                const res = await axios.post('/api/custom-emojis', fd, {
                                                    headers: { 'Content-Type': 'multipart/form-data' }
                                                });
                                                setCustomEmojis(prev => [...prev, res.data]);
                                                setEmojiName('');
                                                setEmojiFile(null);
                                                setEmojiPreview(null);
                                                if (emojiFileRef.current) emojiFileRef.current.value = '';
                                            } catch (err: any) {
                                                const msg = err.response?.data?.errors?.name?.[0]
                                                    ?? err.response?.data?.errors?.image?.[0]
                                                    ?? err.response?.data?.message
                                                    ?? 'Er is iets misgegaan.';
                                                setEmojiError(msg);
                                            } finally {
                                                setEmojiLoading(false);
                                            }
                                        }}
                                        className="px-4 py-2 rounded-lg bg-white text-purple-700 font-semibold hover:bg-white/90 transition disabled:opacity-50"
                                    >
                                        {emojiLoading ? 'Uploaden...' : 'Uploaden'}
                                    </button>
                                </div>
                                {emojiError && <p className="text-red-300 mt-2 text-sm">{emojiError}</p>}
                                <p className="text-white/50 text-xs mt-2">Gebruik als <code className="bg-white/10 px-1 rounded">:naam:</code> in de chat</p>
                            </div>

                            {/* Emoji grid */}
                            {customEmojis.length === 0 ? (
                                <p className="text-white/60 text-sm">Nog geen custom emojis.</p>
                            ) : (
                                <div className="flex flex-wrap gap-4">
                                    {customEmojis.map(emoji => (
                                        <div key={emoji.id} className="flex flex-col items-center gap-1 bg-white/10 rounded-xl p-3 relative group">
                                            <img src={emoji.url} alt={emoji.name} className="w-12 h-12 object-contain" />
                                            <span className="text-white/80 text-xs">:{emoji.name}:</span>
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`Emoji :${emoji.name}: verwijderen?`)) return;
                                                    await axios.delete(`/api/custom-emojis/${emoji.id}`);
                                                    setCustomEmojis(prev => prev.filter(e => e.id !== emoji.id));
                                                }}
                                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                                                title="Verwijderen"
                                            >×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
