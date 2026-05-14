import { useState, useRef, useEffect } from 'react';
import { router } from '@inertiajs/react';
import axios from '@/lib/axios';

interface ProfilePhotoUploadProps {
    currentPhotoUrl?: string | null;
    onPhotoUpdate?: (newPhotoUrl: string | null) => void;
}

export default function ProfilePhotoUpload({ currentPhotoUrl, onPhotoUpdate }: ProfilePhotoUploadProps) {
    const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhotoUrl || null);
    const [isUploading, setIsUploading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [uploadMessage, setUploadMessage] = useState<string | null>(null);
    const [imageKey, setImageKey] = useState(Date.now()); // Force rerender
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setUploadMessage('❌ Bestand is te groot. Maximum 5MB toegestaan.');
            setTimeout(() => setUploadMessage(null), 3000);
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setUploadMessage('❌ Alleen afbeeldingen zijn toegestaan.');
            setTimeout(() => setUploadMessage(null), 3000);
            return;
        }

        setIsUploading(true);
        setShowMenu(false);
        setUploadMessage('⏳ Foto uploaden...');
        
        const formData = new FormData();
        formData.append('photo', file);

        try {
            const response = await axios.post('/profile/photo', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            console.log('Upload response:', response.data);
            
            const newPhotoUrl = response.data.photo_url;
            setPhotoUrl(newPhotoUrl);
            setImageKey(Date.now()); // Force image reload
            
            if (onPhotoUpdate) {
                onPhotoUpdate(newPhotoUrl);
            }
            setUploadMessage('✅ Foto succesvol geüpload!');
            
            // Reload Inertia shared props to update auth.user everywhere
            setTimeout(() => {
                router.reload({ only: [] }); // Reload shared props
            }, 500);
        } catch (error: any) {
            console.error('Error uploading photo:', error);
            console.error('Error response:', error.response);
            const errorMsg = error.response?.data?.message || error.response?.data?.errors?.photo?.[0] || 'Fout bij uploaden van foto';
            setUploadMessage('❌ ' + errorMsg);
            setTimeout(() => setUploadMessage(null), 5000);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDeletePhoto = async () => {
        if (!confirm('Weet je zeker dat je je profielfoto wilt verwijderen?')) {
            return;
        }

        setIsUploading(true);
        setShowMenu(false);
        setUploadMessage('⏳ Foto verwijderen...');
        
        try {
            const response = await axios.delete('/profile/photo');
            setPhotoUrl(null);
            setImageKey(Date.now()); // Force rerender
            
            if (onPhotoUpdate) {
                onPhotoUpdate(null);
            }
            setUploadMessage('✅ Foto verwijderd');
            
            // Reload Inertia shared props to update auth.user everywhere
            setTimeout(() => {
                router.reload({ only: [] }); // Reload shared props
            }, 500);
        } catch (error: any) {
            console.error('Error deleting photo:', error);
            setUploadMessage('❌ ' + (error.response?.data?.message || 'Fout bij verwijderen van foto'));
            setTimeout(() => setUploadMessage(null), 5000);
        } finally {
            setIsUploading(false);
        }
    };

    const handleAvatarClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log('Avatar clicked, isUploading:', isUploading, 'showMenu:', showMenu);
        if (!isUploading) {
            setShowMenu(!showMenu);
        }
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            if (showMenu) {
                console.log('Closing menu from outside click');
                setShowMenu(false);
            }
        };

        if (showMenu) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showMenu]);

    return (
        <div className="relative w-full">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            <div className="relative group flex justify-center md:justify-start">
                <button
                    onClick={handleAvatarClick}
                    disabled={isUploading}
                    className="w-32 h-32 md:w-24 md:h-24 rounded-full flex items-center justify-center text-white text-4xl md:text-3xl font-bold cursor-pointer transition-all border-4 border-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed relative bg-gradient-to-br from-indigo-600 to-purple-600 overflow-hidden hover:brightness-75"
                >
                    {photoUrl ? (
                        <img 
                            key={imageKey}
                            src={`${photoUrl}?t=${imageKey}`}
                            alt="Profielfoto"
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => {
                                console.error('Image failed to load:', photoUrl);
                                e.currentTarget.style.display = 'none';
                            }}
                            onLoad={() => {
                                console.log('Image loaded successfully:', photoUrl);
                            }}
                        />
                    ) : (
                        <span className="relative z-10">👤</span>
                    )}
                    
                    {/* Hover edit icon - inside button */}
                    {!isUploading && photoUrl && (
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-2xl z-20 pointer-events-none">
                            ✏️
                        </span>
                    )}
                </button>

                {/* Loading overlay */}
                {isUploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center z-30">
                        <div className="animate-spin text-white text-2xl">⏳</div>
                    </div>
                )}
            </div>

            {/* Menu */}
            {showMenu && !isUploading && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            console.log('Upload button clicked');
                            setShowMenu(false);
                            fileInputRef.current?.click();
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors text-sm flex items-center gap-2"
                    >
                        <span>📷</span>
                        <span>{photoUrl ? 'Foto wijzigen' : 'Foto uploaden'}</span>
                    </button>
                    {photoUrl && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                console.log('Delete button clicked');
                                handleDeletePhoto();
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors text-sm text-red-600 flex items-center gap-2"
                        >
                            <span>🗑️</span>
                            <span>Foto verwijderen</span>
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            console.log('Cancel button clicked');
                            setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors text-sm text-gray-600 flex items-center gap-2 border-t border-gray-200"
                    >
                        <span>❌</span>
                        <span>Annuleren</span>
                    </button>
                </div>
            )}

            {/* Upload message */}
            {uploadMessage && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap z-50 transition-all duration-300">
                    {uploadMessage}
                </div>
            )}
        </div>
    );
}
