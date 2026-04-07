import { Head, router } from '@inertiajs/react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import axios from '@/lib/axios';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import Avatar from '@/components/Avatar';

interface User {
    id: number;
    name: string;
    email: string;
    is_admin?: boolean;
    is_online?: boolean;
    profile_photo_url?: string | null;
}

interface Chat {
    id: number;
    participant: User;
    latest_message: {
        message: string;
        created_at: string;
        is_mine: boolean;
    } | null;
    unread_count: number;
}

interface Message {
    id: number;
    message: string;
    attachment_type?: string | null;
    attachment_path?: string | null;
    is_mine: boolean;
    created_at: string;
    edited_at?: string | null;
    user: {
        name: string;
    };
    reactions?: Array<{
        emoji: string;
        count: number;
        users: Array<{ id: number; name: string }>;
        reacted_by_me: boolean;
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
    // Check if we're on mobile
    const [isMobile, setIsMobile] = useState(false);
    const [selectedChat, setSelectedChat] = useState<number | null>(null);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const [messages, setMessages] = useState<Message[]>([]);
    const [currentParticipant, setCurrentParticipant] = useState<User | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [chatsList, setChatsList] = useState<Chat[]>(chats);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [chatToDelete, setChatToDelete] = useState<number | null>(null);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
    const [editingText, setEditingText] = useState('');
    const [showDeleteMenu, setShowDeleteMenu] = useState<number | null>(null);
    const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [showChatSettings, setShowChatSettings] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load chat messages when a chat is selected
    const loadChat = async (chatId: number) => {
        setIsLoading(true);
        
        try {
            const response = await axios.get(`/chat/${chatId}`);
            setMessages(response.data.messages);
            setCurrentParticipant(response.data.chat.participant);
            setSelectedChat(chatId);
            
            // Force scroll to bottom when loading a new chat
            setTimeout(() => scrollToBottom(true), 100);
        } catch (error) {
            console.error('Error loading chat:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Refresh messages for the current chat
    const refreshMessages = async () => {
        if (!selectedChat) return;
        
        try {
            const response = await axios.get(`/chat/${selectedChat}`);
            setMessages(response.data.messages);
        } catch (error) {
            console.error('Error refreshing messages:', error);
        }
    };

    // Refresh chat list
    const refreshChatList = async () => {
        try {
            const response = await axios.get('/chat/list');
            setChatsList(response.data.chats);
        } catch (error) {
            console.error('Error refreshing chat list:', error);
        }
    };

    // Poll for new messages and chat updates
    useEffect(() => {
        const messageInterval = setInterval(() => {
            if (selectedChat) {
                refreshMessages();
            }
        }, 3000); // Check for new messages every 3 seconds

        const chatListInterval = setInterval(() => {
            refreshChatList();
        }, 5000); // Update chat list every 5 seconds

        return () => {
            clearInterval(messageInterval);
            clearInterval(chatListInterval);
        };
    }, [selectedChat]);

    // Send a message
    const sendMessage = async (e: FormEvent) => {
        e.preventDefault();
        // Allow sending if there's any message content (including just emojis) or an image
        if ((!messageInput && !selectedImage) || !selectedChat) return;

        const tempMessage = messageInput;
        setMessageInput('');
        setShowEmojiPicker(false);

        try {
            const formData = new FormData();
            if (tempMessage) {
                formData.append('message', tempMessage);
            }
            if (selectedImage) {
                formData.append('attachment', selectedImage);
            }

            const response = await axios.post(`/chat/${selectedChat}/message`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            
            setMessages([...messages, response.data.message]);
            setSelectedImage(null);
            setImagePreview(null);
            
            // Force scroll to bottom after sending a message
            setTimeout(() => scrollToBottom(true), 100);
        } catch (error) {
            console.error('Error sending message:', error);
            setMessageInput(tempMessage);
        }
    };

    // Handle emoji selection
    const onEmojiClick = (emojiData: EmojiClickData) => {
        setMessageInput(messageInput + emojiData.emoji);
    };

    // Handle image selection
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Remove selected image
    const removeImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Delete message for me
    const deleteMessageForMe = async (messageId: number) => {
        try {
            await axios.delete(`/message/${messageId}/delete-for-me`);
            setMessages(messages.filter(msg => msg.id !== messageId));
            setShowDeleteMenu(null);
        } catch (error: any) {
            alert(error.response?.data?.message || 'Er ging iets mis bij het verwijderen');
        }
    };

    // Delete message for everyone
    const deleteMessageForEveryone = async (messageId: number) => {
        if (!confirm('Weet je zeker dat je dit bericht voor iedereen wilt verwijderen?')) {
            return;
        }
        try {
            await axios.delete(`/message/${messageId}/delete-for-everyone`);
            setMessages(messages.filter(msg => msg.id !== messageId));
            setShowDeleteMenu(null);
        } catch (error: any) {
            alert(error.response?.data?.message || 'Er ging iets mis bij het verwijderen');
        }
    };

    // Start editing a message
    const startEditing = (message: Message) => {
        setEditingMessageId(message.id);
        setEditingText(message.message);
        setShowDeleteMenu(null);
    };

    // Cancel editing
    const cancelEditing = () => {
        setEditingMessageId(null);
        setEditingText('');
    };

    // Save edited message
    const saveEditedMessage = async (messageId: number) => {
        if (!editingText.trim()) {
            alert('Bericht kan niet leeg zijn');
            return;
        }

        try {
            const response = await axios.put(`/message/${messageId}/edit`, {
                message: editingText
            });
            
            // Update message in state
            setMessages(messages.map(msg => 
                msg.id === messageId 
                    ? { ...msg, message: editingText, edited_at: response.data.updated_message.edited_at }
                    : msg
            ));
            
            setEditingMessageId(null);
            setEditingText('');
        } catch (error: any) {
            alert(error.response?.data?.message || 'Er ging iets mis bij het bewerken');
        }
    };

    // Add reaction to message
    const addReaction = async (messageId: number, emoji: string) => {
        try {
            const response = await axios.post(`/message/${messageId}/reaction`, { emoji });
            
            if (response.data.success) {
                // Refresh messages to get updated reactions
                await refreshMessages();
            }
            
            setShowReactionPicker(null);
        } catch (error: any) {
            if (error.response?.status === 422) {
                // User already reacted with this emoji
                alert(error.response?.data?.message || 'Je hebt al met deze emoji gereageerd');
            } else {
                alert('Er ging iets mis bij het toevoegen van de reactie');
            }
        }
    };

    // Remove reaction from message
    const removeReaction = async (messageId: number, emoji: string) => {
        try {
            await axios.delete(`/message/${messageId}/reaction/${encodeURIComponent(emoji)}`);
            
            // Refresh messages to get updated reactions
            await refreshMessages();
        } catch (error: any) {
            alert('Er ging iets mis bij het verwijderen van de reactie');
        }
    };

    // Start a new chat
    const startNewChat = async (userId: number) => {
        try {
            const response = await axios.post('/chat/start', { user_id: userId });
            setShowNewChatModal(false);
            
            // Load the chat directly instead of reloading the page
            await loadChat(response.data.chat_id);
            
            // Then reload to update the chat list in the sidebar
            router.reload({ only: ['chats'] });
        } catch (error) {
            console.error('Error starting chat:', error);
        }
    };

    // Delete chat
    const handleDeleteChat = async () => {
        if (!chatToDelete) return;

        try {
            await axios.delete(`/chat/${chatToDelete}`);
            
            // Close modal
            setShowDeleteModal(false);
            setChatToDelete(null);
            
            // If currently viewing the deleted chat, clear the view
            if (selectedChat === chatToDelete) {
                setSelectedChat(null);
                setMessages([]);
                setCurrentParticipant(null);
            }
            
            // Refresh chat list
            await refreshChatList();
        } catch (error) {
            console.error('Error deleting chat:', error);
            alert('Er ging iets mis bij het verwijderen van het gesprek');
        }
    };

    const openDeleteModal = (chatId: number, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent chat selection
        setChatToDelete(chatId);
        setShowDeleteModal(true);
    };

    // Logout
    const handleLogout = () => {
        router.post('/logout');
    };

    // Format date
    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    };

    // Check if user is at bottom of messages
    const isAtBottom = () => {
        const messageContainer = document.getElementById('messages-container');
        if (!messageContainer) return false;
        
        const threshold = 100; // pixels from bottom
        const position = messageContainer.scrollTop + messageContainer.clientHeight;
        const bottom = messageContainer.scrollHeight;
        
        return position >= bottom - threshold;
    };

    // Scroll to bottom of messages
    const scrollToBottom = (force = false) => {
        const messageContainer = document.getElementById('messages-container');
        if (messageContainer) {
            // Only scroll if user is already at bottom or forced
            if (force || isAtBottom()) {
                messageContainer.scrollTop = messageContainer.scrollHeight;
                setShowScrollButton(false);
            }
        }
    };

    // Scroll to bottom when messages change (only if user was already at bottom)
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle scroll to show/hide scroll-to-bottom button
    useEffect(() => {
        const messageContainer = document.getElementById('messages-container');
        if (!messageContainer) return;

        const handleScroll = () => {
            const threshold = 100;
            const position = messageContainer.scrollTop + messageContainer.clientHeight;
            const bottom = messageContainer.scrollHeight;
            const atBottom = position >= bottom - threshold;
            
            setShowScrollButton(!atBottom);
        };

        messageContainer.addEventListener('scroll', handleScroll);
        // Check initial state
        handleScroll();
        
        return () => messageContainer.removeEventListener('scroll', handleScroll);
    }, [selectedChat, messages]);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            
            if (showDeleteMenu !== null && !target.closest('.relative')) {
                setShowDeleteMenu(null);
            }
            
            if (showReactionPicker !== null && !target.closest('[data-reaction-picker]')) {
                setShowReactionPicker(null);
            }

            if (showChatSettings && !target.closest('.relative')) {
                setShowChatSettings(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDeleteMenu, showReactionPicker, showChatSettings]);

    // Check if message is a single emoji
    const isSingleEmoji = (text: string): boolean => {
        if (!text) return false;
        // Remove whitespace
        const trimmed = text.trim();
        // Regex to match a single emoji (simplified version)
        const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u;
        return emojiRegex.test(trimmed);
    };

    return (
        <>
            <Head title="Chat" />
            <PWAInstallPrompt />
            <div className="h-screen flex overflow-hidden bg-gray-100">
                {/* Chat List - Full screen on mobile, sidebar on desktop */}
                <div className={`${
                    isMobile 
                        ? (selectedChat ? 'hidden' : 'w-full') 
                        : 'w-80'
                    } bg-white border-r border-gray-200 flex flex-col h-screen`}>
                    
                    {/* Sidebar Header */}
                    <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">Chats</h2>
                            <div className="flex gap-2">
                                {auth.user.is_admin && (
                                    <a
                                        href="/admin"
                                        className="text-sm bg-yellow-500/80 hover:bg-yellow-600 px-3 py-1 rounded-lg transition"
                                    >
                                        Admin
                                    </a>
                                )}
                                <button
                                    onClick={handleLogout}
                                    className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition"
                                >
                                    Uitloggen
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={() => router.visit('/profile')}
                            className="flex items-center gap-3 w-full hover:bg-white/10 p-2 rounded-lg transition-colors cursor-pointer group"
                            title="Klik om je profiel te bewerken"
                        >
                            <div className="relative group-hover:brightness-75 transition-all">
                                <Avatar
                                    photoUrl={auth.user.profile_photo_url}
                                    name={auth.user.name}
                                    size="md"
                                />
                                {/* Edit icon in corner */}
                                <span className="absolute -bottom-0.5 -right-0.5 bg-indigo-600 rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                    ✏️
                                </span>
                            </div>
                            <div className="text-left flex-1">
                                <p className="font-semibold">{auth.user.name}</p>
                                <p className="text-sm text-white/80 group-hover:text-white/100 transition-colors">
                                    Klik om profiel te bewerken
                                </p>
                            </div>
                            <div className="ml-auto text-white/60 group-hover:text-white/90 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </button>
                    </div>

                    {/* New Chat Button */}
                    <div className="p-4 border-b border-gray-200">
                        <button
                            onClick={() => setShowNewChatModal(true)}
                            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
                        >
                            + Nieuw gesprek
                        </button>
                    </div>

                    {/* Chat List */}
                    <div className="flex-1 overflow-y-auto">
                        {chatsList.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                <p>Geen gesprekken</p>
                                <p className="text-sm mt-2">Start een nieuw gesprek!</p>
                            </div>
                        ) : (
                            chatsList.map((chat) => (
                                <div
                                    key={chat.id}
                                    className={`relative group w-full border-b border-gray-200 ${
                                        selectedChat === chat.id ? 'bg-blue-50' : ''
                                    }`}
                                >
                                    <button
                                        onClick={() => loadChat(chat.id)}
                                        className="w-full p-4 md:p-3 hover:bg-gray-50 transition text-left min-h-[64px] md:min-h-[auto]"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar
                                                photoUrl={chat.participant.profile_photo_url}
                                                name={chat.participant.name}
                                                size="lg"
                                                isOnline={chat.participant.is_online}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="font-semibold text-gray-900 truncate">
                                                        {chat.participant.name}
                                                    </p>
                                                    {chat.unread_count > 0 && (
                                                        <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                                                            {chat.unread_count}
                                                        </span>
                                                    )}
                                                </div>
                                                {chat.latest_message && (
                                                    <p className="text-sm text-gray-600 truncate">
                                                        {chat.latest_message.is_mine ? 'Jij: ' : ''}
                                                        {chat.latest_message.message}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                    
                                    {/* Delete button - always visible on mobile, hover on desktop */}
                                    <button
                                        onClick={(e) => openDeleteModal(chat.id, e)}
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

                {/* Main Chat Area - Full screen on mobile when chat selected */}
                <div className={`${
                    isMobile 
                        ? (selectedChat ? 'w-full' : 'hidden') 
                        : 'flex-1'
                    } flex flex-col`}>
                    {/* Header */}
                    {selectedChat && currentParticipant ? (
                        <>
                            <div className="bg-white border-b border-gray-200 p-3 sm:p-4 flex items-center gap-3 sm:gap-4 shadow-sm">
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

                                <button
                                    onClick={() => {
                                        if (currentParticipant.profile_photo_url) {
                                            setFullscreenImage(currentParticipant.profile_photo_url);
                                        }
                                    }}
                                    className={`${currentParticipant.profile_photo_url ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                                    title={currentParticipant.profile_photo_url ? 'Klik om profielfoto te vergroten' : ''}
                                    type="button"
                                >
                                    <Avatar
                                        photoUrl={currentParticipant.profile_photo_url}
                                        name={currentParticipant.name}
                                        size="md"
                                        isOnline={currentParticipant.is_online}
                                    />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">{currentParticipant.name}</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs sm:text-sm text-gray-600 truncate hidden sm:block">{currentParticipant.email}</p>
                                        {currentParticipant.is_online && (
                                            <span className="text-xs text-green-600 font-medium">• Online</span>
                                        )}
                                    </div>
                                </div>

                                {/* Settings Menu */}
                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            console.log('Settings menu clicked');
                                            setShowChatSettings(!showChatSettings);
                                        }}
                                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                        title="Chat opties"
                                    >
                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                        </svg>
                                    </button>
                                    
                                    {showChatSettings && (
                                        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-48">
                                            <div className="py-2">
                                                <button
                                                    onClick={() => {
                                                        console.log('Profile clicked - opening profile modal');
                                                        setShowProfileModal(true);
                                                        setShowChatSettings(false);
                                                    }}
                                                    className="w-full px-4 py-2 text-left hover:bg-gray-100 transition flex items-center gap-3"
                                                >
                                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                    Profiel bekijken
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Messages */}
                            <div
                                id="messages-container"
                                className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50"
                            >
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-gray-500">Laden...</div>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-center text-gray-500">
                                            <p>Nog geen berichten</p>
                                            <p className="text-sm mt-2">Stuur een bericht om te beginnen!</p>
                                        </div>
                                    </div>
                                ) : (
                                    messages.map((message) => {
                                        const isOnlyEmoji = !message.attachment_type && isSingleEmoji(message.message);
                                        const isEditing = editingMessageId === message.id;
                                        
                                        return (
                                        <div
                                            key={message.id}
                                            className={`flex ${message.is_mine ? 'justify-end' : 'justify-start'} group`}
                                        >
                                            <div className={`relative ${isOnlyEmoji ? '' : 'max-w-[85%] sm:max-w-sm md:max-w-md'}`}>
                                                {/* Edit/Delete buttons - alleen voor eigen berichten */}
                                                {message.is_mine && !isOnlyEmoji && !isEditing && (
                                                    <div className="absolute -top-2 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                        <button
                                                            onClick={() => startEditing(message)}
                                                            className="bg-gray-700 text-white p-1 rounded hover:bg-gray-800 text-xs"
                                                            title="Bewerken"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => setShowDeleteMenu(showDeleteMenu === message.id ? null : message.id)}
                                                                className="bg-red-500 text-white p-1 rounded hover:bg-red-600 text-xs"
                                                                title="Verwijderen"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                            {showDeleteMenu === message.id && (
                                                                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 whitespace-nowrap">
                                                                    <button
                                                                        onClick={() => deleteMessageForMe(message.id)}
                                                                        className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"
                                                                    >
                                                                        Verwijder voor mij
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteMessageForEveryone(message.id)}
                                                                        className="block w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-gray-100"
                                                                    >
                                                                        Verwijder voor iedereen
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {isEditing ? (
                                                    // Edit mode
                                                    <div className="bg-white border-2 border-blue-500 rounded-2xl p-3 shadow">
                                                        <textarea
                                                            value={editingText}
                                                            onChange={(e) => setEditingText(e.target.value)}
                                                            className="w-full border border-gray-300 rounded p-2 text-sm resize-none"
                                                            rows={3}
                                                            autoFocus
                                                        />
                                                        <div className="flex gap-2 mt-2">
                                                            <button
                                                                onClick={() => saveEditedMessage(message.id)}
                                                                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                                            >
                                                                Opslaan
                                                            </button>
                                                            <button
                                                                onClick={cancelEditing}
                                                                className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                                                            >
                                                                Annuleren
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // Normal message display
                                                    <div
                                                        className={`${
                                                            isOnlyEmoji 
                                                                ? 'p-0' 
                                                                : `px-4 py-2 rounded-2xl ${
                                                                    message.is_mine
                                                                        ? 'bg-blue-600 text-white rounded-br-none'
                                                                        : 'bg-white text-gray-900 rounded-bl-none shadow'
                                                                }`
                                                        }`}
                                                    >
                                                        {message.attachment_type === 'image' && message.attachment_path && (
                                                            <img
                                                                src={message.attachment_path}
                                                                alt="Shared image"
                                                                className="rounded-lg mb-2 max-w-full cursor-pointer hover:opacity-90 transition"
                                                                onClick={() => setFullscreenImage(message.attachment_path || null)}
                                                            />
                                                        )}
                                                        {message.message && (
                                                            <p className={`${isOnlyEmoji ? 'text-6xl' : 'break-words'}`}>
                                                                {message.message}
                                                            </p>
                                                        )}
                                                        {!isOnlyEmoji && (
                                                            <div className="flex items-center gap-2">
                                                                <p
                                                                    className={`text-xs mt-1 ${
                                                                        message.is_mine ? 'text-blue-100' : 'text-gray-500'
                                                                    }`}
                                                                >
                                                                    {formatTime(message.created_at)}
                                                                </p>
                                                                {message.edited_at && (
                                                                    <span
                                                                        className={`text-xs italic ${
                                                                            message.is_mine ? 'text-blue-200' : 'text-gray-400'
                                                                        }`}
                                                                    >
                                                                        (bewerkt)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                {/* Reactions */}
                                                {!isEditing && message.reactions && message.reactions.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {message.reactions.map((reaction, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    // Alleen eigen reaction verwijderen is toegestaan
                                                                    if (reaction.reacted_by_me) {
                                                                        removeReaction(message.id, reaction.emoji);
                                                                    } else if (!message.is_mine) {
                                                                        // Alleen reageren op berichten van anderen
                                                                        addReaction(message.id, reaction.emoji);
                                                                    }
                                                                }}
                                                                className={`px-2 py-1 rounded-full text-sm flex items-center gap-1 transition ${
                                                                    reaction.reacted_by_me
                                                                        ? 'bg-blue-100 border-2 border-blue-500 cursor-pointer'
                                                                        : message.is_mine
                                                                            ? 'bg-gray-100 border border-gray-300 cursor-default'
                                                                            : 'bg-gray-100 border border-gray-300 hover:bg-gray-200 cursor-pointer'
                                                                }`}
                                                                title={reaction.users.map(u => u.name).join(', ')}
                                                                disabled={message.is_mine && !reaction.reacted_by_me}
                                                            >
                                                                <span>{reaction.emoji}</span>
                                                                <span className="text-xs font-medium">{reaction.count}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                
                                                {/* Add reaction button - alleen voor berichten van anderen */}
                                                {!isEditing && !isOnlyEmoji && !message.is_mine && (
                                                    <div className="relative" data-reaction-picker>
                                                        <button
                                                            onClick={() => setShowReactionPicker(showReactionPicker === message.id ? null : message.id)}
                                                            className="mt-1 text-gray-400 hover:text-gray-600 text-xs opacity-0 group-hover:opacity-100 transition"
                                                            title="Reageer"
                                                        >
                                                            😊 Reageer
                                                        </button>
                                                        
                                                        {showReactionPicker === message.id && (
                                                            <div className="absolute left-0 top-full mt-1 z-50">
                                                                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2">
                                                                    <EmojiPicker
                                                                        onEmojiClick={(emojiData: EmojiClickData) => {
                                                                            addReaction(message.id, emojiData.emoji);
                                                                        }}
                                                                        width={300}
                                                                        height={400}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Scroll to bottom button */}
                            {showScrollButton && (
                                <div className="absolute bottom-24 right-8 z-10">
                                    <button
                                        onClick={() => scrollToBottom(true)}
                                        className="relative bg-gradient-to-br from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-full p-4 shadow-2xl transition-all transform hover:scale-110 animate-bounce"
                                        title="Scroll naar beneden"
                                    >
                                        {/* Badge for new messages indicator */}
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
                                        
                                        <svg 
                                            className="w-6 h-6" 
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path 
                                                strokeLinecap="round" 
                                                strokeLinejoin="round" 
                                                strokeWidth={3} 
                                                d="M19 14l-7 7m0 0l-7-7m7 7V3" 
                                            />
                                        </svg>
                                    </button>
                                </div>
                            )}

                            {/* Message Input */}
                            <div className="bg-white border-t border-gray-200 p-2 sm:p-4">
                                {imagePreview && (
                                    <div className="mb-3 relative inline-block">
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="h-20 w-20 object-cover rounded-lg"
                                        />
                                        <button
                                            onClick={removeImage}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                                
                                <form onSubmit={sendMessage} className="flex gap-1 sm:gap-2 items-end relative">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageSelect}
                                        className="hidden"
                                    />
                                    
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-3 md:p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition min-w-[44px] min-h-[44px] flex items-center justify-center"
                                        title="Upload afbeelding"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </button>

                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className="p-3 md:p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition min-w-[44px] min-h-[44px] flex items-center justify-center"
                                            title="Emoji toevoegen"
                                        >
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </button>
                                        
                                        {showEmojiPicker && (
                                            <div className="absolute bottom-full mb-2 right-0 z-50">
                                                <EmojiPicker onEmojiClick={onEmojiClick} />
                                            </div>
                                        )}
                                    </div>

                                    <input
                                        type="text"
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        placeholder="Typ een bericht..."
                                        className="flex-1 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    />
                                    
                                    <button
                                        type="submit"
                                        disabled={!messageInput && !selectedImage}
                                        className="bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
                                    >
                                        <span className="hidden sm:inline">Verzend</span>
                                        <svg className="sm:hidden w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        // Desktop: Show "Select conversation" message
                        // Mobile: This div is hidden when no chat is selected
                        !isMobile && (
                            <div className="flex-1 flex items-center justify-center bg-gray-50">
                                <div className="text-center text-gray-500">
                                    <svg
                                        className="w-24 h-24 mx-auto mb-4 text-gray-400"
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
                                    <h3 className="text-xl font-semibold mb-2">Selecteer een gesprek</h3>
                                    <p>Kies een gesprek uit de zijbalk om te beginnen met chatten</p>
                                </div>
                            </div>
                        )
                    )}
                </div>

                {/* New Chat Modal */}
                {showNewChatModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold">Nieuw gesprek</h3>
                                    <button
                                        onClick={() => setShowNewChatModal(false)}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        <svg
                                            className="w-6 h-6"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M6 18L18 6M6 6l12 12"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                {users.length === 0 ? (
                                    <p className="text-center text-gray-500">Geen gebruikers beschikbaar</p>
                                ) : (
                                    <div className="space-y-2">
                                        {users.map((user) => (
                                            <button
                                                key={user.id}
                                                onClick={() => startNewChat(user.id)}
                                                className="w-full p-3 hover:bg-gray-50 rounded-lg transition text-left flex items-center gap-3"
                                            >
                                                <Avatar
                                                    photoUrl={user.profile_photo_url}
                                                    name={user.name}
                                                    size="md"
                                                />
                                                <div>
                                                    <p className="font-semibold text-gray-900">{user.name}</p>
                                                    <p className="text-sm text-gray-600">{user.email}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                            <div className="p-6">
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
                {showProfileModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
                            {/* Profile Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 relative">
                                <button
                                    onClick={() => setShowProfileModal(false)}
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
                                            if (currentParticipant.profile_photo_url) {
                                                setFullscreenImage(currentParticipant.profile_photo_url);
                                            }
                                        }}
                                    >
                                        <Avatar
                                            photoUrl={currentParticipant.profile_photo_url}
                                            name={currentParticipant.name}
                                            size="xl"
                                        />
                                        {currentParticipant.profile_photo_url && (
                                            <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <h2 className="text-xl font-bold">{currentParticipant.name}</h2>
                                    <p className="text-white/80 text-sm">
                                        {currentParticipant.is_online ? '🟢 Online' : '⚪ Offline'}
                                    </p>
                                </div>
                            </div>

                            {/* Profile Content */}
                            <div className="p-6 space-y-6 overflow-y-auto max-h-96">
                                {/* Contact Info */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Contactgegevens</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
                                            </svg>
                                            <div>
                                                <p className="text-sm text-gray-500">Email</p>
                                                <p className="font-medium">{currentParticipant.email}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            <div>
                                                <p className="text-sm text-gray-500">Gebruiker ID</p>
                                                <p className="font-medium">#{currentParticipant.id}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Acties</h3>
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => {
                                                setChatToDelete(selectedChat);
                                                setShowDeleteModal(true);
                                                setShowProfileModal(false);
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
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
