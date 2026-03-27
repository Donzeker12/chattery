export type User = {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    profile_photo_url?: string | null;
    is_admin?: boolean;
    is_online?: boolean;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
};

export type Auth = {
    user: User;
};
