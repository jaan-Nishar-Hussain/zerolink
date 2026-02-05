import React from 'react';
import { connect, disconnect } from 'get-starknet';
import { useSessionStore } from '../store/useSessionStore';
import { LogOut, Wallet } from 'lucide-react';
import { shortenAddress } from '../lib/starknet';

export const WalletConnect: React.FC = () => {
    const { address, isConnected, setSession, clearSession } = useSessionStore();

    const handleConnect = async () => {
        try {
            const starknet = await connect();
            if (starknet && starknet.isConnected) {
                setSession(starknet.selectedAddress);
            }
        } catch (error) {
            console.error('Failed to connect wallet:', error);
        }
    };

    const handleDisconnect = async () => {
        await disconnect();
        clearSession();
    };

    if (isConnected && address) {
        return (
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full border border-gray-200">
                    <Wallet className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-medium text-gray-700">{shortenAddress(address)}</span>
                </div>
                <button
                    onClick={handleDisconnect}
                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
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
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
        >
            <Wallet className="w-5 h-5" />
            Connect Wallet
        </button>
    );
};
