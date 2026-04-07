// Simple test `
import { Head } from '@inertiajs/react';

export default function TestIndex() {
    const test = true;
    
    return (
        <>
            <Head title="Test" />
            <div>
                {test && (
                    <span>Test content</span>
                )}
            </div>
        </>
    );
}