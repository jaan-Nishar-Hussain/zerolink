import React from 'react';
import { Wallet, LogOut, ChevronDown, ShieldCheck } from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore';
import { shortenAddress } from '../lib/starknet';

export const WalletConnect: React.FC = () => {
    const { isConnected, address, setSession, clearSession } = useSessionStore();

    const handleConnect = async () => {
        // In a real app, this would use get-starknet
        // for simulation we just set a mock address
        setSession('0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7');
    };

    if (isConnected && address) {
        return (
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 px-6 py-2.5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all group cursor-pointer">
                    <div className="w-6 h-6 bg-indigo-50 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                        <Wallet className="w-3.5 h-3.5 text-indigo-600 group-hover:text-white transition-colors" />
                    </div>
                    <span className="text-sm font-black text-slate-700">{shortenAddress(address)}</span>
                    <ChevronDown className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>

                <button
                    onClick={clearSession}
                    className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                    title="Disconnect"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleConnect}
            className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-xl shadow-slate-200 hover:-translate-y-0.5 active:scale-95 flex items-center gap-3 group"
        >
            <ShieldCheck className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            Connect Wallet
        </button>
    );
};
