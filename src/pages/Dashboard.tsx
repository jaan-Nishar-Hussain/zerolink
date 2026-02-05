import React from 'react';
import { CreateLink } from '../components/CreateLink';
import { PrivateInbox } from '../components/PrivateInbox';
import { useSessionStore } from '../store/useSessionStore';
import { ShieldCheck, User, ShieldAlert, Sparkles } from 'lucide-react';
import { shortenAddress } from '../lib/starknet';

export const Dashboard: React.FC = () => {
    const { address } = useSessionStore();

    return (
        <div className="max-w-7xl mx-auto px-6 py-6 md:py-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
                            <User className="w-6 h-6 text-indigo-600" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Console</h1>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-bold text-slate-400">
                        <div className="bg-slate-100 px-3 py-1 rounded-lg">
                            {shortenAddress(address || '')}
                        </div>
                        <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                        <div className="flex items-center gap-1.5 text-emerald-500">
                            <ShieldCheck className="w-4 h-4" />
                            Identity Active
                        </div>
                    </div>
                </div>

                <div className="hidden lg:flex items-center gap-4 px-6 py-4 bg-white/50 border border-white rounded-3xl shadow-sm">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Protocol Status: <span className="text-emerald-500">Optimal</span>
                    </p>
                </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-10">
                {/* Inbox Area */}
                <div className="lg:col-span-8">
                    <PrivateInbox />
                </div>

                {/* Sidebar area */}
                <div className="lg:col-span-4 space-y-10">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative">
                            <CreateLink />
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
                        <div className="relative z-10">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-8 border border-white/10">
                                <ShieldAlert className="w-6 h-6 text-amber-400" />
                            </div>
                            <h4 className="text-2xl font-black mb-4">Privacy Guard</h4>
                            <p className="text-slate-400 font-medium leading-relaxed mb-8">
                                Your private keys are kept strictly in-memory. They will be purged from the browser when you close this tab.
                            </p>
                            <button className="w-full py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-all">
                                Protocol Docs
                            </button>
                        </div>
                        {/* Interactive Background Element */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] -mr-32 -mt-32" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[60px] -ml-16 -mb-16" />
                    </div>
                </div>
            </div>
        </div>
    );
};
