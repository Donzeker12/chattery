import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useState, useEffect } from 'react';
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload';

interface User {
    id: number;
    name: string;
    email: string;
    is_admin?: boolean;
    profile_photo_url?: string | null;
}

interface PageProps {
    auth: {
        user: User;
    };
}

export default function Profile({ auth }: PageProps) {
    const [user, setUser] = useState(auth.user);
    const [isLoading, setIsLoading] = useState(true);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    
    const { data, setData, post, processing, errors, reset } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    useEffect(() => {
        console.log('Profile component mounted');
        console.log('Auth:', auth);
        console.log('User:', user);
        setIsLoading(false);
    }, []);

    const handlePasswordChange = (e: FormEvent) => {
        e.preventDefault();
        
        post('/profile/password', {
            onSuccess: () => {
                alert('Wachtwoord succesvol gewijzigd!');
                reset();
                setShowPasswordForm(false);
            },
            onError: () => {
                console.log('Password change errors:', errors);
            }
        });
    };

    const handlePhotoUpdate = (newPhotoUrl: string | null) => {
        console.log('Photo updated to:', newPhotoUrl);
        setUser({ ...user, profile_photo_url: newPhotoUrl });
    };

    const handleBackToChat = () => {
        router.visit('/chat');
    };

    // Safety check
    if (!auth?.user) {
        console.error('No auth.user found!');
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center bg-white p-8 rounded-lg shadow-lg">
                    <h1 className="text-2xl font-bold mb-4 text-gray-800">Geen gebruiker gevonden</h1>
                    <button
                        onClick={() => router.visit('/login')}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                        Terug naar login
                    </button>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-indigo-100">
                <div className="text-2xl font-bold text-indigo-600">Laden...</div>
            </div>
        );
    }

    return (
        <>
            <Head title="Profiel Instellingen" />
            
            <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
                <div className="container mx-auto px-4 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <button
                            onClick={handleBackToChat}
                            className="mb-4 text-indigo-600 hover:text-indigo-800 flex items-center gap-2"
                        >
                            ← Terug naar chat
                        </button>
                        <h1 className="text-3xl font-bold text-gray-800">Profiel Instellingen</h1>
                    </div>

                    {/* Profile Card */}
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-2xl mx-auto">
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 h-32"></div>
                        
                        <div className="px-8 pb-8">
                            {/* Profile Photo */}
                            <div className="flex justify-center -mt-12 mb-6">
                                <ProfilePhotoUpload
                                    currentPhotoUrl={user.profile_photo_url}
                                    onPhotoUpdate={handlePhotoUpdate}
                                />
                            </div>

                            {/* User Information */}
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                                    {user.name}
                                </h2>
                                <p className="text-gray-600">{user.email}</p>
                                {user.is_admin && (
                                    <span className="inline-block mt-2 px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-semibold rounded-full">
                                        👑 Admin
                                    </span>
                                )}
                            </div>

                            {/* Profile Info Section */}
                            <div className="space-y-4">
                                <div className="border-t border-gray-200 pt-6">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                        Account Informatie
                                    </h3>
                                    
                                    <div className="space-y-3">
                                        <div className="flex justify-between py-2">
                                            <span className="text-gray-600">Naam</span>
                                            <span className="font-medium text-gray-800">{user.name}</span>
                                        </div>
                                        <div className="flex justify-between py-2">
                                            <span className="text-gray-600">Email</span>
                                            <span className="font-medium text-gray-800">{user.email}</span>
                                        </div>
                                        <div className="flex justify-between py-2">
                                            <span className="text-gray-600">Gebruikers ID</span>
                                            <span className="font-medium text-gray-800">#{user.id}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Password Change Section */}
                                <div className="border-t border-gray-200 pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-semibold text-gray-800">
                                            Wachtwoord Wijzigen
                                        </h3>
                                        <button
                                            onClick={() => setShowPasswordForm(!showPasswordForm)}
                                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                                        >
                                            {showPasswordForm ? 'Annuleren' : 'Wijzigen'}
                                        </button>
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

                                {/* Instructions */}
                                <div className="border-t border-gray-200 pt-6">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-blue-800 mb-2">
                                            💡 Tips voor je profielfoto
                                        </h4>
                                        <ul className="text-sm text-blue-700 space-y-1">
                                            <li>• Gebruik een vierkante foto voor het beste resultaat</li>
                                            <li>• Maximale bestandsgrootte: 5MB</li>
                                            <li>• Ondersteunde formaten: JPG, PNG, GIF, WebP</li>
                                            <li>• Klik op je profielfoto om te wijzigen of te verwijderen</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Additional Actions */}
                    <div className="max-w-2xl mx-auto mt-6 text-center">
                        <button
                            onClick={() => router.post('/logout')}
                            className="text-red-600 hover:text-red-800 font-medium"
                        >
                            🚪 Uitloggen
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
