import React, { useState, useEffect, useRef } from 'react';
import { router, usePage } from '@inertiajs/react';
import axios from '@/lib/axios';
import Avatar from '../../components/Avatar';
import NotificationManager from '../../components/NotificationManager';

interface User {
    id: number;
    name: string;
    profile_photo_url?: string;
    is_online: boolean;
    created_at?: string;
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
    message?: string;
    created_at: string;
    updated_at: string;
    is_mine?: boolean;
    attachment_url?: string;
    attachment_type?: 'image' | 'file';
    view_once?: boolean;
    view_once_viewed?: boolean;
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
    // All state declarations first
    const [isMobile, setIsMobile] = useState(() => {
        // Initialize with proper mobile detection on mount
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768;
        }
        return false;
    });
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
    const [chatsList, setChatsList] = useState<Chat[]>(Array.isArray(chats) ? chats : []);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileUser, setProfileUser] = useState<User | null>(null);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [photoUploadMsg, setPhotoUploadMsg] = useState<string | null>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const [darkMode, setDarkMode] = useState(() => {
        // Initialize from localStorage
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('darkMode');
            return saved === 'true';
        }
        return false;
    });
    const [chatTheme, setChatTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('chatTheme') || 'default';
        }
        return 'default';
    });
    const [chatAnimations, setChatAnimations] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('chatAnimations');
            return saved !== 'false'; // Default true
        }
        return true;
    });
    const [soundNotifications, setSoundNotifications] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('soundNotifications');
            return saved !== 'false'; // Default true
        }
        return true;
    });
    const [showTypingIndicator, setShowTypingIndicator] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('showTypingIndicator');
            return saved !== 'false'; // Default true
        }
        return true;
    });
    const [chatColors, setChatColors] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('chatColors');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    // Fallback to default
                }
            }
        }
        return {
            primary: '#3B82F6',
            secondary: '#8B5CF6',
            background: 'gradient'
        };
    });
    const [forceInputKey, setForceInputKey] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
    const [viewOnce, setViewOnce] = useState(false);
    const [showDeleteMenu, setShowDeleteMenu] = useState<number | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<{messageId: number, type: 'me' | 'everyone'} | null>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
    const [showMediaGallery, setShowMediaGallery] = useState(false);
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [mediaFilter, setMediaFilter] = useState<'all' | 'images' | 'files'>('all');
    const [loadingMedia, setLoadingMedia] = useState(false);
    
    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Effects
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

    // Close delete menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showDeleteMenu && !(event.target as Element).closest('.delete-menu-container')) {
                setShowDeleteMenu(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDeleteMenu]);

    // Check if user is at bottom of messages
    const checkIfAtBottom = () => {
        if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px tolerance
            setIsAtBottom(isAtBottom);
        }
    };

    // Add scroll listener for messages container
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (container) {
            container.addEventListener('scroll', checkIfAtBottom);
            return () => container.removeEventListener('scroll', checkIfAtBottom);
        }
    }, [selectedChat]);

    const scrollToBottom = () => {
        // Gebruik instant scroll altijd voor snelste respons
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
        setIsAtBottom(true);
    };

    // Auto-scroll when messages change - only if user is already at bottom
    useEffect(() => {
        if (messages.length > 0) {
            // Only auto-scroll if user is already at the bottom
            // This prevents interrupting users who are reading older messages
            if (isAtBottom) {
                scrollToBottom();
            }
        }
    }, [messages, isAtBottom]);

    // Auto-scroll immediately when chat opens (always scroll to bottom for new chats)
    useEffect(() => {
        if (selectedChat && messages.length > 0) {
            // Always scroll to bottom when opening a different chat
            scrollToBottom();
            setIsAtBottom(true); // Ensure we're marked as at bottom
        }
    }, [selectedChat]);
    
    // Auto-refresh messages every 3 seconds when chat is open
    useEffect(() => {
        if (!selectedChat) return;
        
        const interval = setInterval(() => {
            refreshMessages();
        }, 3000);
        
        return () => clearInterval(interval);
    }, [selectedChat]);

    // Live update chat list every 1.5 seconds for online status
    useEffect(() => {
        const interval = setInterval(() => {
            refreshChatList();
        }, 1500);
        
        return () => clearInterval(interval);
    }, []);

    // Live update participant online status every 1.5 seconds when chat is open
    useEffect(() => {
        if (!selectedChat) return;
        
        const updateParticipantStatus = async () => {
            try {
                const response = await axios.get(`/api/chats/${selectedChat}`);
                if (response.data.participant) {
                    setCurrentParticipant(response.data.participant);
                }
            } catch (error) {
                console.error('Error updating participant status:', error);
            }
        };
        
        // Update immediately
        updateParticipantStatus();
        
        // Then update every 1.5 seconds
        const interval = setInterval(updateParticipantStatus, 1500);
        
        return () => clearInterval(interval);
    }, [selectedChat]);

    // Refresh media when filter changes
    useEffect(() => {
        if (showMediaGallery && selectedChat) {
            fetchMediaGallery();
        }
    }, [mediaFilter, showMediaGallery]);

    // Poll typing status every 2 seconds when chat is open
    useEffect(() => {
        if (!selectedChat) return;
        
        const checkTypingStatus = async () => {
            try {
                const response = await axios.get(`/api/chats/${selectedChat}/typing`);
                setIsOtherUserTyping(response.data.is_typing);
            } catch (error) {
                console.error('Error checking typing status:', error);
            }
        };
        
        // Check immediately
        checkTypingStatus();
        
        // Then check every 2 seconds
        const interval = setInterval(checkTypingStatus, 2000);
        
        return () => clearInterval(interval);
    }, [selectedChat]);

    // Cleanup preview URL on component unmount
    useEffect(() => {
        return () => {
            if (filePreviewUrl) {
                URL.revokeObjectURL(filePreviewUrl);
            }
        };
    }, [filePreviewUrl]);

    // Scroll when typing indicator appears/disappears
    useEffect(() => {
        if (isAtBottom) {
            scrollToBottom();
        }
    }, [isOtherUserTyping]);

    // Apply dark mode class to html element
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    // Save dark mode preference to localStorage
    useEffect(() => {
        localStorage.setItem('darkMode', darkMode.toString());
    }, [darkMode]);

    // Save chat theme to localStorage
    useEffect(() => {
        localStorage.setItem('chatTheme', chatTheme);
    }, [chatTheme]);

    // Persist other settings to localStorage
    useEffect(() => {
        localStorage.setItem('chatAnimations', String(chatAnimations));
    }, [chatAnimations]);

    useEffect(() => {
        localStorage.setItem('soundNotifications', String(soundNotifications));
    }, [soundNotifications]);

    useEffect(() => {
        localStorage.setItem('showTypingIndicator', String(showTypingIndicator));
    }, [showTypingIndicator]);

    // Save chat colors to localStorage
    useEffect(() => {
        localStorage.setItem('chatColors', JSON.stringify(chatColors));
    }, [chatColors]);

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
            
            // Scroll to bottom direct na loading zonder delay
            scrollToBottom();
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
            setChatsList(Array.isArray(response.data.chats) ? response.data.chats : []);
        } catch (error) {
            console.error('Error refreshing chat list:', error);
        }
    };

    const updateTypingStatus = async (isTyping: boolean) => {
        if (!selectedChat) return;
        
        try {
            await axios.post(`/api/chats/${selectedChat}/typing`, {
                is_typing: isTyping
            });
        } catch (error) {
            console.error('Error updating typing status:', error);
        }
    };

    const handleMessageInputChange = (value: string) => {
        setNewMessage(value);
        
        // Update typing status
        if (value.trim().length > 0) {
            // User is typing
            updateTypingStatus(true);
            
            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            
            // Set new timeout to stop typing after 3 seconds of inactivity
            typingTimeoutRef.current = setTimeout(() => {
                updateTypingStatus(false);
            }, 3000);
        } else {
            // User cleared the input
            updateTypingStatus(false);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
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
        
        if (!newMessage.trim() && !selectedFile) return;
        if (!selectedChat) return;

        const messageContent = newMessage.trim();
        const file = selectedFile;
        
        try {
            const formData = new FormData();
            // Always append message field, even if empty
            formData.append('message', messageContent);
            if (file) {
                formData.append('attachment', file);
                if (viewOnce) {
                    formData.append('view_once', '1');
                }
            }

            await axios.post(`/api/chats/${selectedChat}/messages`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setNewMessage('');
            setSelectedFile(null);
            setViewOnce(false);
            
            // Stop typing indicator
            updateTypingStatus(false);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            
            // Clean up preview URL
            if (filePreviewUrl) {
                URL.revokeObjectURL(filePreviewUrl);
                setFilePreviewUrl(null);
            }
            
            setForceInputKey(prev => prev + 1); // Force re-render to clear input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            await refreshMessages();
            await refreshChatList();
            // Direct scroll naar nieuw bericht zonder delay
            scrollToBottom();
        } catch (error: any) {
            console.error('Error sending message:', error);
            
            // Show user-friendly error message
            if (error.response?.status === 422) {
                alert('Vul een bericht of bijlage in om te verzenden.');
            } else if (error.response?.status === 403) {
                alert('Je bent niet geautoriseerd om berichten te verzenden in deze chat.');
            } else {
                alert('Er is een fout opgetreden bij het verzenden van je bericht. Probeer het opnieuw.');
            }
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
            const allUsers = Array.isArray(response.data.users) ? response.data.users : [];
            
            // Filter users based on query (client-side search)
            const filteredUsers = allUsers.filter((user: any) => 
                user.name.toLowerCase().includes(query.toLowerCase())
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
            
            if (response.data.chat_id) {
                await openChat(response.data.chat_id);
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

    const deleteMessageForMe = async (messageId: number) => {
        try {
            await axios.delete(`/api/messages/${messageId}/delete-for-me`);
            await refreshMessages();
            setShowDeleteConfirm(null);
            setShowDeleteMenu(null);
        } catch (error: any) {
            console.error('Error deleting message for me:', error);
            alert('Er is een fout opgetreden bij het verwijderen van het bericht.');
        }
    };

    const deleteMessageForEveryone = async (messageId: number) => {
        try {
            await axios.delete(`/api/messages/${messageId}/delete-for-everyone`);
            await refreshMessages();
            setShowDeleteConfirm(null);
            setShowDeleteMenu(null);
        } catch (error: any) {
            console.error('Error deleting message for everyone:', error);
            alert('Er is een fout opgetreden bij het verwijderen van het bericht.');
        }
    };

    const fetchMediaGallery = async () => {
        if (!selectedChat) return;

        setLoadingMedia(true);
        try {
            const response = await axios.get(`/chat/${selectedChat}/media`, {
                params: { type: mediaFilter }
            });
            
            setMediaItems(response.data.media || []);
        } catch (error) {
            console.error('Error fetching media:', error);
            setMediaItems([]);
        } finally {
            setLoadingMedia(false);
        }
    };

    const openMediaGallery = () => {
        setShowMediaGallery(true);
        fetchMediaGallery();
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

    const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            setPhotoUploadMsg('❌ Bestand is te groot. Maximum 5MB.');
            setTimeout(() => setPhotoUploadMsg(null), 3000);
            return;
        }
        setPhotoUploading(true);
        setPhotoUploadMsg('Uploaden...');
        const formData = new FormData();
        formData.append('photo', file);
        try {
            const res = await axios.post('/profile/photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setPhotoUploadMsg('✅ Foto geüpload!');
            // Update auth.user photo in local state by reloading
            window.location.reload();
        } catch (err: any) {
            setPhotoUploadMsg('❌ ' + (err.response?.data?.errors?.photo?.[0] || 'Upload mislukt'));
        } finally {
            setPhotoUploading(false);
            if (photoInputRef.current) photoInputRef.current.value = '';
            setTimeout(() => setPhotoUploadMsg(null), 3000);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            console.log('File selected:', file.name);
            console.log('File type:', file.type);
            console.log('File size:', file.size);
            
            // Validate file size (10MB limit)
            const maxSize = 10 * 1024 * 1024; // 10MB in bytes
            if (file.size > maxSize) {
                alert('Bestand is te groot. Maximum grootte is 10MB.');
                e.target.value = ''; // Clear the input
                return;
            }
            
            // Validate file type
            const allowedTypes = [
                'image/jpeg', 
                'image/jpg', 
                'image/png', 
                'image/gif', 
                'image/webp',
                'image/avif',
                'image/bmp',
                'image/svg+xml'
            ];
            if (!allowedTypes.includes(file.type)) {
                // Additional check for WebP files with incorrect MIME type
                const fileName = file.name.toLowerCase();
                const webpExtensions = ['.webp', '.avif'];
                const isWebpFile = webpExtensions.some(ext => fileName.endsWith(ext));
                
                if (!isWebpFile) {
                    console.log('File type rejected:', file.type);
                    alert('Bestandstype niet toegestaan. Alleen afbeeldingen zijn toegestaan (JPG, PNG, GIF, WebP, AVIF, BMP, SVG).');
                    e.target.value = ''; // Clear the input
                    return;
                } else {
                    console.log('WebP file detected by extension, allowing...');
                }
            }
            
            // Store the selected file and create preview URL
            setSelectedFile(file);
            
            // Create preview URL for image
            const previewUrl = URL.createObjectURL(file);
            console.log('Preview URL created:', previewUrl);
            setFilePreviewUrl(previewUrl);
            
            // Clear message text to focus on image
            setNewMessage('');
        } else {
            // File was cleared
            setSelectedFile(null);
            setFilePreviewUrl(null);
        }
    };

    // Get background theme classes based on chatTheme
    const getBackgroundTheme = () => {
        const themes: Record<string, string> = {
            default: 'bg-gradient-to-br from-blue-200 via-purple-200 to-pink-200',
            dark:    'bg-gradient-to-br from-gray-800 via-gray-900 to-black',
            nature:  'bg-gradient-to-br from-green-200 via-emerald-200 to-teal-200',
            sunset:  'bg-gradient-to-br from-orange-200 via-red-200 to-pink-200',
            ocean:   'bg-gradient-to-br from-blue-200 via-cyan-200 to-teal-200',
            lavender:'bg-gradient-to-br from-purple-200 via-violet-200 to-indigo-200',
        };
        return themes[chatTheme] || themes.default;
    };

    return (
        <>
            <div className={`h-dvh overflow-hidden ${getBackgroundTheme()} transition-colors duration-200`}>
                {/* Modern Fixed Glass Sidebar */}
                <div className={`${
                    isMobile 
                        ? (selectedChat ? 'hidden' : 'fixed inset-y-0 left-0 w-full z-30') 
                        : 'fixed inset-y-0 left-0 w-80 z-30'
                    } backdrop-blur-xl bg-white/30 dark:bg-gray-900/90 border-r border-white/20 dark:border-gray-700 shadow-2xl flex flex-col transition-colors duration-200`}>
                    
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
                                    <h1 className="text-lg font-bold text-white">
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
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-gray-900"></div>
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-gray-800 dark:text-white">{auth.user.name}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-300">Profiel bekijken</p>
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
                                    className={`relative p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors group ${
                                        selectedChat === chat.id 
                                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700' 
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
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
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white dark:border-gray-800"></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{chat.participant.name}</h3>
                                                {chat.latest_message && (
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                                                        {new Date(chat.latest_message.created_at).toLocaleDateString('nl-NL', {
                                                            day: 'numeric',
                                                            month: 'short'
                                                        })}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                                {chat.latest_message ? (
                                                    chat.latest_message.attachment_url ? 
                                                        `📎 ${chat.latest_message.attachment_type === 'image' ? 'Afbeelding' : 'Bestand'}` 
                                                        : chat.latest_message.message
                                                ) : (
                                                    <span className="text-gray-400 dark:text-gray-500 italic">Nog geen berichten</span>
                                                )}
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
                    } flex flex-col backdrop-blur-xl bg-white/5 h-[100dvh]`}>
                    {/* Header */}
                    {selectedChat && currentParticipant ? (
                        <>
                            <div className={`bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex items-center gap-3 sm:gap-4 shadow-sm ${
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
                                    className="flex items-center gap-3 sm:gap-4 flex-1 hover:bg-gray-50 dark:hover:bg-gray-800 p-2 -m-2 rounded-lg transition"
                                >
                                    <div className="relative">
                                        <Avatar
                                            photoUrl={currentParticipant.profile_photo_url}
                                            name={currentParticipant.name}
                                            size="md"
                                        />
                                        {currentParticipant.is_online && (
                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white dark:border-gray-900"></div>
                                        )}
                                    </div>
                                    <div className="text-left min-w-0 flex-1">
                                        <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base sm:text-lg truncate">{currentParticipant.name}</h2>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {currentParticipant.is_online ? '🟢 Online' : '⚪ Offline'}
                                        </p>
                                    </div>
                                </button>

                                {/* Header actions */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={openMediaGallery}
                                        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                                        title="Media gallerij"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </button>
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
                            <div 
                                ref={messagesContainerRef}
                                className="overflow-y-auto relative flex-1 min-h-0"
                            >
                                {loadingMessages ? (
                                    <div className="flex items-center justify-center h-32">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                    </div>
                                ) : (
                                    <div className="p-3 sm:p-4 space-y-4">
                                        {messages.map((message, index) => (
                                            <div key={message.id} className="group">
                                                <div className={`flex ${message.is_mine ? 'justify-end' : 'justify-start'} mb-2`}>
                                                    <div className={`flex flex-col ${message.is_mine ? 'items-end' : 'items-start'} max-w-xs lg:max-w-md`}>
                                                        <div 
                                                            className={`px-4 py-2 rounded-2xl ${
                                                                message.is_mine 
                                                                    ? 'text-white' 
                                                                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 shadow-sm'
                                                            }`}
                                                            style={message.is_mine ? {
                                                                background: `linear-gradient(135deg, ${chatColors.primary}, ${chatColors.secondary})`
                                                            } : undefined}
                                                        >
                                                            {message.view_once ? (
                                                                <div className="mb-2">
                                                                    {message.is_mine ? (
                                                                        // Sender: status of whether recipient has seen it
                                                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg min-w-[160px] ${
                                                                            message.view_once_viewed
                                                                                ? 'bg-white/15'
                                                                                : 'bg-white/20'
                                                                        }`}>
                                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                                                message.view_once_viewed ? 'bg-white/30' : 'bg-white/20'
                                                                            }`}>
                                                                                {message.view_once_viewed ? (
                                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                                    </svg>
                                                                                ) : (
                                                                                    <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                                                    </svg>
                                                                                )}
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs font-semibold leading-tight">
                                                                                    {message.view_once_viewed ? 'Gezien 👁' : 'Eenmalige foto'}
                                                                                </p>
                                                                                <p className="text-xs opacity-70 leading-tight">
                                                                                    {message.view_once_viewed ? 'Ontvanger heeft bekeken' : 'Nog niet bekeken'}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    ) : message.view_once_viewed ? (
                                                                        // Receiver already viewed
                                                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                                                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                            <span className="text-sm">Foto al bekeken</span>
                                                                        </div>
                                                                    ) : (
                                                                        // Receiver can tap to view
                                                                        <button
                                                                            onClick={async () => {
                                                                                try {
                                                                                    const res = await axios.post(`/api/messages/${message.id}/view-once`);
                                                                                    setFullscreenImage(res.data.url);
                                                                                    setMessages(prev => prev.map(m =>
                                                                                        m.id === message.id ? { ...m, view_once_viewed: true } : m
                                                                                    ));
                                                                                } catch {
                                                                                    setMessages(prev => prev.map(m =>
                                                                                        m.id === message.id ? { ...m, view_once_viewed: true } : m
                                                                                    ));
                                                                                }
                                                                            }}
                                                                            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors w-full"
                                                                        >
                                                                            <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Tik om te bekijken</span>
                                                                            <span className="ml-auto text-xs text-blue-400 bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded font-bold">1x</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : message.attachment_url ? (
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
                                                        
                                                        {/* Hover opties - nu correct gepositioneerd */}
                                                        <div className={`flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                                                            message.is_mine ? 'flex-row-reverse' : 'flex-row'
                                                        }`}>
                                                            <button
                                                                onClick={() => setShowEmojiPickerForMessage(message.id)}
                                                                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition flex items-center gap-1"
                                                            >
                                                                <span>😊</span>
                                                                <span>Reactie</span>
                                                            </button>
                                                            <div className="relative delete-menu-container">
                                                                <button
                                                                    onClick={() => setShowDeleteMenu(showDeleteMenu === message.id ? null : message.id)}
                                                                    className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition flex items-center gap-1"
                                                                >
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                    <span>Verwijder</span>
                                                                </button>
                                                                {showDeleteMenu === message.id && (
                                                                    <div className={`absolute bottom-full mb-2 bg-white rounded-lg shadow-2xl border border-gray-200 py-2 z-50 min-w-[200px] ${
                                                                        message.is_mine ? 'right-0' : 'left-0'
                                                                    }`}>
                                                                        <button
                                                                            onClick={() => setShowDeleteConfirm({messageId: message.id, type: 'me'})}
                                                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition flex items-center gap-2"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 17M9.878 9.878l-3-3m12.121 12.121L21 21" />
                                                                            </svg>
                                                                            Verwijder voor mezelf
                                                                        </button>
                                                                        {message.is_mine && (
                                                                            <button
                                                                                onClick={() => setShowDeleteConfirm({messageId: message.id, type: 'everyone'})}
                                                                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2"
                                                                            >
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                                </svg>
                                                                                Verwijder voor iedereen
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Emoji picker - nu correct gepositioneerd */}
                                                {showEmojiPickerForMessage === message.id && (
                                                    <div className={`flex ${message.is_mine ? 'justify-end' : 'justify-start'} mb-2`}>
                                                        <div className="relative">
                                                            <div className={`absolute top-0 transform -translate-y-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 z-50 w-80 ${
                                                                message.is_mine ? 'right-0' : 'left-0'
                                                            }`}>
                                                                <div className="flex flex-col gap-3">
                                                                    <div className="flex gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-2">
                                                                        <span>😀 Emoties</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto">
                                                                        {['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '🥰', '😘', '😗', '😙', '😚', '🙂', '🤗', '🤩', '🤔', '🫡', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🫠', '🤑', '😲', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩', '🤯', '😬', '😮‍💨', '😵', '😵‍💫', '🥴', '😠', '😡', '🤬', '🤕', '😷', '🤒', '🤮', '🤧', '🥵', '🥶', '🥳', '🥺', '🦄', '🎉', '🎊', '🔥', '💯', '💖', '💝', '💘', '💕', '💗', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💟', '♥️', '💌', '💤', '💢', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💫', '💦', '💨', '🕳️', '💣', '💥', '💢', '💫', '💦', '💨', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏'].map(emoji => (
                                                                            <button 
                                                                                key={emoji}
                                                                                onClick={() => handleEmojiSelect(emoji)}
                                                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-lg flex items-center justify-center"
                                                                            >
                                                                                {emoji}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                    <button
                                                                        onClick={() => setShowEmojiPickerForMessage(null)}
                                                                        className="mt-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                                                                    >
                                                                        Sluiten
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        
                                        {/* Typing indicator */}
                                        {isOtherUserTyping && currentParticipant && (
                                            <div className="flex items-start space-x-2 mb-4 animate-fade-in">
                                                <Avatar 
                                                    photoUrl={currentParticipant.profile_photo_url}
                                                    name={currentParticipant.name}
                                                    size="sm" 
                                                />
                                                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2 max-w-[70%]">
                                                    <div className="flex items-center space-x-1">
                                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                                
                                {/* Scroll to bottom button */}
                                {!isAtBottom && (
                                    <button
                                        onClick={scrollToBottom}
                                        className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 z-10"
                                        title="Ga naar nieuwste berichten"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* Input area */}
                            <div className={`border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4 shrink-0 ${
                                isMobile ? 'sticky bottom-0 z-20' : ''
                            }`}>
                                <form onSubmit={sendMessage} className="space-y-3">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <input 
                                            type="file" 
                                            ref={fileInputRef}
                                            onChange={handleFileSelect}
                                            className="hidden"
                                            accept="image/*,.webp,.avif,.bmp,.svg"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition z-10"
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
                                                
                                                {/* File preview indicator */}
                                                {selectedFile && (
                                                    <div className="absolute bottom-full left-0 mb-2 z-10">
                                                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 shadow-lg flex items-center gap-2">
                                                            {filePreviewUrl && (
                                                                <img src={filePreviewUrl} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                                                            )}
                                                            <span className="text-sm text-gray-700 dark:text-gray-200 max-w-[120px] truncate">{selectedFile.name}</span>
                                                            {viewOnce && (
                                                                <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-semibold">1x</span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedFile(null);
                                                                    if (filePreviewUrl) {
                                                                        URL.revokeObjectURL(filePreviewUrl);
                                                                        setFilePreviewUrl(null);
                                                                    }
                                                                    setViewOnce(false);
                                                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                                                }}
                                                                className="text-gray-400 hover:text-red-500 transition-colors ml-1"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                <textarea
                                                    key={forceInputKey}
                                                    value={newMessage}
                                                    onChange={(e) => handleMessageInputChange(e.target.value)}
                                                    onKeyPress={handleKeyPress}
                                                    placeholder="Typ een bericht..."
                                                    className="w-full pl-12 pr-12 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors duration-200"
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
                                                            ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer' 
                                                            : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
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
                        <div className="flex-1 flex items-center justify-center bg-transparent">
                            <div className="text-center max-w-md mx-auto p-8">
                                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center">
                                    <svg 
                                        className="w-12 h-12 text-gray-400 dark:text-gray-500" 
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
                                                        onClick={() => createChat(user.id)}
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
                        className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[100]"
                        onClick={() => setFullscreenImage(null)}
                    >
                        <button
                            onClick={() => setFullscreenImage(null)}
                            className="absolute top-4 right-4 text-white hover:text-gray-300 transition z-10"
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

                {/* Send Image Modal */}
                {selectedFile && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Foto verzenden</h3>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedFile(null);
                                        if (filePreviewUrl) { URL.revokeObjectURL(filePreviewUrl); setFilePreviewUrl(null); }
                                        setViewOnce(false);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            {/* Image preview */}
                            <div className="relative bg-gray-50 dark:bg-gray-800 flex items-center justify-center" style={{ minHeight: 200 }}>
                                {filePreviewUrl ? (
                                    <img
                                        src={filePreviewUrl}
                                        alt="Preview"
                                        className="max-h-64 w-full object-contain"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
                                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span className="text-sm">{selectedFile.name}</span>
                                    </div>
                                )}
                            </div>

                            {/* Body */}
                            <div className="px-5 py-4 space-y-4">
                                {/* View-once toggle */}
                                <button
                                    type="button"
                                    onClick={() => setViewOnce(v => !v)}
                                    className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border-2 transition-all duration-200 ${
                                        viewOnce
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                                >
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                                        viewOnce ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-700'
                                    }`}>
                                        <svg className={`w-6 h-6 ${viewOnce ? 'text-white' : 'text-gray-500 dark:text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className={`font-semibold text-sm ${viewOnce ? 'text-purple-700 dark:text-purple-300' : 'text-gray-800 dark:text-gray-100'}`}>
                                            Eenmalig bekijken
                                        </p>
                                        <p className={`text-xs mt-0.5 ${viewOnce ? 'text-purple-500 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                            {viewOnce ? 'Ontvanger kan deze foto maar 1 keer zien' : 'Ontvanger kan de foto altijd opnieuw bekijken'}
                                        </p>
                                    </div>
                                    {/* Toggle pill */}
                                    <div className={`w-12 h-6 rounded-full relative transition-colors duration-200 flex-shrink-0 ${viewOnce ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${viewOnce ? 'left-6' : 'left-0.5'}`} />
                                    </div>
                                </button>

                                {/* Caption input */}
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Bijschrift toevoegen..."
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-600"
                                />
                            </div>

                            {/* Footer */}
                            <div className="px-5 pb-5 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedFile(null);
                                        if (filePreviewUrl) { URL.revokeObjectURL(filePreviewUrl); setFilePreviewUrl(null); }
                                        setViewOnce(false);
                                        setNewMessage('');
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                    className="flex-1 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
                                >
                                    Annuleren
                                </button>
                                <button
                                    type="button"
                                    onClick={() => sendMessage()}
                                    className={`flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-colors flex items-center justify-center gap-2 ${
                                        viewOnce
                                            ? 'bg-purple-600 hover:bg-purple-700'
                                            : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                    Versturen
                                </button>
                            </div>
                        </div>
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
                                            <span className="text-sm text-gray-500">Lid sinds:</span>
                                            <p className="font-medium">
                                                {profileUser.created_at
                                                    ? new Date(profileUser.created_at).toLocaleDateString('nl-NL', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })
                                                    : 'Onbekend'}
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
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
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
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        Profiel
                                    </h3>
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                                        {/* Photo row */}
                                        <div className="flex items-center gap-4">
                                            <div className="relative flex-shrink-0">
                                                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                                    {auth.user.profile_photo_url ? (
                                                        <img src={auth.user.profile_photo_url} alt="Profielfoto" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-white text-2xl font-bold">{auth.user.name.charAt(0).toUpperCase()}</span>
                                                    )}
                                                </div>
                                                {photoUploading && (
                                                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{auth.user.name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{auth.user.email}</p>
                                                {photoUploadMsg && (
                                                    <p className="text-xs mt-1 text-gray-600 dark:text-gray-300">{photoUploadMsg}</p>
                                                )}
                                            </div>
                                            <input
                                                ref={photoInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleProfilePhotoUpload}
                                            />
                                            <button
                                                onClick={() => photoInputRef.current?.click()}
                                                disabled={photoUploading}
                                                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                Foto
                                            </button>
                                        </div>

                                        {/* Divider */}
                                        <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

                                        {/* Password row */}
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Wachtwoord</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Wijzig je inlogwachtwoord</p>
                                            </div>
                                            <button
                                                onClick={() => { setShowSettingsModal(false); window.location.href = '/profile'; }}
                                                className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-xl text-sm font-medium transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                </svg>
                                                Wijzigen
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Chat Theme */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h4a2 2 0 002-2V9a2 2 0 00-2-2H7a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                        </svg>
                                        Chat kleuren
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Kleurenschema</label>
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
                                                        }}
                                                        className={`p-3 rounded-lg border-2 transition-all ${
                                                            chatColors.primary === theme.colors[0] ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
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
                                                { name: 'Standaard', preview: 'bg-gradient-to-br from-blue-200 via-purple-200 to-pink-200', id: 'default' },
                                                { name: 'Donker', preview: 'bg-gradient-to-br from-gray-800 via-gray-900 to-black', id: 'dark' },
                                                { name: 'Natuur', preview: 'bg-gradient-to-br from-green-200 via-emerald-200 to-teal-200', id: 'nature' },
                                                { name: 'Zonsondergang', preview: 'bg-gradient-to-br from-orange-200 via-red-200 to-pink-200', id: 'sunset' },
                                                { name: 'Oceaan', preview: 'bg-gradient-to-br from-blue-200 via-cyan-200 to-teal-200', id: 'ocean' },
                                                { name: 'Lavendel', preview: 'bg-gradient-to-br from-purple-200 via-violet-200 to-indigo-200', id: 'lavender' }
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
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Extra features
                                    </h3>
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Donkere modus</span>
                                            <input 
                                                type="checkbox" 
                                                className="rounded" 
                                                checked={darkMode}
                                                onChange={(e) => setDarkMode(e.target.checked)}
                                            />
                                        </label>
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Chat animaties</span>
                                            <input 
                                                type="checkbox" 
                                                className="rounded" 
                                                checked={chatAnimations}
                                                onChange={(e) => setChatAnimations(e.target.checked)}
                                            />
                                        </label>
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Geluidsmeldingen</span>
                                            <input 
                                                type="checkbox" 
                                                className="rounded" 
                                                checked={soundNotifications}
                                                onChange={(e) => setSoundNotifications(e.target.checked)}
                                            />
                                        </label>
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Typing indicator</span>
                                            <input 
                                                type="checkbox" 
                                                className="rounded" 
                                                checked={showTypingIndicator}
                                                onChange={(e) => setShowTypingIndicator(e.target.checked)}
                                            />
                                        </label>
                                    </div>
                                </div>

                                {/* Download Android App */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        Android App
                                    </h3>
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Download de app</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Gebruik Chattery op je Android telefoon</p>
                                        </div>
                                        <a
                                            href="/downloads/chattery.apk"
                                            download
                                            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-md"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            Download APK
                                        </a>
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

                {/* Media Gallery Modal */}
                {showMediaGallery && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Gallery Header */}
                            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-4 sm:p-6 relative flex-shrink-0">
                                <button
                                    onClick={() => {
                                        setShowMediaGallery(false);
                                        setMediaFilter('all');
                                        setMediaItems([]);
                                    }}
                                    className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                                
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold">Media gallerij</h2>
                                        <p className="text-white/80">
                                            {currentParticipant?.name && `Gedeelde media met ${currentParticipant.name}`}
                                        </p>
                                    </div>
                                </div>

                                {/* Filter tabs */}
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => setMediaFilter('all')}
                                        className={`px-4 py-2 rounded-lg font-medium transition ${
                                            mediaFilter === 'all' 
                                                ? 'bg-white text-purple-600' 
                                                : 'bg-white/10 text-white hover:bg-white/20'
                                        }`}
                                    >
                                        Alles
                                    </button>
                                    <button
                                        onClick={() => setMediaFilter('images')}
                                        className={`px-4 py-2 rounded-lg font-medium transition ${
                                            mediaFilter === 'images' 
                                                ? 'bg-white text-purple-600' 
                                                : 'bg-white/10 text-white hover:bg-white/20'
                                        }`}
                                    >
                                        📷 Foto's
                                    </button>
                                    <button
                                        onClick={() => setMediaFilter('files')}
                                        className={`px-4 py-2 rounded-lg font-medium transition ${
                                            mediaFilter === 'files' 
                                                ? 'bg-white text-purple-600' 
                                                : 'bg-white/10 text-white hover:bg-white/20'
                                        }`}
                                    >
                                        📁 Bestanden
                                    </button>
                                </div>
                            </div>

                            {/* Gallery Content */}
                            <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
                                {loadingMedia ? (
                                    <div className="flex items-center justify-center h-64">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                    </div>
                                ) : mediaItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                        <svg className="w-20 h-20 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <p className="text-lg font-medium">Geen media gevonden</p>
                                        <p className="text-sm">
                                            {mediaFilter === 'images' && 'Er zijn nog geen foto\'s gedeeld in dit gesprek'}
                                            {mediaFilter === 'files' && 'Er zijn nog geen bestanden gedeeld in dit gesprek'}
                                            {mediaFilter === 'all' && 'Er is nog geen media gedeeld in dit gesprek'}
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-sm text-gray-600 mb-4">
                                            {mediaItems.length} {mediaItems.length === 1 ? 'item' : 'items'} gevonden
                                        </p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {mediaItems.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="group relative bg-gray-100 rounded-lg overflow-hidden aspect-square cursor-pointer hover:ring-2 hover:ring-blue-500 transition"
                                                    onClick={() => {
                                                        if (item.type === 'image') {
                                                            setFullscreenImage(item.url);
                                                        } else {
                                                            window.open(item.url, '_blank');
                                                        }
                                                    }}
                                                >
                                                    {item.type === 'image' ? (
                                                        <img
                                                            src={item.url}
                                                            alt="Media"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-gray-200">
                                                            <svg className="w-12 h-12 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                            </svg>
                                                            <p className="text-xs text-gray-600 text-center font-medium truncate w-full">
                                                                Bestand
                                                            </p>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Overlay with info */}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                                                        <p className="text-white text-xs font-medium truncate">
                                                            {item.user.name}
                                                        </p>
                                                        <p className="text-white/70 text-xs">
                                                            {item.created_at}
                                                        </p>
                                                        {item.message && (
                                                            <p className="text-white/90 text-xs mt-1 line-clamp-2">
                                                                {item.message}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Message Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {showDeleteConfirm.type === 'everyone' ? 'Bericht voor iedereen verwijderen?' : 'Bericht voor mezelf verwijderen?'}
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            {showDeleteConfirm.type === 'everyone' 
                                                ? 'Dit bericht wordt voor alle gespreksdeelnemers verwijderd.' 
                                                : 'Dit bericht wordt alleen voor jou verborgen.'
                                            }
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setShowDeleteConfirm(null);
                                            setShowDeleteMenu(null);
                                        }}
                                        className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition"
                                    >
                                        Annuleren
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (showDeleteConfirm.type === 'everyone') {
                                                deleteMessageForEveryone(showDeleteConfirm.messageId);
                                            } else {
                                                deleteMessageForMe(showDeleteConfirm.messageId);
                                            }
                                        }}
                                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition"
                                    >
                                        {showDeleteConfirm.type === 'everyone' ? 'Verwijder voor iedereen' : 'Verwijder voor mezelf'}
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