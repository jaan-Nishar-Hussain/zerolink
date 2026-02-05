import React, { useState } from 'react';
import { Link2, Copy, Check, Send } from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore';
import { api } from '../lib/api/client';

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
            // For now, we simulate the API call or use the client
            // await api.createLink({ 
            //   slug, 
            //   spendingPublicKey: metaAddress.spendingPublicKey, 
            //   viewingPublicKey: metaAddress.viewingPublicKey 
            // });

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
            <div className="bg-indigo-600 rounded-2xl p-6 text-white text-center">
                <h3 className="text-xl font-bold mb-4">Your Private Link!</h3>
                <div className="flex items-center gap-2 p-3 bg-white/10 rounded-xl mb-6 border border-white/20">
                    <Link2 className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-mono truncate">{createdLink}</span>
                    <button onClick={copyToClipboard} className="ml-auto p-1.5 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                        {copied ? <Check className="w-4 h-4 text-green-300" /> : <Copy className="w-4 h-4" />}
                    </button>
                </div>
                <p className="text-sm text-indigo-100 leading-relaxed">
                    Share this link with anyone who wants to send you funds privately.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                    <Send className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold">Create Private Link</h3>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 px-1">Choose your slug</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">zerolink.me/</span>
                        <input
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                            placeholder="username"
                            className="w-full pl-28 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                        />
                    </div>
                </div>

                <button
                    onClick={handleCreate}
                    disabled={!slug || isLoading}
                    className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Creating...' : 'Generate My Link'}
                </button>
            </div>
        </div>
    );
};
