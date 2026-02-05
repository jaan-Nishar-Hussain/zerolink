import React, { useState } from 'react';
import { Landmark, ArrowUpRight, ShieldCheck, Lock, Loader2 } from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore';
import { computeStealthPrivateKey } from '../lib/crypto';
import { shortenAddress } from '../lib/starknet';

export const Withdrawal: React.FC = () => {
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const { address, stealthKeys } = useSessionStore();

    const handleWithdraw = async () => {
        if (!stealthKeys) return;

        setIsWithdrawing(true);
        try {
            // 1. In a real flow, we'd take the ephemeral public key from the selected payment
            const mockEphemeralPublicKey = '03a1b2c3d4e5f6...';

            // 2. Derive the stealth private key
            const pKey = computeStealthPrivateKey(
                stealthKeys.spendingPrivateKey,
                stealthKeys.viewingPrivateKey,
                mockEphemeralPublicKey
            );

            console.log('Derived stealth private key for withdrawal:', pKey);

            // 3. Sign and send withdrawal transaction
            await new Promise(r => setTimeout(r, 2500));

            setIsSuccess(true);
        } catch (error) {
            console.error('Withdrawal failed:', error);
        } finally {
            setIsWithdrawing(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="max-w-xl mx-auto py-20 px-6 text-center">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 text-green-500">
                    <ShieldCheck className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-bold mb-4">Funds Withdrawn Successfully!</h1>
                <p className="text-gray-500 mb-10 max-w-md mx-auto">
                    The funds have been swept from the stealth address and transferred to your main wallet:
                    <span className="font-bold text-gray-900 ml-1">{shortenAddress(address || '')}</span>.
                </p>
                <button
                    onClick={() => window.location.href = '/dashboard'}
                    className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto py-12 px-6">
            <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-amber-100">
                    <Lock className="w-3.5 h-3.5" />
                    Secure Withdrawal
                </div>
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">Withdraw Funds</h1>
                <p className="text-gray-500 leading-relaxed">
                    You are about to sweep funds from a one-time stealth address. This process is cryptographically private and non-custodial.
                </p>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl space-y-8">
                <div className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-indigo-600">
                            <Landmark className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-400">Available Amount</p>
                            <p className="text-2xl font-black text-gray-900">12.5 STRK</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Fee</p>
                        <p className="text-sm font-bold text-gray-600">~0.01 STRK</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between text-sm font-medium">
                        <span className="text-gray-400">Destination Wallet</span>
                        <span className="text-gray-900">{shortenAddress(address || '')}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                        <span className="text-gray-400">Privacy Mode</span>
                        <span className="text-indigo-600 font-bold">Stealth Sweep</span>
                    </div>
                </div>

                <button
                    onClick={handleWithdraw}
                    disabled={isWithdrawing}
                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isWithdrawing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Signing & Sweeping...
                        </>
                    ) : (
                        <>
                            Confirm Withdrawal
                            <ArrowUpRight className="w-5 h-5" />
                        </>
                    )}
                </button>

                <p className="text-center text-xs text-gray-400 italic">
                    Transactions on Starknet usually settle in seconds.
                </p>
            </div>
        </div>
    );
};
