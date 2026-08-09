import { Head, router, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import axios from '@/lib/axios';

type ProfileType = 'individual' | 'couple';
type Gender = 'male' | 'female' | 'other';

interface PageProps {
    [key: string]: unknown;
    auth: {
        user: {
            name: string;
            profile_type?: ProfileType | null;
            gender?: Gender | null;
        };
    };
}

export default function CompleteProfile() {
    const { auth } = usePage<PageProps>().props;
    const [profileType, setProfileType] = useState<ProfileType | null>(auth.user.profile_type ?? null);
    const [gender, setGender] = useState<Gender | null>(auth.user.gender ?? null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSubmit = profileType === 'couple' || (profileType === 'individual' && gender !== null);

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        if (!canSubmit || !profileType) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            await axios.patch('/profile', {
                profile_type: profileType,
                gender: profileType === 'couple' ? null : gender,
            });
            router.visit('/chat', { replace: true });
        } catch (requestError: any) {
            const errors = requestError.response?.data?.errors;
            setError(errors?.profile_type?.[0] || errors?.gender?.[0] || 'Opslaan is niet gelukt. Probeer het opnieuw.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Head title="Profiel aanvullen" />
            <main className="min-h-dvh bg-gradient-to-br from-blue-50 via-white to-rose-50 px-4 py-8 sm:py-12">
                <div className="mx-auto w-full max-w-lg">
                    <div className="mb-8 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 10c0 4.418-4.03 8-9 8a10.7 10.7 0 0 1-4-.75L3 19l1.5-3.5A7.2 7.2 0 0 1 3 10c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-blue-700">Chattery</p>
                            <h1 className="text-2xl font-bold text-gray-950">Maak je profiel compleet</h1>
                        </div>
                    </div>

                    <form onSubmit={submit} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                        <p className="mb-7 text-sm leading-6 text-gray-600">
                            Welkom terug, {auth.user.name}. Kies wat voor profiel je gebruikt voordat je verdergaat.
                        </p>

                        <fieldset>
                            <legend className="mb-3 text-sm font-semibold text-gray-900">Profieltype</legend>
                            <div className="grid grid-cols-2 gap-3">
                                {([
                                    ['individual', 'Persoon'],
                                    ['couple', 'Koppel'],
                                ] as const).map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => {
                                            setProfileType(value);
                                            if (value === 'couple') {
                                                setGender(null);
                                            }
                                        }}
                                        className={`min-h-12 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition ${
                                            profileType === value
                                                ? 'border-blue-600 bg-blue-50 text-blue-800'
                                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        {profileType === 'individual' && (
                            <fieldset className="mt-7">
                                <legend className="mb-3 text-sm font-semibold text-gray-900">Ik ben</legend>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    {([
                                        ['male', 'Man'],
                                        ['female', 'Vrouw'],
                                        ['other', 'Anders'],
                                    ] as const).map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setGender(value)}
                                            className={`min-h-12 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition ${
                                                gender === value
                                                    ? 'border-rose-600 bg-rose-50 text-rose-800'
                                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                        )}

                        {error && (
                            <p className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={!canSubmit || saving}
                            className="mt-8 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {saving ? 'Opslaan...' : 'Opslaan en doorgaan'}
                        </button>

                        <button
                            type="button"
                            onClick={() => router.post('/logout')}
                            className="mt-3 w-full px-5 py-2 text-sm font-medium text-gray-500 hover:text-gray-800"
                        >
                            Uitloggen
                        </button>
                    </form>
                </div>
            </main>
        </>
    );
}