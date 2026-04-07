import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
    isInstallable: boolean;
    isInstalled: boolean;
    wasPromptShownBefore: boolean;
    lastPromptTime: number;
}

export default function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [pwaState, setPwaState] = useState<PWAState>({
        isInstallable: false,
        isInstalled: false,
        wasPromptShownBefore: false,
        lastPromptTime: 0
    });

    useEffect(() => {
        // Check if app is already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
            || (window.navigator as any).standalone 
            || document.referrer.includes('android-app://');

        // Load preferences from localStorage
        const savedState = localStorage.getItem('pwa-install-state');
        const state = savedState ? JSON.parse(savedState) : pwaState;
        
        setPwaState(prev => ({ ...prev, isInstalled: isStandalone, ...state }));

        // Don't show prompt if already installed or recently dismissed
        if (isStandalone) return;

        const handler = (e: Event) => {
            e.preventDefault();
            
            // Don't show if dismissed recently (within 7 days)
            const daysSinceLastPrompt = (Date.now() - state.lastPromptTime) / (1000 * 60 * 60 * 24);
            if (state.wasPromptShownBefore && daysSinceLastPrompt < 7) {
                return;
            }
            
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            
            // Show after a short delay to not interrupt user flow
            setTimeout(() => {
                setShowInstallPrompt(true);
                setPwaState(prev => ({ 
                    ...prev, 
                    isInstallable: true,
                    wasPromptShownBefore: true,
                    lastPromptTime: Date.now()
                }));
            }, 3000);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Listen for successful installation
        window.addEventListener('appinstalled', () => {
            setPwaState(prev => ({ ...prev, isInstalled: true }));
            setShowInstallPrompt(false);
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', () => {});
        };
    }, []);

    // Save state to localStorage when it changes
    useEffect(() => {
        if (pwaState.wasPromptShownBefore) {
            localStorage.setItem('pwa-install-state', JSON.stringify(pwaState));
        }
    }, [pwaState]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('User accepted PWA install');
                setPwaState(prev => ({ ...prev, isInstalled: true }));
            }
        } catch (error) {
            console.error('Install prompt failed:', error);
        }
        
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
    };

    const handleDismiss = () => {
        setShowInstallPrompt(false);
        setPwaState(prev => ({ 
            ...prev, 
            lastPromptTime: Date.now() 
        }));
    };

    // Don't show if installed or not installable
    if (!showInstallPrompt || pwaState.isInstalled) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border-2 border-blue-500 rounded-xl shadow-2xl p-4 z-50 animate-slide-up">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                    </div>
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">📱 Installeer Chattery</h3>
                    <p className="text-sm text-gray-600 mb-3">
                        Voeg toe aan je startscherm voor snellere toegang, offline ondersteuning en een app-achtige ervaring!
                    </p>
                    <div className="flex gap-2 mb-2">
                        <div className="flex items-center text-xs text-blue-600">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Offline toegang
                        </div>
                        <div className="flex items-center text-xs text-purple-600">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                            Geen browser UI
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleInstall}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-all transform hover:scale-105"
                        >
                            🚀 Installeren
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                        >
                            Later
                        </button>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
