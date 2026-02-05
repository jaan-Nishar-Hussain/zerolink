import React, { useState } from 'react';
import { Shield, Key, CheckCircle } from 'lucide-react';
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
        <div className="max-w-md w-full mx-auto p-8 bg-white rounded-3xl shadow-xl border border-gray-100">
            {step === 1 ? (
                <div className="text-center">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Shield className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Secure Your Identity</h2>
                    <p className="text-gray-500 mb-8 leading-relaxed">
                        Generate your private meta address to receive untraceable payments on Starknet. Your keys stay in your browser.
                    </p>
                    <button
                        onClick={handleGenerate}
                        className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-[0.98]"
                    >
                        Generate Steath Identity
                    </button>
                </div>
            ) : (
                <div className="text-center animate-in fade-in duration-500">
                    <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Identity Generated</h2>
                    <p className="text-gray-500 mb-8 leading-relaxed">
                        Your private meta address is ready. You can now create payment links and receive funds privately.
                    </p>
                    <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 mb-8 select-all cursor-pointer group">
                        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <Key className="w-3 h-3" />
                            Your Meta Address
                        </div>
                        <div className="text-sm font-mono text-gray-700 break-all">
                            {/* This would be the combined public keys */}
                            {window.location.origin}/jaan
                        </div>
                    </div>
                    <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-md active:scale-[0.98]"
                    >
                        Go to Dashboard
                    </button>
                </div>
            )}
        </div>
    );
};
