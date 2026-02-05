import React, { useState } from 'react';
import { Link2, Copy, Check, Send, Sparkles } from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore';

export const CreateLink: React.FC = () => {
    const [slug, setSlug] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [createdLink, setCreatedLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const { metaAddress } = useSessionStore();

    const handleCreate = async () => {
        if (!slug || !metaAddress) return;

        setIsLoading(true);
        try {
            // API Simulation
            await new Promise(r => setTimeout(r, 1200));
            const link = `${window.location.origin}/link/${slug}`;
            setCreatedLink(link);
        } catch (error) {
            console.error('Failed to create link:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (createdLink) {
            navigator.clipboard.writeText(createdLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (createdLink) {
        return (
            <div className="bg-indigo-600 rounded-[2rem] p-8 text-white text-center shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                <div className="relative z-10">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md border border-white/20">
                        <Sparkles className="w-8 h-8 text-white animate-pulse" />
                    </div>
                    <h3 className="text-2xl font-black mb-4">Link Active!</h3>
                    <div className="flex items-center gap-3 p-4 bg-white/10 rounded-2xl mb-8 border border-white/20 backdrop-blur-md group-hover:bg-white/15 transition-colors">
                        <Link2 className="w-5 h-5 flex-shrink-0 text-indigo-200" />
                        <span className="text-sm font-bold font-mono truncate">{createdLink}</span>
                        <button onClick={copyToClipboard} className="ml-auto p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all active:scale-90">
                            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                    <button
                        onClick={() => setCreatedLink(null)}
                        className="text-xs font-bold uppercase tracking-widest text-indigo-200 hover:text-white transition-colors"
                    >
                        Create Another
                    </button>
                </div>
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Send className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-900">Privacy Link</h3>
                    <p className="text-sm font-bold text-slate-400">Generate your payment vanity URL</p>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Receiver Handle</label>
                    <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">/link/</span>
                        <input
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                            placeholder="username"
                            className="w-full pl-16 pr-5 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700"
                        />
                    </div>
                </div>

                <button
                    onClick={handleCreate}
                    disabled={!slug || isLoading}
                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                    {isLoading ? 'Processing...' : (
                        <span className="flex items-center justify-center gap-2">
                            Generate Private Link
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
};

// Internal icon for consistency
const ArrowRight = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
);
