import React, { useEffect, useState } from 'react';
import { PaymentForm } from '../components/PaymentForm';
import type { LinkResponse } from '../lib/api/client';
import { ShieldAlert, Loader2 } from 'lucide-react';

export const PaymentLink: React.FC = () => {
    const [slug, setSlug] = useState('');
    const [linkData, setLinkData] = useState<LinkResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Extract slug from URL: /link/jaan
        const pathParts = window.location.pathname.split('/');
        const urlSlug = pathParts[pathParts.length - 1];
        setSlug(urlSlug);

        const fetchLink = async () => {
            try {
                // Simulation for now since no backend
                const mockData: LinkResponse = {
                    id: '1',
                    slug: urlSlug,
                    metaAddress: {
                        spendingPublicKey: '025a6e7c7a0d4c6d6d8a4d7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c',
                        viewingPublicKey: '03a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1'
                    }
                };
                setLinkData(mockData);
            } catch (err) {
                setError('Payment link not found or invalid.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchLink();
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (error || !linkData) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center bg-white p-10 rounded-3xl shadow-xl border border-red-50">
                    <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h2>
                    <p className="text-gray-500 mb-8">{error || 'This payment link does not exist.'}</p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all"
                    >
                        Back to ZeroLink
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-20 px-6">
            <div className="max-w-7xl mx-auto mb-10 text-center">
                <div className="inline-flex items-center gap-2 text-indigo-600 font-bold tracking-tight mb-4 group cursor-pointer" onClick={() => window.location.href = '/'}>
                    <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">ZL</div>
                    ZeroLink Protocol
                </div>
            </div>

            <PaymentForm recipientSlug={slug} recipientMeta={linkData.metaAddress} />

            <div className="max-w-md mx-auto mt-12 text-center text-gray-400 text-xs leading-relaxed">
                Payments through ZeroLink are non-custodial and cryptographically private.
                Only the recipient with their private view key can detect these funds.
            </div>
        </div>
    );
};
