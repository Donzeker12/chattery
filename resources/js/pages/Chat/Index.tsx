import React, { useState, useEffect, useRef } from 'react';
import { router, usePage } from '@inertiajs/react';
import axios from '@/lib/axios';
import Avatar from '../../components/Avatar';
import NotificationManager from '../../components/NotificationManager';

interface User {
    id: number;
    name: string;
    email: string;
    profile_photo_url?: string;
    is_online: boolean;
    created_at: string;
    is_admin?: boolean;
}

interface Chat {
    id: number;
    participant: User;
    latest_message: {
        id: number;
        content: string;
        user_id: number;
        created_at: string;
        attachment_url?: string;
        attachment_type?: 'image' | 'file';
    };
}

interface Message {
    id: number;
    content: string;
    created_at: string;
    updated_at: string;
    attachment_url?: string;
    attachment_type?: 'image' | 'file';
    user: {
        id: number;
        name: string;
    };
    reactions?: Array<{
        id: number;
        emoji: string;
        user_id: number;
    }>;
}

interface PageProps {
    chats: Chat[];
    users: User[];
    auth: {
        user: User;
    };
}

export default function Index({ chats, users, auth }: PageProps) {
    // State declarations
    const [isMobile, setIsMobile] = useState(() => {
        // Initialize with proper mobile detection on mount
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768;
        }
        return false;
    });
    
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            console.log('Mobile detection:', mobile, 'Width:', window.innerWidth);
        };
        
        // Check immediately
        checkMobile();
        
        // Add resize listener
        window.addEventListener('resize', checkMobile);
        
        // Also check on viewport size changes (for testing)
        const observer = new ResizeObserver(() => {
            checkMobile();
        });
        observer.observe(document.body);
        
        return () => {
            window.removeEventListener('resize', checkMobile);
            observer.disconnect();
        };
    }, []);

    const [selectedChat, setSelectedChat] = useState<number | null>(null);
    const [currentParticipant, setCurrentParticipant] = useState<User | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showEmojiPickerForMessage, setShowEmojiPickerForMessage] = useState<number | null>(null);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [chatsList, setChatsList] = useState<Chat[]>(chats);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileUser, setProfileUser] = useState<User | null>(null);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [chatTheme, setChatTheme] = useState('default');
    const [chatColors, setChatColors] = useState({
        primary: '#3B82F6',
        secondary: '#8B5CF6',
        background: 'gradient'
    });
    const [forceInputKey, setForceInputKey] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleLogout = () => {
        router.post('/logout');
    };

    const loadChat = async (chatId: number) => {
        setLoadingMessages(true);
        setMessages([]);
        try {
            const response = await axios.get(`/api/chats/${chatId}`);
            setMessages(response.data.messages || []);
            
            // Only update participant if we got one from the API and don't already have one
            if (response.data.participant && !currentParticipant) {
                setCurrentParticipant(response.data.participant);
            }
        } catch (error) {
            console.error('Error loading chat:', error);
        } finally {
            setLoadingMessages(false);
        }
    };

    const refreshMessages = async () => {
        if (!selectedChat) return;
        try {
            const response = await axios.get(`/api/chats/${selectedChat}`);
            setMessages(response.data.messages || []);
        } catch (error) {
            console.error('Error refreshing messages:', error);
        }
    };

    const refreshChatList = async () => {
        try {
            const response = await axios.get('/api/chats');
            setChatsList(response.data || []);
        } catch (error) {
            console.error('Error refreshing chat list:', error);
        }
    };

    const openChat = async (chatId: number) => {
        setSelectedChat(chatId);
        
        // Find the participant info from chatsList to immediately show the chat interface
        const chat = chatsList.find(c => c.id === chatId);
        if (chat && chat.participant) {
            setCurrentParticipant(chat.participant);
        }
        
        await loadChat(chatId);
    };

    const sendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        if (!newMessage.trim() && !fileInputRef.current?.files?.[0]) return;
        if (!selectedChat) return;

        const messageContent = newMessage.trim();
        const file = fileInputRef.current?.files?.[0];
        
        try {
            const formData = new FormData();
            if (messageContent) {
                formData.append('content', messageContent);
            }
            if (file) {
                formData.append('attachment', file);
            }

            await axios.post(`/api/chats/${selectedChat}/messages`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setNewMessage('');
            setForceInputKey(prev => prev + 1); // Force re-render to clear input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            await refreshMessages();
            await refreshChatList();
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleSearchChange = (query: string) => {
        setSearchQuery(query);
        searchUsers(query);
    };

    const searchUsers = async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            const response = await axios.get(`/api/users`);
            const allUsers = response.data.users || [];
            
            // Filter users based on query (client-side search)
            const filteredUsers = allUsers.filter((user: any) => 
                user.name.toLowerCase().includes(query.toLowerCase()) ||
                user.email.toLowerCase().includes(query.toLowerCase())
            );
            
            setSearchResults(filteredUsers);
        } catch (error) {
            console.error('Error searching users:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const createChat = async (userId: number) => {
        try {
            const response = await axios.post('/api/chats/start', { 
                user_id: userId 
            });
            
            setShowNewChatModal(false);
            setSearchQuery('');
            setSearchResults([]);
            await refreshChatList();
            
            if (response.data.chat) {
                await openChat(response.data.chat.id);
            }
        } catch (error) {
            console.error('Error creating chat:', error);
        }
    };

    const handleDeleteChat = async () => {
        if (!chatToDelete) return;
        
        try {
            await axios.delete(`/api/chats/${chatToDelete.id}`);
            setChatsList(chatsList.filter(chat => chat.id !== chatToDelete.id));
            
            if (selectedChat === chatToDelete.id) {
                setSelectedChat(null);
                setCurrentParticipant(null);
                setMessages([]);
            }
            
            setShowDeleteModal(false);
            setChatToDelete(null);
        } catch (error) {
            console.error('Error deleting chat:', error);
        }
    };

    const openDeleteModal = (chat: Chat, e: React.MouseEvent) => {
        e.stopPropagation();
        setChatToDelete(chat);
        setShowDeleteModal(true);
    };

    const addReaction = async (messageId: number, emoji: string) => {
        if (!selectedChat) return;

        try {
            await axios.post(`/api/messages/${messageId}/reactions`, {
                emoji: emoji
            });
            
            await refreshMessages();
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    };

    const removeReaction = async (reactionId: number) => {
        try {
            await axios.delete(`/api/reactions/${reactionId}`);
            await refreshMessages();
        } catch (error) {
            console.error('Error removing reaction:', error);
        }
    };

    const handleEmojiSelect = (emoji: string) => {
        if (showEmojiPickerForMessage) {
            addReaction(showEmojiPickerForMessage, emoji);
            setShowEmojiPickerForMessage(null);
        } else {
            setNewMessage(prev => prev + emoji);
        }
        setShowEmojiPicker(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            console.log('File selected:', file.name);
        }
    };

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
                {/* Modern Fixed Glass Sidebar */}
                <div className={`${
                    isMobile 
                        ? (selectedChat ? 'hidden' : 'fixed inset-y-0 left-0 w-full z-30') 
                        : 'fixed inset-y-0 left-0 w-80 z-30'
                    } backdrop-blur-xl bg-white/30 border-r border-white/20 shadow-2xl flex flex-col`}>
                    
                    {/* Modern Header with Gradient */}
                    <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-4 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Avatar 
                                        photoUrl={auth.user.profile_photo_url} 
                                        name={auth.user.name} 
                                        size="md"
                                    />
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text">
                                        {auth.user.name}
                                    </h1>
                                    <p className="text-white/80 text-sm">Moderne chat ervaring</p>
                                </div>
                                <div className="flex gap-2">
                                    {auth.user.is_admin && (
                                        <a
                                            href="/admin"
                                            className="p-2 bg-amber-500/80 hover:bg-amber-600 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg"
                                            title="Admin Panel"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </a>
                                    )}
                                    <button
                                        onClick={handleLogout}
                                        className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg"
                                        title="Uitloggen"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modern Profile Button */}
                    <div className="p-4 border-b border-white/10 bg-white/5 backdrop-blur-sm">
                        <button
                            onClick={() => {
                                setProfileUser(auth.user);
                                setShowProfileModal(true);
                            }}
                            className="w-full p-3 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm rounded-2xl hover:from-white/20 hover:to-white/10 transition-all duration-200 hover:scale-[1.02] shadow-lg border border-white/20"
                        >
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Avatar
                                        photoUrl={auth.user.profile_photo_url}
                                        name={auth.user.name}
                                        size="sm"
                                    />
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-gray-800">{auth.user.name}</p>
                                    <p className="text-xs text-gray-600">Profiel bekijken</p>
                                </div>
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </button>
                    </div>

                    {/* Modern New Chat Button */}
                    <div className="p-4 border-b border-white/10">
                        <button
                            onClick={() => setShowNewChatModal(true)}
                            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-2xl font-semibold hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] flex items-center justify-center gap-2 backdrop-blur-sm"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Nieuw gesprek
                        </button>
                    </div>

                    {/* Modern Notification Settings */}
                    <div className="p-4 border-b border-white/10 bg-white/5 backdrop-blur-sm">
                        <NotificationManager />
                    </div>

                    {/* Modern Chat List */}
                    <div className="flex-1 overflow-y-auto bg-white/5 backdrop-blur-sm">
                        {chatsList.length === 0 ? (
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">Geen gesprekken</h3>
                                <p className="text-gray-500 text-sm">Start een nieuw gesprek door op de knop hierboven te klikken.</p>
                            </div>
                        ) : (
                            chatsList.map((chat) => (
                                <div
                                    key={chat.id}
                                    className={`relative p-4 border-b border-gray-200 cursor-pointer transition-colors group ${
                                        selectedChat === chat.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                                    }`}
                                    onClick={() => openChat(chat.id)}
                                >
                                    <div className="flex items-center gap-3 pr-12">
                                        <div className="relative">
                                            <Avatar
                                                photoUrl={chat.participant.profile_photo_url}
                                                name={chat.participant.name}
                                                size="md"
                                            />
                                            {chat.participant.is_online && (
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="font-semibold text-gray-900 truncate">{chat.participant.name}</h3>
                                                <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                                                    {new Date(chat.latest_message.created_at).toLocaleDateString('nl-NL', {
                                                        day: 'numeric',
                                                        month: 'short'
                                                    })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 truncate">
                                                {chat.latest_message.attachment_url ? 
                                                    `📎 ${chat.latest_message.attachment_type === 'image' ? 'Afbeelding' : 'Bestand'}` 
                                                    : chat.latest_message.message
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => openDeleteModal(chat, e)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white p-2 rounded-full min-w-[36px] min-h-[36px] flex items-center justify-center"
                                        title="Gesprek verwijderen"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Modern Main Chat Area */}
                <div className={`${
                    isMobile 
                        ? (selectedChat ? 'w-full' : 'hidden') 
                        : 'ml-80 flex-1'
                    } flex flex-col backdrop-blur-xl bg-white/5 min-h-screen`}>
                    {/* Header */}
                    {selectedChat && currentParticipant ? (
                        <>
                            <div className={`bg-white border-b border-gray-200 p-3 sm:p-4 flex items-center gap-3 sm:gap-4 shadow-sm ${
                                isMobile ? 'sticky top-0 z-20' : ''
                            }`}>
                                {/* Mobile back button */}
                                {isMobile && (
                                    <button
                                        onClick={() => {
                                            setSelectedChat(null);
                                            setCurrentParticipant(null);
                                            setMessages([]);
                                        }}
                                        className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition"
                                        type="button"
                                    >
                                        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                )}

                                {/* Participant info */}
                                <button
                                    onClick={() => {
                                        setProfileUser(currentParticipant);
                                        setShowProfileModal(true);
                                    }}
                                    className="flex items-center gap-3 sm:gap-4 flex-1 hover:bg-gray-50 p-2 -m-2 rounded-lg transition"
                                >
                                    <div className="relative">
                                        <Avatar
                                            photoUrl={currentParticipant.profile_photo_url}
                                            name={currentParticipant.name}
                                            size="md"
                                        />
                                        {currentParticipant.is_online && (
                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
                                        )}
                                    </div>
                                    <div className="text-left min-w-0 flex-1">
                                        <h2 className="font-bold text-gray-900 text-base sm:text-lg truncate">{currentParticipant.name}</h2>
                                        <p className="text-sm text-gray-600">
                                            {currentParticipant.is_online ? '🟢 Online' : '⚪ Offline'}
                                        </p>
                                    </div>
                                </button>

                                {/* Header actions */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={refreshMessages}
                                        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                                        title="Berichten vernieuwen"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Messages container */}
                            <div className={`flex-1 overflow-y-auto ${
                                isMobile ? 'pb-20' : ''
                            }`}>
                                {loadingMessages ? (
                                    <div className="flex items-center justify-center h-32">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                    </div>
                                ) : (
                                    <div className="p-3 sm:p-4 space-y-4">
                                        {messages.map((message, index) => (
                                            <div key={message.id} className="group">
                                                <div className={`flex ${message.is_mine ? 'justify-end' : 'justify-start'} mb-4`}>
                                                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                                                        message.is_mine 
                                                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white ml-12' 
                                                            : 'bg-white border border-gray-200 text-gray-800 mr-12 shadow-sm'
                                                    }`}>
                                                        {message.attachment_url ? (
                                                            <div className="mb-2">
                                                                {message.attachment_type === 'image' ? (
                                                                    <img 
                                                                        src={message.attachment_url} 
                                                                        alt="Attachment"
                                                                        className="rounded-lg max-w-full cursor-pointer"
                                                                        onClick={() => setFullscreenImage && setFullscreenImage(message.attachment_url || null)}
                                                                    />
                                                                ) : (
                                                                    <a 
                                                                        href={message.attachment_url} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="text-blue-500 underline"
                                                                    >
                                                                        📎 Bestand
                                                                    </a>
                                                                )}
                                                            </div>
                                                        ) : null}
                                                        {message.message && (
                                                            <p className="whitespace-pre-wrap">{message.message}</p>
                                                        )}
                                                        <div className={`text-xs mt-1 ${
                                                            message.is_mine ? 'text-white/70' : 'text-gray-500'
                                                        }`}>
                                                            {new Date(message.created_at).toLocaleTimeString('nl-NL', {
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setShowEmojiPickerForMessage(message.id)}
                                                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition flex items-center gap-1"
                                                    >
                                                        <span>😊</span>
                                                        <span>Reactie</span>
                                                    </button>
                                                    {showEmojiPickerForMessage === message.id && (
                                                        <div className="relative">
                                                        <div className="absolute top-0 right-0 transform -translate-y-full bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 z-50 w-80">
                                                            <div className="flex flex-col gap-3">
                                                                <div className="flex gap-2 text-sm font-medium text-gray-600 border-b border-gray-200 pb-2">
                                                                    <span>😀 Emoties</span>
                                                                </div>
                                                                <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto">
                                                                    {['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '🥰', '😘', '😗', '😙', '😚', '🙂', '🤗', '🤩', '🤔', '🫡', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🫠', '🤑', '😲', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩', '🤯', '😬', '😮‍💨', '😵', '😵‍💫', '🥴', '😠', '😡', '🤬', '🤕', '😷', '🤒', '🤮', '🤧', '🥵', '🥶', '🥳', '🥺', '🦄', '🎉', '🎊', '🔥', '💯', '💖', '💝', '💘', '💕', '💗', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💟', '♥️', '💌', '💤', '💢', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💫', '💦', '💨', '🕳️', '💣', '💥', '💢', '💫', '💦', '💨', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏'].map(emoji => (
                                                                        <button 
                                                                            key={emoji}
                                                                            onClick={() => handleEmojiSelect(emoji)}
                                                                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-lg flex items-center justify-center"
                                                                        >
                                                                            {emoji}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                <button
                                                                    onClick={() => setShowEmojiPickerForMessage(null)}
                                                                    className="mt-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                                                                >
                                                                    Sluiten
                                                                </button>
                                                            </div>
                                                        </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>

                            {/* Input area */}
                            <div className={`border-t border-gray-200 bg-white p-3 sm:p-4 ${
                                isMobile ? 'sticky bottom-0 z-20' : ''
                            }`}>
                                <form onSubmit={sendMessage} className="space-y-3">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <input 
                                            type="file" 
                                            ref={fileInputRef}
                                            onChange={handleFileSelect}
                                            className="hidden"
                                            accept="image/*,application/pdf,.doc,.docx,.txt"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                            </svg>
                                        </button>

                                        <div className="flex-1 relative">
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition z-10"
                                                >
                                                    <span className="text-lg">😊</span>
                                                </button>
                                                {showEmojiPicker && (
                                                    <div className="absolute bottom-full left-0 mb-2 z-20">
                                                        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-80">
                                                            <div className="flex flex-col gap-3">
                                                                <div className="flex gap-2 text-sm font-medium text-gray-600 border-b border-gray-200 pb-2">
                                                                    <span>😀 Emoji Picker</span>
                                                                </div>
                                                                <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto">
                                                                    {['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '🥰', '😘', '😗', '😙', '😚', '🙂', '🤗', '🤩', '🤔', '🫡', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🫠', '🤑', '😲', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩', '🤯', '😬', '😮‍💨', '😵', '😵‍💫', '🥴', '😠', '😡', '🤬', '🤕', '😷', '🤒', '🤮', '🤧', '🥵', '🥶', '🥳', '🥺', '🦄', '🎉', '🎊', '🔥', '💯', '💖', '💝', '💘', '💕', '💗', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💟', '♥️', '💌', '💤', '💢', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💫', '💦', '💨', '🕳️', '💣', '💥', '💢', '💫', '💦', '💨', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏'].map(emoji => (
                                                                        <button 
                                                                            key={emoji}
                                                                            onClick={() => handleEmojiSelect(emoji)}
                                                                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-lg flex items-center justify-center"
                                                                        >
                                                                            {emoji}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                <button
                                                                    onClick={() => setShowEmojiPicker(false)}
                                                                    className="mt-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                                                                >
                                                                    Sluiten
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <textarea
                                                    key={forceInputKey}
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    onKeyPress={handleKeyPress}
                                                    placeholder="Typ een bericht..."
                                                    className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    rows={1}
                                                    style={{
                                                        minHeight: '48px',
                                                        maxHeight: '120px',
                                                        height: 'auto',
                                                        overflow: newMessage.split('\n').length > 3 ? 'auto' : 'hidden'
                                                    }}
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={!newMessage.trim() && !fileInputRef.current?.files?.[0]}
                                                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition ${
                                                        newMessage.trim() || fileInputRef.current?.files?.[0]
                                                            ? 'text-blue-600 hover:bg-blue-50 cursor-pointer' 
                                                            : 'text-gray-400 cursor-not-allowed'
                                                    }`}
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center bg-gray-50">
                            <div className="text-center max-w-md mx-auto p-8">
                                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                                    <svg 
                                        className="w-12 h-12 text-gray-400" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                    >
                                        <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={1.5} 
                                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
                                        />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-3">Welkom bij Chattery</h3>
                                <p className="text-gray-600 mb-6">
                                    Selecteer een gesprek uit de lijst of start een nieuw gesprek om te beginnen met chatten.
                                </p>
                                <button
                                    onClick={() => setShowNewChatModal(true)}
                                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full hover:bg-blue-700 transition font-semibold shadow-lg"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Nieuw gesprek starten
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* New Chat Modal */}
                {showNewChatModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-900">Nieuw gesprek starten</h3>
                                    <button
                                        onClick={() => {
                                            setShowNewChatModal(false);
                                            setSearchQuery('');
                                            setSearchResults([]);
                                        }}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="p-6">
                                <input
                                    type="text"
                                    placeholder="Zoek gebruikers..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                
                                {isSearching ? (
                                    <div className="flex justify-center py-8">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                    </div>
                                ) : (
                                    <div className="mt-4 max-h-60 overflow-y-auto">
                                        {searchResults.length > 0 ? (
                                            <div className="space-y-2">
                                                {searchResults.map((user) => (
                                                    <button
                                                        key={user.id}
                                                        onClick={() => createChat(user)}
                                                        className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <Avatar
                                                                photoUrl={user.profile_photo_url}
                                                                name={user.name}
                                                                size="sm"
                                                            />
                                                            <span className="font-medium text-gray-900">{user.name}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : searchQuery.length > 2 ? (
                                            <div className="text-center py-8 text-gray-500">
                                                Geen gebruikers gevonden
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-gray-500">
                                                Type minimaal 3 karakters om te zoeken
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Modal */}
                {showDeleteModal && chatToDelete && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                            <div className="text-center">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-900">Gesprek verbergen</h3>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Weet je zeker dat je dit gesprek wilt verbergen? Het gesprek verdwijnt alleen voor jou. De andere persoon kan het gesprek nog steeds zien.
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => {
                                            setShowDeleteModal(false);
                                            setChatToDelete(null);
                                        }}
                                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition"
                                    >
                                        Annuleren
                                    </button>
                                    <button
                                        onClick={handleDeleteChat}
                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
                                    >
                                        Verbergen
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Fullscreen Image Modal */}
                {fullscreenImage && (
                    <div 
                        className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50"
                        onClick={() => setFullscreenImage(null)}
                    >
                        <button
                            onClick={() => setFullscreenImage(null)}
                            className="absolute top-4 right-4 text-white hover:text-gray-300 transition"
                        >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <img
                            src={fullscreenImage}
                            alt="Fullscreen view"
                            className="max-w-full max-h-full object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )}

                {/* Profile Modal */}
                {showProfileModal && profileUser && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
                            {/* Profile Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 relative">
                                <button
                                    onClick={() => {
                                        setShowProfileModal(false);
                                        setProfileUser(null);
                                    }}
                                    className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                                
                                <div className="flex flex-col items-center">
                                    <div 
                                        className="relative cursor-pointer mb-4"
                                        onClick={() => {
                                            if (profileUser.profile_photo_url) {
                                                setFullscreenImage(profileUser.profile_photo_url);
                                            }
                                        }}
                                    >
                                        <Avatar
                                            photoUrl={profileUser.profile_photo_url}
                                            name={profileUser.name}
                                            size="xl"
                                        />
                                        {profileUser.profile_photo_url && (
                                            <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <h2 className="text-xl font-bold">{profileUser.name}</h2>
                                    <p className="text-white/80 text-sm">
                                        {profileUser.is_online ? '🟢 Online' : '⚪ Offline'}
                                    </p>
                                </div>
                            </div>

                            {/* Profile Content */}
                            <div className="px-6 pb-6">
                                {/* Basic Info */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Informatie</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-sm text-gray-500">E-mail:</span>
                                            <p className="font-medium">{profileUser.email}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-500">Lid sinds:</span>
                                            <p className="font-medium">
                                                {new Date(profileUser.created_at).toLocaleDateString('nl-NL', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                {profileUser.id !== auth.user.id ? (
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Acties</h3>
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => {
                                                    setChatToDelete(selectedChat);
                                                    setShowDeleteModal(true);
                                                    setShowProfileModal(false);
                                                    setProfileUser(null);
                                                }}
                                                className="w-full p-3 text-left hover:bg-red-50 transition rounded-lg flex items-center gap-3 text-red-600"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Chat verbergen
                                            </button>
                                            
                                            <button
                                                onClick={() => {
                                                    alert('Meldingsopties worden binnenkort toegevoegd');
                                                    setShowProfileModal(false);
                                                    setProfileUser(null);
                                                }}
                                                className="w-full p-3 text-left hover:bg-gray-50 transition rounded-lg flex items-center gap-3 text-gray-700"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                                </svg>
                                                Meldingen
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Profiel</h3>
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => {
                                                    setShowProfileModal(false);
                                                    setProfileUser(null);
                                                    setShowSettingsModal(true);
                                                }}
                                                className="w-full p-3 text-left hover:bg-blue-50 transition rounded-lg flex items-center gap-3 text-blue-600"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                Profiel bewerken
                                            </button>
                                            
                                            <button
                                                onClick={() => {
                                                    router.post('/logout');
                                                }}
                                                className="w-full p-3 text-left hover:bg-red-50 transition rounded-lg flex items-center gap-3 text-red-600"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                Uitloggen
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Settings Modal */}
                {showSettingsModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                            {/* Settings Header */}
                            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-6 relative">
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                                
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold">Instellingen</h2>
                                        <p className="text-white/80">Personaliseer je chat ervaring</p>
                                    </div>
                                </div>
                            </div>

                            {/* Settings Content */}
                            <div className="p-6 space-y-8 max-h-[calc(90vh-140px)] overflow-y-auto">
                                {/* Profile Settings */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        Profiel
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                                        <div className="flex items-center gap-4">
                                            <Avatar
                                                photoUrl={auth.user.profile_photo_url}
                                                name={auth.user.name}
                                                size="lg"
                                            />
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Profielfoto</label>
                                                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                                                    Foto uploaden
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Wachtwoord wijzigen</label>
                                            <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm">
                                                Wachtwoord instellen
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Chat Theme */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h4a2 2 0 002-2V9a2 2 0 00-2-2H7a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                        </svg>
                                        Chat kleuren
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-3">Kleurenschema</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {[
                                                    { name: 'Blauw → Paars', colors: ['#3B82F6', '#8B5CF6'], id: 'blue-purple' },
                                                    { name: 'Groen → Teal', colors: ['#10B981', '#14B8A6'], id: 'green-teal' },
                                                    { name: 'Roze → Oranje', colors: ['#EC4899', '#F97316'], id: 'pink-orange' },
                                                    { name: 'Paars → Roze', colors: ['#8B5CF6', '#EC4899'], id: 'purple-pink' },
                                                ].map((theme) => (
                                                    <button
                                                        key={theme.id}
                                                        onClick={() => {
                                                            setChatColors({ primary: theme.colors[0], secondary: theme.colors[1], background: 'gradient' });
                                                            setChatTheme(theme.id);
                                                        }}
                                                        className={`p-3 rounded-lg border-2 transition-all ${
                                                            chatTheme === theme.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div 
                                                                className="w-4 h-4 rounded-full" 
                                                                style={{ background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})` }}
                                                            ></div>
                                                            <span className="text-sm font-medium">{theme.name}</span>
                                                        </div>
                                                        <div 
                                                            className="h-6 rounded" 
                                                            style={{ background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})` }}
                                                        ></div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Background Theme */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Achtergrond thema
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { name: 'Standaard', preview: 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50', id: 'default' },
                                                { name: 'Donker', preview: 'bg-gradient-to-br from-gray-800 via-gray-900 to-black', id: 'dark' },
                                                { name: 'Natuur', preview: 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50', id: 'nature' },
                                                { name: 'Zonsondergang', preview: 'bg-gradient-to-br from-orange-50 via-red-50 to-pink-50', id: 'sunset' },
                                                { name: 'Oceaan', preview: 'bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50', id: 'ocean' },
                                                { name: 'Lavendel', preview: 'bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50', id: 'lavender' }
                                            ].map((theme) => (
                                                <button
                                                    key={theme.id}
                                                    onClick={() => setChatTheme(theme.id)}
                                                    className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
                                                        chatTheme === theme.id ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div className={`h-16 ${theme.preview}`}></div>
                                                    <div className="p-2 bg-white">
                                                        <span className="text-xs font-medium text-gray-700">{theme.name}</span>
                                                    </div>
                                                    {chatTheme === theme.id && (
                                                        <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Features */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Extra features
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <span className="text-sm font-medium text-gray-700">Donkere modus</span>
                                            <input type="checkbox" className="rounded" />
                                        </label>
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <span className="text-sm font-medium text-gray-700">Chat animaties</span>
                                            <input type="checkbox" className="rounded" defaultChecked />
                                        </label>
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <span className="text-sm font-medium text-gray-700">Geluidsmeldingen</span>
                                            <input type="checkbox" className="rounded" defaultChecked />
                                        </label>
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <span className="text-sm font-medium text-gray-700">Typing indicator</span>
                                            <input type="checkbox" className="rounded" defaultChecked />
                                        </label>
                                    </div>
                                </div>

                                {/* Save Button */}
                                <div className="flex gap-3 pt-4 border-t border-gray-200">
                                    <button
                                        onClick={() => {
                                            alert('Instellingen opgeslagen! 🎉');
                                            setShowSettingsModal(false);
                                        }}
                                        className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                                    >
                                        Instellingen opslaan
                                    </button>
                                    <button
                                        onClick={() => setShowSettingsModal(false)}
                                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        Annuleren
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}