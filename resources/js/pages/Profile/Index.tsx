import { Head, router, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useState, useEffect } from 'react';
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload';

// Success Modal Component
interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    message: string;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, onClose, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
                <div className="flex items-center mb-4">
                    <div className="flex-shrink-0">
                        <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-lg font-medium text-gray-900">Gelukt!</h3>
                    </div>
                </div>
                <p className="text-gray-700 mb-6">{message}</p>
                <button
                    onClick={onClose}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    OK
                </button>
            </div>
        </div>
    );
};

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

export default function Profile() {
    const { auth, flash } = usePage<PageProps & { flash: { success?: string } }>().props;
    const [user, setUser] = useState(auth.user);
    const [isLoading, setIsLoading] = useState(true);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    
    const { data, setData, post, processing, errors, reset } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    useEffect(() => {
        console.log('Profile component mounted');
        console.log('Auth:', auth);
        console.log('User:', user);
        console.log('Flash data:', flash);
        setIsLoading(false);
    }, []);

    // Handle flash messages
    useEffect(() => {
        console.log('Flash effect triggered:', flash);
        if (flash?.success) {
            console.log('Setting modal to show:', flash.success);
            setShowSuccessModal(true);
        }
    }, [flash]);

    const handlePasswordChange = (e: FormEvent) => {
        e.preventDefault();
        
        post('/profile/password', {
            onSuccess: (page) => {
                console.log('Password change successful, page data:', page);
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
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-4xl font-bold text-gray-800 mb-2">Profiel Instellingen</h1>
                                <p className="text-gray-600">Beheer je account instellingen en voorkeuren</p>
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
                    </div>

                    {/* Main Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Profile Photo Section */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                                <svg className="w-6 h-6 mr-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Profielfoto
                            </h2>
                            
                            <div className="space-y-6">
                                <ProfilePhotoUpload
                                    currentPhotoUrl={user.profile_photo_url}
                                    onPhotoUpdate={handlePhotoUpdate}
                                />
                                
                                <div className="text-center">
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

                        {/* Account Settings Section */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                                <svg className="w-6 h-6 mr-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Account Beveiliging
                            </h2>

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

                            {/* Instructions */}
                            <div className="border-t border-gray-200 pt-6">
                                <h4 className="text-md font-semibold text-gray-800 mb-2">Wachtwoord Vereisten</h4>
                                <ul className="text-sm text-gray-600 space-y-1">
                                    <li>• Minimaal 8 karakters lang</li>
                                    <li>• Gebruik een uniek wachtwoord</li>
                                    <li>• Combineer letters, cijfers en symbolen</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                    {/* Download App Section */}
                    <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                            <svg className="w-6 h-6 mr-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16l-6-6m6 6l6-6m-6 6V4" />
                            </svg>
                            Download de Android App
                        </h2>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                            <div className="flex-1">
                                <p className="text-gray-600 mb-2">
                                    Gebruik Chattery ook op je Android telefoon. Download de app en log in met je account.
                                </p>
                                <ul className="text-sm text-gray-500 space-y-1">
                                    <li>• Zet "Installeren van onbekende bronnen" aan in instellingen</li>
                                    <li>• Download en open het APK-bestand</li>
                                    <li>• Log in met hetzelfde account</li>
                                </ul>
                            </div>
                            <a
                                href="/downloads/chattery.apk"
                                download
                                className="flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-md whitespace-nowrap"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download APK
                            </a>
                        </div>
                    </div>
                </div>

                {/* Success Modal */}
                <SuccessModal 
                    isOpen={showSuccessModal}
                    onClose={() => {
                        console.log('Closing modal');
                        setShowSuccessModal(false);
                    }}
                    message={flash?.success || ''}
                />
            </div>
        </>
    );
}