import React, { useEffect, useState } from 'react';
import { PaymentForm } from '../components/PaymentForm';
import type { LinkResponse } from '../lib/api/client';
import { ShieldAlert, Loader2, Zap, ShieldCheck } from 'lucide-react';

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
                await new Promise(r => setTimeout(r, 1500));
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
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 bg-glow">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center mb-8">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                </div>
                <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Fetching Identity</p>
            </div>
        );
    }

    if (error || !linkData) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-glow">
                <div className="max-w-md w-full text-center glass p-12 rounded-[3rem] border-red-50">
                    <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8">
                        <ShieldAlert className="w-10 h-10 text-red-500" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight leading-none">Identity Lost</h2>
                    <p className="text-slate-500 mb-10 font-medium leading-relaxed">{error || 'This Payment Link has been de-indexed or does not exist.'}</p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-black transition-all shadow-xl shadow-slate-200"
                    >
                        Back to ZeroLink
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 md:py-32 px-6 bg-glow">
            <div className="max-w-7xl mx-auto mb-20 text-center animate-in fade-in duration-1000">
                <div className="inline-flex items-center gap-4 text-indigo-600 font-black tracking-tighter mb-10 group cursor-pointer" onClick={() => window.location.href = '/'}>
                    <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <span className="text-2xl text-slate-800">ZeroLink <span className="text-indigo-600">Protocol</span></span>
                </div>

                <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4 border border-emerald-100">
                        <Zap className="w-3 h-3 fill-emerald-600" />
                        Encrypted Receiver Verified
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-none mb-4">Pay @{slug}</h1>
                    <p className="text-lg md:text-xl text-slate-400 font-medium max-w-lg">
                        Funds will be deposited into a unique one-time stealth address controlled by the recipient.
                    </p>
                </div>
            </div>

            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-[3rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                <div className="relative">
                    <PaymentForm recipientSlug={slug} recipientMeta={linkData.metaAddress} />
                </div>
            </div>

            <div className="max-w-md mx-auto mt-20 text-center text-slate-300 text-[10px] font-black uppercase tracking-[0.2em] leading-loose">
                <p>Non-Custodial. Purely Private. Chain-Agnostic Stealth.</p>
                <p className="opacity-50">Powered by ZK-Integrity on Starknet L2</p>
            </div>
        </div>
    );
};
