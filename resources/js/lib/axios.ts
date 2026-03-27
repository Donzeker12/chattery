import axios from 'axios';

// Configure axios defaults
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
axios.defaults.withCredentials = true;

// Function to get fresh CSRF token
const getCsrfToken = (): string | null => {
    const token = document.head.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    return token ? token.content : null;
};

// Add request interceptor to always include fresh CSRF token
axios.interceptors.request.use(
    (config) => {
        const token = getCsrfToken();
        if (token) {
            config.headers['X-CSRF-TOKEN'] = token;
        } else {
            console.error('CSRF token not found');
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor to handle 419 errors
axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 419) {
            // CSRF token mismatch - reload the page to get a fresh token
            console.error('CSRF token mismatch. Reloading page...');
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

export default axios;
