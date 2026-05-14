import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState, useEffect, FormEvent } from 'react';
import axios from '@/lib/axios';
import Avatar from '@/components/Avatar';
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload';

interface User {
    id: number;
    name: string;
    email: string;
    is_admin?: boolean;
    profile_photo_url?: string | null;
    chat_theme?: string;
    dark_mode?: boolean;
    chat_animations?: boolean;
    sound_notifications?: boolean;
    show_typing_indicator?: boolean;
}

interface PageProps {
    auth: {
        user: User;
    };
}

type SettingsTab = 'profiel' | 'beveiliging' | 'gesprekken' | 'thema' | 'extra';

const menuItems: { id: SettingsTab; label: string; icon: string; description: string }[] = [
    { id: 'profiel', label: 'Profiel', icon: '👤', description: 'Foto en naam' },
    { id: 'beveiliging', label: 'Beveiliging', icon: '🔐', description: 'Wachtwoord' },
    { id: 'gesprekken', label: 'Gesprekken', icon: '💬', description: 'Verborgen chats' },
    { id: 'thema', label: 'Thema', icon: '🎨', description: 'Kleurstelling' },
    { id: 'extra', label: 'Extra features', icon: '⚡', description: 'Voorkeuren en app' },
];

interface ExtraSettings {
    darkMode: boolean;
    chatAnimations: boolean;
    soundNotifications: boolean;
    typingIndicator: boolean;
}

interface PreferencesPayload {
    chat_theme?: string;
    dark_mode?: boolean;
    chat_animations?: boolean;
    sound_notifications?: boolean;
    show_typing_indicator?: boolean;
}

export default function Settings() {
    const { auth } = usePage<PageProps>().props;
    const [activeTab, setActiveTab] = useState<SettingsTab>('profiel');
    const [hiddenChats, setHiddenChats] = useState<any[]>([]);
    const [loadingHiddenChats, setLoadingHiddenChats] = useState(false);
    const [user, setUser] = useState(auth.user);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [selectedTheme, setSelectedTheme] = useState(auth.user.chat_theme || 'default');
    const [extraSettings, setExtraSettings] = useState<ExtraSettings>({
        darkMode: auth.user.dark_mode ?? false,
        chatAnimations: auth.user.chat_animations ?? true,
        soundNotifications: auth.user.sound_notifications ?? true,
        typingIndicator: auth.user.show_typing_indicator ?? true,
    });
    
    const { data, setData, post, processing, errors, reset } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    useEffect(() => {
        if (activeTab === 'gesprekken') {
            loadHiddenChats();
        }
    }, [activeTab]);

    const loadHiddenChats = async () => {
        setLoadingHiddenChats(true);
        try {
            const response = await axios.get('/chat/hidden');
            setHiddenChats(response.data.hidden_chats || []);
        } catch (error) {
            console.error('Error loading hidden chats:', error);
        } finally {
            setLoadingHiddenChats(false);
        }
    };

    const unhideChat = async (chatId: number) => {
        try {
            await axios.post(`/chat/${chatId}/unhide`);
            setHiddenChats(hiddenChats.filter(chat => chat.id !== chatId));
        } catch (error) {
            console.error('Error unhiding chat:', error);
            alert('Fout bij het zichtbaar maken van de chat');
        }
    };

    const handlePasswordChange = (e: FormEvent) => {
        e.preventDefault();
        
        post('/profile/password', {
            onSuccess: () => {
                reset();
                setShowPasswordForm(false);
                setSuccessMessage('Wachtwoord succesvol gewijzigd!');
                setShowSuccessModal(true);
                setTimeout(() => setShowSuccessModal(false), 3000);
            },
        });
    };

    const handlePhotoUpdate = (newPhotoUrl: string | null) => {
        setUser({ ...user, profile_photo_url: newPhotoUrl });
        setSuccessMessage('Profielfoto succesvol bijgewerkt!');
        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), 3000);
    };

    const handleThemeChange = (theme: string) => {
        setSelectedTheme(theme);
        void savePreferences({ chat_theme: theme }, `Thema gewijzigd naar ${theme}!`);
    };

    const handleExtraSettingChange = (setting: keyof ExtraSettings) => {
        setExtraSettings((prev) => {
            const nextValue = !prev[setting];
            const keyMap: Record<keyof ExtraSettings, keyof PreferencesPayload> = {
                darkMode: 'dark_mode',
                chatAnimations: 'chat_animations',
                soundNotifications: 'sound_notifications',
                typingIndicator: 'show_typing_indicator',
            };

            const labelMap: Record<keyof ExtraSettings, string> = {
                darkMode: 'Donkere modus',
                chatAnimations: 'Chat animaties',
                soundNotifications: 'Geluidsmeldingen',
                typingIndicator: 'Typing indicator',
            };

            void savePreferences(
                { [keyMap[setting]]: nextValue },
                `${labelMap[setting]} ${nextValue ? 'ingeschakeld' : 'uitgeschakeld'}`
            );

            return {
                ...prev,
                [setting]: nextValue,
            };
        });
    };

    const savePreferences = async (payload: PreferencesPayload, successText: string) => {
        try {
            await axios.post('/settings/preferences', payload);
            setSuccessMessage(successText);
            setShowSuccessModal(true);
            setTimeout(() => setShowSuccessModal(false), 3000);
        } catch (error) {
            console.error('Error saving preferences:', error);
            alert('Instellingen konden niet opgeslagen worden');
        }
    };

    const handleBackToChat = () => {
        router.visit('/chat');
    };

    // Render different content based on active tab
    const renderContent = () => {
        switch (activeTab) {
            case 'profiel':
                return <ProfielContent user={user} onPhotoUpdate={handlePhotoUpdate} />;
            case 'beveiliging':
                return (
                    <BeveigingContent
                        user={user}
                        showPasswordForm={showPasswordForm}
                        setShowPasswordForm={setShowPasswordForm}
                        handlePasswordChange={handlePasswordChange}
                        data={data}
                        setData={setData}
                        processing={processing}
                        errors={errors}
                        reset={reset}
                    />
                );
            case 'gesprekken':
                return <GesprekkenContent hiddenChats={hiddenChats} loadingHiddenChats={loadingHiddenChats} unhideChat={unhideChat} />;
            case 'thema':
                return <ThemaContent selectedTheme={selectedTheme} onThemeChange={handleThemeChange} />;
            case 'extra':
                return <ExtraFeaturesContent settings={extraSettings} onToggle={handleExtraSettingChange} />;
            default:
                return null;
        }
    };

    return (
        <>
            <Head title="Instellingen" />
            
            <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
                <div className="container mx-auto px-4 py-8">
                    {/* Header */}
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-800 mb-2">Instellingen</h1>
                            <p className="text-gray-600">Personaliseer je Chattery account</p>
                        </div>
                        <button
                            onClick={handleBackToChat}
                            className="flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Terug naar Chat
                        </button>
                    </div>

                    {/* Success Message */}
                    {showSuccessModal && (
                        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <p className="text-green-800 font-medium">{successMessage}</p>
                        </div>
                    )}

                    {/* Main Layout with Sidebar */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Sidebar Menu */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-xl shadow-lg p-4 sticky top-8">
                                <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-4">Menu</h2>
                                <div className="space-y-2">
                                    {menuItems.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveTab(item.id)}
                                            className={`w-full text-left p-3 rounded-lg transition-all duration-200 flex items-center gap-3 ${
                                                activeTab === item.id
                                                    ? 'bg-indigo-600 text-white shadow-md'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            <span className="text-xl">{item.icon}</span>
                                            <div>
                                                <p className="font-semibold text-sm">{item.label}</p>
                                                <p className={`text-xs ${activeTab === item.id ? 'text-indigo-100' : 'text-gray-500'}`}>
                                                    {item.description}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="lg:col-span-3">
                            {renderContent()}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

// Content Components
interface ProfielContentProps {
    user: User;
    onPhotoUpdate: (url: string | null) => void;
}

const ProfielContent: React.FC<ProfielContentProps> = ({ user, onPhotoUpdate }) => (
    <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Profielfoto</h2>
            
            <div className="space-y-6">
                <ProfilePhotoUpload
                    currentPhotoUrl={user.profile_photo_url}
                    onPhotoUpdate={onPhotoUpdate}
                />
                
                <div className="text-center border-t pt-6">
                    <h3 className="text-xl font-semibold text-gray-800">{user.name}</h3>
                    <p className="text-gray-600">{user.email}</p>
                    {user.is_admin && (
                        <span className="inline-block mt-2 px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                            Administrator
                        </span>
                    )}
                </div>
            </div>
        </div>
    </div>
);

interface BeveigingContentProps {
    user: User;
    showPasswordForm: boolean;
    setShowPasswordForm: (show: boolean) => void;
    handlePasswordChange: (e: FormEvent) => void;
    data: any;
    setData: any;
    processing: boolean;
    errors: any;
    reset: () => void;
}

const BeveigingContent: React.FC<BeveigingContentProps> = ({
    user,
    showPasswordForm,
    setShowPasswordForm,
    handlePasswordChange,
    data,
    setData,
    processing,
    errors,
    reset,
}) => (
    <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Account Beveiliging</h2>

            {/* Account Information */}
            <div className="space-y-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gebruikersnaam</label>
                    <p className="text-gray-900">{user.name}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                    <p className="text-gray-900">{user.email}</p>
                </div>
            </div>

            {/* Password Change Section */}
            <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Wachtwoord Wijzigen</h3>
                    {!showPasswordForm && (
                        <button
                            onClick={() => setShowPasswordForm(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            Wijzigen
                        </button>
                    )}
                </div>

                {showPasswordForm && (
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div>
                            <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 mb-1">
                                Huidig wachtwoord
                            </label>
                            <input
                                type="password"
                                id="current_password"
                                value={data.current_password}
                                onChange={(e) => setData('current_password', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                    errors.current_password ? 'border-red-500' : 'border-gray-300'
                                }`}
                                required
                            />
                            {errors.current_password && (
                                <p className="mt-1 text-sm text-red-600">{errors.current_password}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                Nieuw wachtwoord
                            </label>
                            <input
                                type="password"
                                id="password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                    errors.password ? 'border-red-500' : 'border-gray-300'
                                }`}
                                required
                            />
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="password_confirmation" className="block text-sm font-medium text-gray-700 mb-1">
                                Bevestig nieuw wachtwoord
                            </label>
                            <input
                                type="password"
                                id="password_confirmation"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                    errors.password_confirmation ? 'border-red-500' : 'border-gray-300'
                                }`}
                                required
                            />
                            {errors.password_confirmation && (
                                <p className="mt-1 text-sm text-red-600">{errors.password_confirmation}</p>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={processing}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {processing ? 'Wijzigen...' : 'Wachtwoord Wijzigen'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPasswordForm(false);
                                    reset();
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Annuleren
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>

        {/* Info Section */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-amber-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Wachtwoord Vereisten
            </h3>
            <ul className="text-amber-800 space-y-2 text-sm">
                <li>• Minimaal 8 karakters lang</li>
                <li>• Gebruik een uniek wachtwoord</li>
                <li>• Combineer letters, cijfers en symbolen</li>
                <li>• Kies iets wat moeilijk te raden is</li>
            </ul>
        </div>
    </div>
);

interface GesprekkenContentProps {
    hiddenChats: any[];
    loadingHiddenChats: boolean;
    unhideChat: (chatId: number) => void;
}

const GesprekkenContent: React.FC<GesprekkenContentProps> = ({ hiddenChats, loadingHiddenChats, unhideChat }) => (
    <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Verborgen Gesprekken</h2>
            
            <p className="text-gray-600 mb-6">
                Hier kun je je verborgen gesprekken beheren. Als je een gesprek hier zichtbaar maakt, zal het weer verschijnen in je chatlijst.
            </p>

            {loadingHiddenChats ? (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : hiddenChats.length > 0 ? (
                <div className="space-y-3">
                    {hiddenChats.map((chat) => (
                        <div key={chat.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                            <div className="flex items-center gap-4 flex-1">
                                <Avatar
                                    photoUrl={chat.participant.profile_photo_url}
                                    name={chat.participant.name}
                                    size="sm"
                                />
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-900">{chat.participant.name}</h3>
                                    <p className="text-sm text-gray-600 truncate">
                                        {chat.latest_message 
                                            ? (chat.latest_message.message || 'Bericht') 
                                            : 'Geen berichten'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => unhideChat(chat.id)}
                                className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
                            >
                                Zichtbaar Maken
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 17M9.878 9.878l-3-3m12.121 12.121L21 21" />
                    </svg>
                    <p className="text-gray-500 text-lg">Je hebt geen verborgen gesprekken</p>
                    <p className="text-gray-400 text-sm mt-2">Verborgen gesprekken verschijnen hier</p>
                </div>
            )}
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Hoe werk het verbergen van gesprekken?
            </h3>
            <ul className="text-blue-800 space-y-2 text-sm">
                <li>• Klik op de rode knop (X) naast een gesprek om het te verbergen</li>
                <li>• Verborgen gesprekken verdwijnen uit je chatlijst</li>
                <li>• Je kunt verborgen gesprekken hier op elk moment zichtbaar maken</li>
                <li>• Dit is privé en beïnvloedt niet de ander</li>
            </ul>
        </div>
    </div>
);

interface ThemaContentProps {
    selectedTheme: string;
    onThemeChange: (theme: string) => void;
}

const themes = [
    { id: 'default', name: 'Default', colors: 'from-blue-200 via-purple-200 to-pink-200', bg: 'bg-gradient-to-br from-blue-200 via-purple-200 to-pink-200' },
    { id: 'dark', name: 'Dark', colors: 'from-gray-800 via-gray-900 to-black', bg: 'bg-gradient-to-br from-gray-800 via-gray-900 to-black' },
    { id: 'nature', name: 'Nature', colors: 'from-green-200 via-emerald-200 to-teal-200', bg: 'bg-gradient-to-br from-green-200 via-emerald-200 to-teal-200' },
    { id: 'sunset', name: 'Sunset', colors: 'from-orange-200 via-red-200 to-pink-200', bg: 'bg-gradient-to-br from-orange-200 via-red-200 to-pink-200' },
    { id: 'ocean', name: 'Ocean', colors: 'from-blue-200 via-cyan-200 to-teal-200', bg: 'bg-gradient-to-br from-blue-200 via-cyan-200 to-teal-200' },
    { id: 'lavender', name: 'Lavender', colors: 'from-purple-200 via-violet-200 to-indigo-200', bg: 'bg-gradient-to-br from-purple-200 via-violet-200 to-indigo-200' },
];

const ThemaContent: React.FC<ThemaContentProps> = ({ selectedTheme, onThemeChange }) => (
    <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Chat Thema</h2>
            <p className="text-gray-600 mb-6">Kies een kleurstelling voor je chat achtergrond</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {themes.map((theme) => (
                    <button
                        key={theme.id}
                        onClick={() => onThemeChange(theme.id)}
                        className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                            selectedTheme === theme.id
                                ? 'border-indigo-600 ring-2 ring-indigo-300'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <div className={`${theme.bg} h-20 rounded-lg mb-3`}></div>
                        <h3 className="font-semibold text-gray-800">{theme.name}</h3>
                        {selectedTheme === theme.id && (
                            <p className="text-sm text-indigo-600 font-medium">✓ Actief</p>
                        )}
                    </button>
                ))}
            </div>
        </div>

        {/* Voorvertoning */}
        <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Voorvertoning</h3>
            <div className={`${themes.find(t => t.id === selectedTheme)?.bg} h-40 rounded-xl`}></div>
        </div>
    </div>
);

interface ExtraFeaturesContentProps {
    settings: ExtraSettings;
    onToggle: (setting: keyof ExtraSettings) => void;
}

const ExtraFeaturesContent: React.FC<ExtraFeaturesContentProps> = ({ settings, onToggle }) => (
    <div className="space-y-6">
        <div className="bg-slate-900 text-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <span className="text-emerald-400">⚡</span>
                Extra features
            </h2>

            <div className="bg-slate-800 rounded-xl p-5 space-y-4">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <span className="text-slate-100 font-medium">Donkere modus</span>
                    <input
                        type="checkbox"
                        checked={settings.darkMode}
                        onChange={() => onToggle('darkMode')}
                        className="h-4 w-4 accent-red-500"
                    />
                </label>

                <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <span className="text-slate-100 font-medium">Chat animaties</span>
                    <input
                        type="checkbox"
                        checked={settings.chatAnimations}
                        onChange={() => onToggle('chatAnimations')}
                        className="h-4 w-4 accent-red-500"
                    />
                </label>

                <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <span className="text-slate-100 font-medium">Geluidsmeldingen</span>
                    <input
                        type="checkbox"
                        checked={settings.soundNotifications}
                        onChange={() => onToggle('soundNotifications')}
                        className="h-4 w-4 accent-red-500"
                    />
                </label>

                <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <span className="text-slate-100 font-medium">Typing indicator</span>
                    <input
                        type="checkbox"
                        checked={settings.typingIndicator}
                        onChange={() => onToggle('typingIndicator')}
                        className="h-4 w-4 accent-red-500"
                    />
                </label>
            </div>
        </div>

        <div className="bg-slate-900 text-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <span className="text-violet-500">📱</span>
                Android App
            </h3>

            <div className="bg-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="font-semibold text-lg text-white">Download de app</p>
                    <p className="text-slate-300">Gebruik Chattery op je Android telefoon</p>
                </div>
                <a
                    href="/downloads/chattery.apk"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-700 hover:to-purple-700 transition-colors"
                >
                    <span>⬇</span>
                    Download APK
                </a>
            </div>
        </div>
    </div>
);
