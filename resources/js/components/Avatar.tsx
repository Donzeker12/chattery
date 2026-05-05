interface AvatarProps {
    photoUrl?: string | null;
    name?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    isOnline?: boolean;
    className?: string;
}

export default function Avatar({ photoUrl, name = 'User', size = 'md', isOnline, className = '' }: AvatarProps) {
    const sizeClasses = {
        sm: 'w-8 h-8 text-sm',
        md: 'w-10 h-10 text-base',
        lg: 'w-16 h-16 text-2xl',
        xl: 'w-24 h-24 text-4xl',
    };

    const onlineIndicatorSizes = {
        sm: 'w-2 h-2',
        md: 'w-3 h-3',
        lg: 'w-4 h-4',
        xl: 'w-5 h-5',
    };

    // Get initials from name
    const getInitials = (name: string) => {
        if (!name || typeof name !== 'string') return '?';
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Generate a consistent color based on the name
    const getColorFromName = (name: string) => {
        if (!name || typeof name !== 'string') return 'bg-gray-500';
        const colors = [
            'bg-red-500',
            'bg-blue-500',
            'bg-green-500',
            'bg-yellow-500',
            'bg-purple-500',
            'bg-pink-500',
            'bg-indigo-500',
            'bg-teal-500',
        ];
        const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[index % colors.length];
    };

    return (
        <div className={`relative inline-block ${className}`}>
            <div
                className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-semibold overflow-hidden ${
                    photoUrl ? 'bg-gray-200' : getColorFromName(name)
                }`}
            >
                {photoUrl ? (
                    <img
                        src={photoUrl}
                        alt={name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span>{getInitials(name)}</span>
                )}
            </div>

            {/* Online indicator */}
            {isOnline !== undefined && (
                <div
                    className={`absolute bottom-0 right-0 ${onlineIndicatorSizes[size]} rounded-full border-2 border-white ${
                        isOnline ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                    title={isOnline ? 'Online' : 'Offline'}
                />
            )}
        </div>
    );
}
