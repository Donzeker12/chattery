import { Head, router, usePage } from '@inertiajs/react';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import axios from '@/lib/axios';
import Avatar from '@/components/Avatar';

interface User {
    id: number;
    name: string;
    profile_photo_url?: string | null;
    account_type?: string;
}

interface StoryImage {
    id: number;
    url: string;
}

interface StoryReaction {
    id: number;
    emoji: string;
    user_id: number;
    user_name: string;
}

interface Story {
    id: number;
    user_id: number;
    content: string;
    images: StoryImage[];
    created_at: string;
    reactions: StoryReaction[];
    user?: User;
}

interface PageProps {
    auth: {
        user: User;
    };
}

export default function StoriesIndex() {
    const { auth } = usePage<PageProps>().props;
    const isModel = auth.user.account_type === 'model' || auth.user.account_type === 'admin';
    const [activeView, setActiveView] = useState<'home' | 'mine' | 'create'>('home');
    const [stories, setStories] = useState<Story[]>([]);
    const [myStories, setMyStories] = useState<Story[]>([]);
    const [loadingStories, setLoadingStories] = useState(false);
    const [loadingMyStories, setLoadingMyStories] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [content, setContent] = useState('');
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [editStoryId, setEditStoryId] = useState<number | null>(null);
    const [editContent, setEditContent] = useState('');
    const [editImages, setEditImages] = useState<File[]>([]);
    const [editPreviewUrls, setEditPreviewUrls] = useState<string[]>([]);
    const [removeEditImageIds, setRemoveEditImageIds] = useState<number[]>([]);
    const [formError, setFormError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [fullscreenImage, setFullscreenImage] = useState<{urls: string[], idx: number} | null>(null);
    const [targetStoryId, setTargetStoryId] = useState<number | null>(null);
    const [highlightedStoryId, setHighlightedStoryId] = useState<number | null>(null);
    const [reactionPickerStoryId, setReactionPickerStoryId] = useState<number | null>(null);

    const QUICK_EMOJIS = ['❤️', '😍', '😂', '😮', '👏', '🔥'];

    const handleAddReaction = async (storyId: number, emoji: string) => {
        const story = stories.find(s => s.id === storyId);
        if (!story) return;
        const alreadyReacted = story.reactions.some(r => r.user_id === auth.user.id && r.emoji === emoji);
        if (alreadyReacted) {
            // Toggle off
            await axios.delete(`/api/stories/${storyId}/reactions/${encodeURIComponent(emoji)}`);
            setStories(prev => prev.map(s => s.id === storyId
                ? { ...s, reactions: s.reactions.filter(r => !(r.user_id === auth.user.id && r.emoji === emoji)) }
                : s
            ));
        } else {
            try {
                const res = await axios.post(`/api/stories/${storyId}/reactions`, { emoji });
                setStories(prev => prev.map(s => s.id === storyId
                    ? { ...s, reactions: [...s.reactions, res.data.reaction] }
                    : s
                ));
            } catch {}
        }
        setReactionPickerStoryId(null);
    };

    const fetchStories = async () => {
        setLoadingStories(true);
        try {
            const response = await axios.get('/api/stories');
            const data: Story[] = (Array.isArray(response.data) ? response.data : [])
                .map((s: Story) => ({ ...s, reactions: s.reactions ?? [] }));
            setStories(data);
            // Mark all loaded stories as viewed
            data.forEach(story => {
                axios.post(`/api/stories/${story.id}/view`).catch(() => {});
            });
        } catch (error) {
            console.error('Error loading stories:', error);
        } finally {
            setLoadingStories(false);
        }
    };

    const fetchMyStories = async () => {
        setLoadingMyStories(true);
        try {
            const response = await axios.get('/api/stories/mine');
            setMyStories(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error loading own stories:', error);
        } finally {
            setLoadingMyStories(false);
        }
    };

    const refreshAllStories = async () => {
        await Promise.all([fetchStories(), fetchMyStories()]);
    };

    useEffect(() => {
        void refreshAllStories();
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const value = Number(new URLSearchParams(window.location.search).get('story'));
        if (Number.isFinite(value) && value > 0) {
            setTargetStoryId(value);
            setActiveView('home');
        }
    }, []);

    useEffect(() => {
        if (!targetStoryId || activeView !== 'home' || stories.length === 0) {
            return;
        }

        const found = stories.some((story) => story.id === targetStoryId);
        if (!found) {
            return;
        }

        const timer = window.setTimeout(() => {
            const element = document.getElementById(`story-${targetStoryId}`);
            if (!element) {
                return;
            }
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedStoryId(targetStoryId);

            window.setTimeout(() => setHighlightedStoryId(null), 2200);
        }, 120);

        return () => window.clearTimeout(timer);
    }, [targetStoryId, activeView, stories]);

    useEffect(() => {
        return () => {
            previewUrls.forEach((url) => URL.revokeObjectURL(url));
            editPreviewUrls.forEach((url) => {
                if (url.startsWith('blob:')) URL.revokeObjectURL(url);
            });
        };
    }, [previewUrls, editPreviewUrls]);

    useEffect(() => {
        if (!successMessage) {
            return;
        }

        const timer = window.setTimeout(() => {
            setSuccessMessage(null);
        }, 3000);

        return () => window.clearTimeout(timer);
    }, [successMessage]);

    useEffect(() => {
        if (!fullscreenImage) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setFullscreenImage(null);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [fullscreenImage]);

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        if (files.length === 0) return;
        // Voeg toe aan bestaande selectie
        const newImages = [...selectedImages, ...files];
        setSelectedImages(newImages);
        // Clean up oude previews
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
        setPreviewUrls(newImages.map((file) => URL.createObjectURL(file)));
    };

    const handleEditImageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        setEditImages(files);
        editPreviewUrls.forEach((url) => {
            if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        });
        setEditPreviewUrls(files.map((file) => URL.createObjectURL(file)));
    };

    const startEditingStory = (story: Story) => {
        setActiveView('mine');
        setEditStoryId(story.id);
        setEditContent(story.content);
        setEditImages([]);
        setEditPreviewUrls([]);
        setRemoveEditImageIds([]);
        setFormError(null);
    };

    const cancelEditingStory = () => {
        setEditStoryId(null);
        setEditContent('');
        setEditImages([]);
        setEditPreviewUrls([]);
        setRemoveEditImageIds([]);
    };

    const handleDeleteStory = async (storyId: number) => {
        if (!window.confirm('Weet je zeker dat je dit verhaal wilt verwijderen?')) {
            return;
        }

        try {
            await axios.delete(`/api/stories/${storyId}`);
            setSuccessMessage('Je verhaal is verwijderd.');
            if (editStoryId === storyId) {
                cancelEditingStory();
            }
            await refreshAllStories();
        } catch (error) {
            console.error('Error deleting story:', error);
            setFormError('Verhaal verwijderen is mislukt.');
        }
    };

    const handleUpdateStory = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError(null);

        if (!editStoryId) {
            return;
        }

        if (!editContent.trim()) {
            setFormError('Je verhaaltekst mag niet leeg zijn.');
            return;
        }

        const formData = new FormData();
        formData.append('content', editContent.trim());
        removeEditImageIds.forEach((id) => formData.append('remove_image_ids[]', id.toString()));
        editImages.forEach((file) => formData.append('images[]', file));

        setIsUpdating(true);
        try {
            await axios.post(`/api/stories/${editStoryId}?_method=PUT`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setSuccessMessage('Je verhaal is bijgewerkt.');
            cancelEditingStory();
            await refreshAllStories();
        } catch (error: any) {
            const message = error?.response?.data?.message || 'Verhaal bijwerken is mislukt.';
            setFormError(message);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError(null);

        if (!content.trim()) {
            setFormError('Schrijf eerst een kort verhaal.');
            return;
        }

        const formData = new FormData();
        formData.append('content', content.trim());
        selectedImages.forEach((file) => formData.append('images[]', file));

        setIsSubmitting(true);
        try {
            await axios.post('/api/stories', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setContent('');
            setSelectedImages([]);
            previewUrls.forEach((url) => URL.revokeObjectURL(url));
            setPreviewUrls([]);
            setSuccessMessage('Je verhaal is geplaatst.');
            setActiveView('home');
            await refreshAllStories();
        } catch (error: any) {
            const message = error?.response?.data?.message || 'Verhaal opslaan is mislukt.';
            setFormError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Helper voor lightbox navigatie
    const renderLightbox = () => {
        if (!fullscreenImage) return null;
        const { urls, idx } = fullscreenImage;
        return (
            <div
                className="fixed inset-0 z-50 bg-black/90 p-4 flex items-center justify-center"
                onClick={() => setFullscreenImage(null)}
            >
                <button
                    type="button"
                    onClick={() => setFullscreenImage(null)}
                    className="absolute top-4 right-4 px-3 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30"
                >
                    Sluiten
                </button>
                {urls.length > 1 && idx > 0 && (
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setFullscreenImage({urls, idx: idx-1}); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 px-3 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30"
                    >
                        &#8592;
                    </button>
                )}
                {urls.length > 1 && idx < urls.length-1 && (
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setFullscreenImage({urls, idx: idx+1}); }}
                        className="absolute right-16 top-1/2 -translate-y-1/2 px-3 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30"
                    >
                        &#8594;
                    </button>
                )}
                <img
                    src={urls[idx]}
                    alt="Story fullscreen"
                    className="max-w-[95vw] max-h-[90vh] object-contain"
                    onClick={e => e.stopPropagation()}
                />
            </div>
        );
    };

    return (
        <>
            <Head title="Verhalen" />

            <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#dbeafe,transparent_40%),radial-gradient(circle_at_80%_10%,#fbcfe8,transparent_35%),linear-gradient(180deg,#eef2ff_0%,#f8fafc_100%)]">
                <div className="md:flex">
                    <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:w-80 p-4">
                        <div className="w-full rounded-3xl bg-slate-900/95 text-white shadow-2xl border border-slate-700 p-5 flex flex-col">
                            <div className="mb-6">
                                <p className="text-xs uppercase tracking-[0.2em] text-sky-300/90">Chattery</p>
                                <h1 className="text-3xl font-bold mt-1">Verhalen</h1>
                                <p className="text-slate-300 mt-2 text-sm">Deel snelle updates met je chatcontacten.</p>
                            </div>

                            <div className="space-y-2 mb-4">
                                <button
                                    onClick={() => setActiveView('home')}
                                    className={`w-full rounded-xl py-3 font-semibold transition-colors ${
                                        activeView === 'home'
                                            ? 'bg-white text-slate-900'
                                            : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                    }`}
                                >
                                    Home
                                </button>
                                {isModel && (
                                    <>
                                        <button
                                            onClick={() => setActiveView('mine')}
                                            className={`w-full rounded-xl py-3 font-semibold transition-colors ${
                                                activeView === 'mine'
                                                    ? 'bg-white text-slate-900'
                                                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                            }`}
                                        >
                                            Eigen verhalen
                                        </button>
                                        <button
                                            onClick={() => setActiveView('create')}
                                            className={`w-full rounded-xl py-3 font-semibold transition-colors ${
                                                activeView === 'create'
                                                    ? 'bg-white text-slate-900'
                                                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                            }`}
                                        >
                                            Nieuw verhaal
                                        </button>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={() => router.visit('/chat')}
                                className="w-full mb-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 py-3 font-semibold hover:from-sky-600 hover:to-indigo-600 transition-colors"
                            >
                                Terug naar chats
                            </button>

                            {isModel && (
                                <div className="mb-4 rounded-2xl bg-slate-800/70 border border-slate-700 p-4">
                                    <h3 className="text-sm font-semibold mb-3">Eigen verhalen</h3>
                                    {loadingMyStories ? (
                                        <p className="text-xs text-slate-300">Laden...</p>
                                    ) : (
                                        <>
                                            <p className="text-xs text-slate-300 mb-3">{myStories.length} verhaal{myStories.length === 1 ? '' : 'en'}</p>
                                            <button
                                                onClick={() => setActiveView('mine')}
                                                className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold py-2"
                                            >
                                                Open eigen verhalen
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="mt-auto rounded-2xl bg-slate-800/70 border border-slate-700 p-4">
                                <div className="flex items-center gap-3">
                                    <Avatar
                                        photoUrl={auth.user.profile_photo_url || null}
                                        name={auth.user.name}
                                        size="md"
                                    />
                                    <div>
                                        <p className="font-semibold leading-tight">{auth.user.name}</p>
                                        <p className="text-xs text-slate-300">Klaar om te posten</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>

                    <main className="flex-1 md:ml-80 p-4 md:p-8">
                        <div className="md:hidden mb-4 rounded-2xl bg-slate-900 text-white p-4 flex items-center justify-between">
                            <h1 className="text-xl font-bold">Verhalen</h1>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setActiveView('home')}
                                    className={`px-3 py-2 rounded-lg text-sm ${activeView === 'home' ? 'bg-white text-slate-900' : 'bg-slate-700 hover:bg-slate-600'}`}
                                >
                                    Home
                                </button>
                                <button
                                    onClick={() => setActiveView('mine')}
                                    className={`px-3 py-2 rounded-lg text-sm ${activeView === 'mine' ? 'bg-white text-slate-900' : 'bg-slate-700 hover:bg-slate-600'}`}
                                >
                                    Eigen
                                </button>
                                <button
                                    onClick={() => setActiveView('create')}
                                    className={`px-3 py-2 rounded-lg text-sm ${activeView === 'create' ? 'bg-white text-slate-900' : 'bg-slate-700 hover:bg-slate-600'}`}
                                >
                                    Nieuw
                                </button>
                                <button
                                    onClick={() => router.visit('/chat')}
                                    className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-sm"
                                >
                                    Chats
                                </button>
                            </div>
                        </div>

                        {successMessage && (
                            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 font-medium">
                                {successMessage}
                            </div>
                        )}

                        {isModel && activeView === 'create' && (
                            <section className="rounded-3xl bg-white/90 backdrop-blur border border-white p-5 md:p-7 shadow-xl mb-6">
                                <h2 className="text-2xl font-bold text-slate-900">Nieuw verhaal</h2>
                                <p className="text-slate-600 mt-1 mb-4">Schrijf iets korts en voeg eventueel een foto toe.</p>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <textarea
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder="Wat wil je vandaag delen?"
                                        className="w-full min-h-28 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />

                                    <label className="block rounded-2xl border-2 border-dashed border-slate-300 p-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="hidden"
                                        />
                                        <p className="font-medium text-slate-700">Foto toevoegen</p>
                                        <p className="text-sm text-slate-500 mt-1">Klik om een afbeelding te kiezen</p>
                                    </label>

                                    {previewUrls.length > 0 && (
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {previewUrls.map((url, idx) => (
                                                <div key={url} className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
                                                    <img src={url} alt={`Preview ${idx+1}`} className="w-full max-h-40 object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {formError && <p className="text-sm text-rose-600">{formError}</p>}

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold hover:from-indigo-700 hover:to-violet-700 transition-colors disabled:opacity-60"
                                    >
                                        {isSubmitting ? 'Plaatsen...' : 'Verhaal plaatsen'}
                                    </button>
                                </form>
                            </section>
                        )}

                        {isModel && editStoryId !== null && (
                            <section className="rounded-3xl bg-white/90 backdrop-blur border border-white p-5 md:p-7 shadow-xl mb-6">
                                <h2 className="text-2xl font-bold text-slate-900">Eigen verhaal bijwerken</h2>
                                <p className="text-slate-600 mt-1 mb-4">Pas je tekst aan of vervang je foto.</p>

                                <form onSubmit={handleUpdateStory} className="space-y-4">
                                    <textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="w-full min-h-28 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />

                                    <label className="block rounded-2xl border-2 border-dashed border-slate-300 p-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleEditImageChange}
                                            className="hidden"
                                        />
                                        <p className="font-medium text-slate-700">Nieuwe foto kiezen (optioneel)</p>
                                    </label>

                                    {editPreviewUrl && !removeEditImage && (
                                        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
                                            <img src={editPreviewUrl} alt="Edit preview" className="w-full max-h-80 object-cover" />
                                        </div>
                                    )}

                                    <label className="flex items-center gap-2 text-sm text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={removeEditImage}
                                            onChange={(e) => {
                                                setRemoveEditImage(e.target.checked);
                                                if (e.target.checked) {
                                                    setEditImage(null);
                                                }
                                            }}
                                        />
                                        Verwijder huidige foto uit dit verhaal
                                    </label>

                                    <div className="flex gap-3">
                                        <button
                                            type="submit"
                                            disabled={isUpdating}
                                            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold hover:from-indigo-700 hover:to-violet-700 transition-colors disabled:opacity-60"
                                        >
                                            {isUpdating ? 'Opslaan...' : 'Opslaan'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelEditingStory}
                                            className="px-5 py-3 rounded-xl bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300"
                                        >
                                            Annuleren
                                        </button>
                                    </div>
                                </form>
                            </section>
                        )}

                        {activeView === 'home' && (
                            <section className="space-y-4">
                                <h2 className="text-xl font-bold text-slate-900">Home feed</h2>

                                {loadingStories ? (
                                    <div className="rounded-2xl bg-white/80 border border-white p-6 text-slate-600">Verhalen laden...</div>
                                ) : stories.length === 0 ? (
                                    <div className="rounded-2xl bg-white/80 border border-white p-6 text-slate-600">
                                        Nog geen verhalen van je contacten.
                                    </div>
                                ) : (
                                    stories.map((story) => (
                                        <article
                                            id={`story-${story.id}`}
                                            key={story.id}
                                            className={`max-w-3xl mx-auto rounded-2xl bg-white/95 border shadow-lg p-4 md:p-5 transition-all duration-500 ${
                                                highlightedStoryId === story.id
                                                    ? 'border-indigo-400 ring-4 ring-indigo-200/80'
                                                    : 'border-white'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <Avatar
                                                    photoUrl={story.user?.profile_photo_url || null}
                                                    name={story.user?.name || 'Gebruiker'}
                                                    size="md"
                                                />
                                                <div>
                                                    <p className="font-semibold text-slate-900">{story.user?.name || 'Gebruiker'}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {new Date(story.created_at).toLocaleString('nl-NL', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </p>
                                                </div>
                                            </div>

                                            <p className="text-slate-800 whitespace-pre-wrap leading-relaxed text-[17px]">{story.content}</p>

                                            {story.images && story.images.length > 0 && (
                                                <div className="mt-4 flex justify-center">
                                                    <div className={`grid gap-1 ${story.images.length === 1 ? '' : 'grid-cols-2'} ${story.images.length > 2 ? 'grid-rows-2' : ''} max-w-lg w-full`} style={{gridAutoRows:'1fr'}}>
                                                        {story.images.slice(0,4).map((img, idx) => (
                                                            <button
                                                                key={img.id}
                                                                type="button"
                                                                onClick={() => setFullscreenImage({urls: story.images.map(i => i.url), idx})}
                                                                className="relative group aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white"
                                                                style={{height: story.images.length === 1 ? 'auto' : undefined}}
                                                            >
                                                                <img
                                                                    src={img.url}
                                                                    alt="Story"
                                                                    className="object-cover w-full h-full block cursor-zoom-in group-hover:brightness-90 transition"
                                                                />
                                                                {idx === 3 && story.images.length > 4 && (
                                                                    <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-2xl font-bold">+{story.images.length - 4}</span>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Reactions */}
                                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                                                {/* Grouped reaction counts */}
                                                {Object.entries(
                                                    (story.reactions ?? []).reduce<Record<string, {count: number, mine: boolean}>>((acc, r) => {
                                                        if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
                                                        acc[r.emoji].count++;
                                                        if (r.user_id === auth.user.id) acc[r.emoji].mine = true;
                                                        return acc;
                                                    }, {})
                                                ).map(([emoji, { count, mine }]) => (
                                                    <button
                                                        key={emoji}
                                                        onClick={() => handleAddReaction(story.id, emoji)}
                                                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm border transition ${
                                                            mine
                                                                ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                                                                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                                                        }`}
                                                        title={mine ? 'Klik om te verwijderen' : 'Klik om te reageren'}
                                                    >
                                                        <span>{emoji}</span>
                                                        <span className="font-semibold text-xs">{count}</span>
                                                    </button>
                                                ))}

                                                {/* Add reaction button */}
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setReactionPickerStoryId(reactionPickerStoryId === story.id ? null : story.id)}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-full text-sm border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 transition"
                                                        title="Reageer"
                                                    >
                                                        <span>😊</span>
                                                        <span className="text-xs">+</span>
                                                    </button>
                                                    {reactionPickerStoryId === story.id && (
                                                        <div className="absolute bottom-10 left-0 z-50 flex gap-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-2">
                                                            {QUICK_EMOJIS.map(emoji => (
                                                                <button
                                                                    key={emoji}
                                                                    onClick={() => handleAddReaction(story.id, emoji)}
                                                                    className="text-xl hover:scale-125 transition-transform p-1"
                                                                >
                                                                    {emoji}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    ))
                                )}
                            </section>
                        )}

                        {isModel && activeView === 'mine' && (
                            <section className="space-y-4">
                                <h2 className="text-xl font-bold text-slate-900">Eigen verhalen</h2>

                                {loadingMyStories ? (
                                    <div className="rounded-2xl bg-white/80 border border-white p-6 text-slate-600">Je verhalen laden...</div>
                                ) : myStories.length === 0 ? (
                                    <div className="rounded-2xl bg-white/80 border border-white p-6 text-slate-600">
                                        Je hebt nog geen eigen verhalen.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                        {myStories.map((story) => (
                                            <article key={story.id} className="rounded-2xl bg-white/95 border border-white shadow-lg p-3 flex flex-col">
                                                <div className="text-xs text-slate-500 mb-2">
                                                    {new Date(story.created_at).toLocaleString('nl-NL', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </div>

                                                {story.images && story.images.length > 0 && (
                                                    <div className="mb-3">
                                                        <div className={`grid gap-1 ${story.images.length === 1 ? '' : 'grid-cols-2'} ${story.images.length > 2 ? 'grid-rows-2' : ''} w-full`} style={{gridAutoRows:'1fr'}}>
                                                            {story.images.slice(0,4).map((img, idx) => (
                                                                <button
                                                                    key={img.id}
                                                                    type="button"
                                                                    onClick={() => setFullscreenImage(img.url)}
                                                                    className="relative group aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white"
                                                                >
                                                                    <img
                                                                        src={img.url}
                                                                        alt="Eigen story"
                                                                        className="object-cover w-full h-full block cursor-zoom-in group-hover:brightness-90 transition"
                                                                    />
                                                                    {idx === 3 && story.images.length > 4 && (
                                                                        <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-2xl font-bold">+{story.images.length - 4}</span>
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <p className="text-sm text-slate-800 line-clamp-4 mb-3">{story.content}</p>

                                                <div className="mt-auto flex gap-2">
                                                    <button
                                                        onClick={() => startEditingStory(story)}
                                                        className="flex-1 text-xs px-2 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500"
                                                    >
                                                        Bijwerken
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteStory(story.id)}
                                                        className="flex-1 text-xs px-2 py-2 rounded bg-rose-600 text-white hover:bg-rose-500"
                                                    >
                                                        Verwijderen
                                                    </button>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}
                    </main>
                </div>
            </div>

            {renderLightbox()}
        </>
    );
}