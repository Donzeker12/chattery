import { Head, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import Avatar from '@/components/Avatar';

export default function Settings() {
    const [hiddenChats, setHiddenChats] = useState<any[]>([]);
    const [loadingHiddenChats, setLoadingHiddenChats] = useState(false);

    useEffect(() => {
        loadHiddenChats();
    }, []);

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

    const handleBackToChat = () => {
        router.visit('/chat');
    };

    return (
        <>
            <Head title="Instellingen" />
            
            <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
                <div className="container mx-auto px-4 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-4xl font-bold text-gray-800 mb-2">Instellingen</h1>
                                <p className="text-gray-600">Beheer je gesprekken en voorkeuren</p>
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

                    {/* Hidden Chats Section */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                            <svg className="w-6 h-6 mr-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 17M9.878 9.878l-3-3m12.121 12.121L21 21" />
                            </svg>
                            Verborgen Gesprekken
                        </h2>
                        
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
                    <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
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
            </div>
        </>
    );
}
