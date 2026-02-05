import React, { useState } from 'react';
import { Shield, Key, CheckCircle, ArrowRight, Sparkles, Lock } from 'lucide-react';
import { generateMetaAddress } from '../lib/crypto';
import { useSessionStore } from '../store/useSessionStore';

export const Onboarding: React.FC = () => {
    const [step, setStep] = useState(1);
    const { setStealthIdentity } = useSessionStore();

    const handleGenerate = () => {
        const { metaAddress, spendingPrivateKey, viewingPrivateKey } = generateMetaAddress();
        setStealthIdentity(metaAddress, { spendingPrivateKey, viewingPrivateKey });
        setStep(2);
    };

    return (
        <div className="max-w-md w-full mx-auto p-12 bg-white rounded-[3rem] shadow-2xl border border-slate-50 relative overflow-hidden">
            {step === 1 ? (
                <div className="text-center">
                    <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 border border-indigo-100 shadow-sm animate-float">
                        <Shield className="w-12 h-12 text-indigo-600" />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Privacy Portal</h2>
                    <p className="text-slate-500 mb-12 text-lg font-medium leading-relaxed">
                        To receive anonymous payments, you need a Stealth Identity. No data ever leaves your device.
                    </p>
                    <button
                        onClick={handleGenerate}
                        className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 active:scale-[0.98] flex items-center justify-center gap-3 group"
                    >
                        Initialize Identity
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <div className="mt-10 pt-10 border-t border-slate-50 flex items-center justify-center gap-6">
                        <div className="flex flex-col items-center gap-1">
                            <Lock className="w-4 h-4 text-slate-300" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End-to-End</span>
                        </div>
                        <div className="w-px h-6 bg-slate-100" />
                        <div className="flex flex-col items-center gap-1">
                            <Sparkles className="w-4 h-4 text-slate-300" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantum Safe</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center animate-in fade-in zoom-in duration-700">
                    <div className="w-24 h-24 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 border border-emerald-100 shadow-sm">
                        <CheckCircle className="w-12 h-12 text-emerald-500" />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Identity Born</h2>
                    <p className="text-slate-500 mb-12 text-lg font-medium leading-relaxed">
                        Your stealth credentials have been secured in your local session. You're ready to disappear.
                    </p>
                    <div className="p-8 bg-slate-900 rounded-[2.5rem] border border-slate-800 mb-12 relative overflow-hidden group">
                        <div className="absolute top-2 right-6 px-3 py-1 bg-white/10 rounded-full text-[8px] font-black text-indigo-300 uppercase tracking-[0.2em] border border-white/5">
                            ReadOnly
                        </div>
                        <div className="flex items-center gap-3 mb-4 text-xs font-black text-indigo-400 uppercase tracking-[0.2em]">
                            <Key className="w-4 h-4" />
                            Meta Handle Access
                        </div>
                        <div className="text-sm font-mono text-slate-300 break-all leading-relaxed opacity-60">
                            {/* This is the base URL */}
                            {window.location.origin.replace('http://', '').replace('https://', '')}/links/identity...
                        </div>
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
                    </div>
                    <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-black transition-all shadow-2xl active:scale-[0.98]"
                    >
                        Go to Console
                    </button>
                </div>
            )}
            {/* Corner Decor */}
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-indigo-50 rounded-full blur-2xl" />
        </div>
    );
};
