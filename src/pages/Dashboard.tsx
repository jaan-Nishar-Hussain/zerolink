import React from 'react';
import { CreateLink } from '../components/CreateLink';
import { PrivateInbox } from '../components/PrivateInbox';
import { useSessionStore } from '../store/useSessionStore';
import { ShieldCheck, User } from 'lucide-react';
import { shortenAddress } from '../lib/starknet';

export const Dashboard: React.FC = () => {
    const { address, metaAddress } = useSessionStore();

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight leading-none mb-4">Your Dashboard</h1>
                    <div className="flex items-center gap-4 text-sm font-medium text-gray-500">
                        <div className="flex items-center gap-1.5">
                            <User className="w-4 h-4" />
                            {shortenAddress(address || '')}
                        </div>
                        <div className="w-1 h-1 bg-gray-300 rounded-full" />
                        <div className="flex items-center gap-1.5 text-indigo-600">
                            <ShieldCheck className="w-4 h-4" />
                            Stealth Identity Active
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-10">
                {/* Left Column: Inbox */}
                <div className="lg:col-span-2">
                    <PrivateInbox />
                </div>

                {/* Right Column: Actions & Info */}
                <div className="space-y-8">
                    <CreateLink />

                    <div className="bg-gray-900 rounded-3xl p-8 text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <h4 className="text-lg font-bold mb-2">Security Tip</h4>
                            <p className="text-gray-400 text-sm leading-relaxed mb-6">
                                Your private keys are currently stored in your session. Closing this tab will remove them for maximum security.
                            </p>
                            <button className="text-xs font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-4">
                                Learn about Stealth Recovery
                            </button>
                        </div>
                        {/* Abstract Background Element */}
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />
                    </div>
                </div>
            </div>
        </div>
    );
};
