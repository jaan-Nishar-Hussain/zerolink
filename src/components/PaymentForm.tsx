import React, { useState } from 'react';
import { Send, Shield, Info, ArrowRight } from 'lucide-react';
import { generateStealthPublicKey } from '../lib/crypto';
import { deriveStarknetAddressFromPublicKey } from '../lib/starknet';

interface PaymentFormProps {
    recipientSlug: string;
    recipientMeta: {
        spendingPublicKey: string;
        viewingPublicKey: string;
    };
}

export const PaymentForm: React.FC<PaymentFormProps> = ({ recipientSlug, recipientMeta }) => {
    const [amount, setAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSend = async () => {
        setIsProcessing(true);
        try {
            // 1. Generate Stealth Info
            const { stealthPublicKey, ephemeralPublicKey } = generateStealthPublicKey(recipientMeta);

            // 2. Derive Starknet Address
            const stealthAddress = deriveStarknetAddressFromPublicKey(stealthPublicKey);

            console.log('Sending to stealth address:', stealthAddress);
            console.log('Attaching ephemeral public key:', ephemeralPublicKey);

            // 3. In a real app, we would send the transaction using starknet.js here
            // const tx = await account.execute(...)

            await new Promise(r => setTimeout(r, 2000)); // Simulate tx
            setIsSuccess(true);
        } catch (error) {
            console.error('Payment failed:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="text-center p-8 bg-green-50 rounded-3xl border border-green-100">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white">
                    <Send className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Sent!</h2>
                <p className="text-gray-600 mb-8">
                    Your payment to <span className="font-bold text-gray-900">@{recipientSlug}</span> was sent privately using a one-time stealth address.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all"
                >
                    Send Another
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-md w-full mx-auto bg-white rounded-3xl p-8 border border-gray-100 shadow-xl">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-1">Pay @{recipientSlug}</h2>
                <p className="text-gray-500">Your privacy is protected by ZeroLink</p>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Amount (STRK)</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-2xl font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                </div>

                <div className="p-4 bg-indigo-50 rounded-2xl flex gap-4">
                    <Shield className="w-6 h-6 text-indigo-600 flex-shrink-0" />
                    <div className="text-xs text-indigo-800 leading-relaxed">
                        <p className="font-bold mb-1 uppercase tracking-wider">Stealth Mode Active</p>
                        We will generate a unique one-time address for this payment. No one can link this transaction to you or the recipient.
                    </div>
                </div>

                <button
                    onClick={handleSend}
                    disabled={!amount || isProcessing}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 group disabled:opacity-50"
                >
                    {isProcessing ? 'Processing Privacy...' : (
                        <>
                            Send Privately
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>

                <div className="flex items-center justify-center gap-2 text-xs text-gray-400 font-medium">
                    <Info className="w-3.5 h-3.5" />
                    No address exposure. No history leakage.
                </div>
            </div>
        </div>
    );
};
