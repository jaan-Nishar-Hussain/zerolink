import React, { useState } from 'react';
import { Landmark, ArrowUpRight, ShieldCheck, Lock, Loader2, Sparkles, Key } from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore';
import { computeStealthPrivateKey } from '../lib/crypto';
import { shortenAddress } from '../lib/starknet';

export const Withdrawal: React.FC = () => {
    const { stealthKeys, address } = useSessionStore();
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [success, setSuccess] = useState(false);

    // Simulated scanning/manual input for demo purposes
    const [ephemeralKey, setEphemeralKey] = useState('');

    const handleWithdraw = async () => {
        if (!stealthKeys || !ephemeralKey) return;

        setIsWithdrawing(true);
        try {
            // 1. Compute the stealth private key using our shared secret
            const stealthPk = computeStealthPrivateKey(
                stealthKeys.spendingPrivateKey,
                stealthKeys.viewingPrivateKey,
                ephemeralKey
            );

            console.log('Derived Stealth Private Key for sweep:', stealthPk);

            // 2. In a real app, we would now:
            // - Connect an account with this private key
            // - Execute a transfer to `address`
            // - Pay for gas (using Paymaster or small fee subsidy)

            await new Promise(r => setTimeout(r, 2500)); // Simulate chain tx
            setSuccess(true);
        } catch (error) {
            console.error('Withdrawal failed:', error);
        } finally {
            setIsWithdrawing(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-2xl mx-auto py-24 text-center">
                <div className="w-24 h-24 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 border border-emerald-100 shadow-sm">
                    <Sparkles className="w-12 h-12 text-emerald-500" />
                </div>
                <h1 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">Funds Swept!</h1>
                <p className="text-slate-500 mb-12 text-xl font-medium leading-relaxed">
                    The funds have been successfully moved from the stealth address to your main wallet:
                    <span className="block mt-4 text-slate-900 font-bold bg-slate-100 py-3 rounded-2xl">{shortenAddress(address || '')}</span>
                </p>
                <button
                    onClick={() => window.location.href = '/dashboard'}
                    className="px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-black transition-all shadow-2xl active:scale-95"
                >
                    Back to Console
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-6 py-12">
            <div className="mb-16">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <ArrowUpRight className="w-6 h-6" />
                    </div>
                    <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-none">Sweep Funds</h1>
                </div>
                <p className="text-xl text-slate-400 font-medium max-w-xl">
                    Claim funds from a stealth-address by deriving the one-time private key.
                </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-16">
                <div>
                    {/* Withdrawal Card */}
                    <div className="glass p-12 rounded-[3.5rem] overflow-hidden relative">
                        <div className="space-y-10 relative z-10">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-1">
                                    Ephemeral Public Key (from scanning)
                                </label>
                                <div className="relative">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300">
                                        <Key className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        value={ephemeralKey}
                                        onChange={(e) => setEphemeralKey(e.target.value)}
                                        placeholder="0x04..."
                                        className="w-full pl-14 pr-5 py-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 font-mono text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Destination</span>
                                    <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest">Your Connected Wallet</div>
                                </div>
                                <div className="text-lg font-black text-slate-800 font-mono">{shortenAddress(address || '0x...')}</div>
                            </div>

                            <button
                                onClick={handleWithdraw}
                                disabled={!ephemeralKey || isWithdrawing}
                                className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-black text-xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {isWithdrawing ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        Sweeping...
                                    </>
                                ) : (
                                    <>
                                        <Landmark className="w-6 h-6" />
                                        Withdraw Privately
                                    </>
                                )}
                            </button>
                        </div>
                        {/* Glow */}
                        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl -mr-24 -mt-24" />
                    </div>
                </div>

                <div className="space-y-10">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Security Protocol</h3>

                    <div className="space-y-8">
                        {[
                            {
                                icon: ShieldCheck,
                                title: "Non-Linkable Claims",
                                desc: "Withdrawals are signed with a unique one-time key. Observers cannot link this withdrawal to your identity.",
                                color: "text-emerald-500 bg-emerald-50"
                            },
                            {
                                icon: Lock,
                                title: "Local Derivation",
                                desc: "The stealth private key is computed entirely in your browser. No keys are ever transmitted over the network.",
                                color: "text-indigo-500 bg-indigo-50"
                            }
                        ].map((item, i) => (
                            <div key={i} className="flex gap-6">
                                <div className={`w-14 h-14 ${item.color} rounded-2xl flex items-center justify-center shrink-0 border border-current/10 shadow-sm`}>
                                    <item.icon className="w-7 h-7" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-slate-800 mb-1">{item.title}</h4>
                                    <p className="text-slate-400 font-medium leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-8 bg-amber-50 rounded-3xl border border-amber-100 text-amber-900">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck className="w-5 h-5" />
                            <span className="text-sm font-black uppercase tracking-widest">Gas Note</span>
                        </div>
                        <p className="text-sm font-bold leading-relaxed opacity-80">
                            Claiming funds Requires gas on the stealth address. In a future update, we will support Gasless Withdrawals via Starknet Paymasters.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
