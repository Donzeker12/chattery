import { Head, Link, useForm, router, usePage } from '@inertiajs/react';
import type { FormEvent} from 'react';
import { useEffect } from 'react';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';

interface PageProps {
    [key: string]: unknown;
    auth?: {
        user?: {
            id: number;
            name: string;
            email: string;
        };
    };
}

export default function Register() {
    const { auth } = usePage<PageProps>().props;
    
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        profile_type: 'individual' as 'individual' | 'couple',
        gender: '' as '' | 'male' | 'female' | 'other' | 'prefer_not_to_say',
    });

    // Check if user is already logged in and redirect to chat
    useEffect(() => {
        if (auth?.user) {
            router.visit('/chat');
        }
    }, [auth]);

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        post('/register');
    }

    return (
        <>
            <Head title="Registreren" />
            <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Account aanmaken</h1>
                        <p className="text-gray-600">Begin met chatten</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                Naam
                            </label>
                            <input
                                id="name"
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                                placeholder="Jouw naam"
                                required
                            />
                            {errors.name && (
                                <p className="mt-2 text-sm text-red-600">{errors.name}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                E-mailadres
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                                placeholder="jouw@email.nl"
                                required
                            />
                            {errors.email && (
                                <p className="mt-2 text-sm text-red-600">{errors.email}</p>
                            )}
                        </div>

                        <fieldset>
                            <legend className="block text-sm font-medium text-gray-700 mb-2">Profieltype</legend>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { value: 'individual', label: 'Persoon' },
                                    { value: 'couple', label: 'Koppel' },
                                ].map((option) => (
                                    <label
                                        key={option.value}
                                        className={`cursor-pointer rounded-lg border-2 p-3 text-center font-medium transition ${
                                            data.profile_type === option.value
                                                ? 'border-purple-600 bg-purple-50 text-purple-700'
                                                : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="profile_type"
                                            value={option.value}
                                            checked={data.profile_type === option.value}
                                            onChange={() => {
                                                const profileType = option.value as 'individual' | 'couple';
                                                setData('profile_type', profileType);

                                                if (profileType === 'couple') {
                                                    setData('gender', '');
                                                }
                                            }}
                                            className="sr-only"
                                        />
                                        {option.label}
                                    </label>
                                ))}
                            </div>
                            {errors.profile_type && <p className="mt-2 text-sm text-red-600">{errors.profile_type}</p>}
                        </fieldset>

                        {data.profile_type === 'individual' && (
                            <div>
                                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
                                    Gender
                                </label>
                                <select
                                    id="gender"
                                    value={data.gender}
                                    onChange={(e) => setData('gender', e.target.value as typeof data.gender)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                                    required
                                >
                                    <option value="">Maak een keuze</option>
                                    <option value="male">Man</option>
                                    <option value="female">Vrouw</option>
                                    <option value="other">Anders</option>
                                    <option value="prefer_not_to_say">Zeg ik liever niet</option>
                                </select>
                                {errors.gender && <p className="mt-2 text-sm text-red-600">{errors.gender}</p>}
                            </div>
                        )}

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Wachtwoord
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                                placeholder="••••••••"
                                required
                            />
                            {errors.password && (
                                <p className="mt-2 text-sm text-red-600">{errors.password}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="password_confirmation" className="block text-sm font-medium text-gray-700 mb-2">
                                Bevestig wachtwoord
                            </label>
                            <input
                                id="password_confirmation"
                                type="password"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                                placeholder="••••••••"
                                required
                            />
                            {errors.password_confirmation && (
                                <p className="mt-2 text-sm text-red-600">{errors.password_confirmation}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {processing ? 'Registreren...' : 'Registreren'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600">
                            Heb je al een account?{' '}
                            <Link
                                href="/login"
                                className="text-purple-600 hover:text-purple-700 font-semibold"
                            >
                                Log in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
            <PWAInstallPrompt />
        </>
    );
}
