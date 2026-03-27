export interface User {
    id: number;
    name: string;
    email: string;
}

export interface Chat {
    id: number;
    participant: User;
    latest_message: {
        message: string;
        created_at: string;
        is_mine: boolean;
    } | null;
    unread_count: number;
}

export interface Message {
    id: number;
    message: string;
    is_mine: boolean;
    created_at: string;
    user: {
        name: string;
    };
}

export interface ChatPageProps {
    chats: Chat[];
    users: User[];
    auth: {
        user: User;
    };
}
