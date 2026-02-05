import React, { useState, useEffect } from 'react';
import { Search, Hash, Clock, ArrowDownLeft, RefreshCcw, Landmark } from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore';

interface Payment {
    id: string;
    amount: string;
    timestamp: string;
    txHash: string;
    status: 'unclaimed' | 'claimed';
}

export const PrivateInbox: React.FC = () => {
    const [isScanning, setIsScanning] = useState(false);
    const [payments, setPayments] = useState<Payment[]>([]);
    const { metaAddress } = useSessionStore();

    const handleScan = () => {
        setIsScanning(true);
        // Simulation: Scanning Starknet events
        setTimeout(() => {
            setPayments([
                {
                    id: '1',
                    amount: '12.5 STRK',
                    timestamp: '2 hours ago',
                    txHash: '0x1234...5678',
                    status: 'unclaimed'
                },
                {
                    id: '2',
                    amount: '5.0 STRK',
                    timestamp: 'Yesterday',
                    txHash: '0xabcd...efgh',
                    status: 'claimed'
                }
            ]);
            setIsScanning(false);
        }, 3000);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-2xl font-bold text-gray-900">Private Inbox</h3>
                    <p className="text-gray-500 text-sm">Scan the network for payments to your stealth identity</p>
                </div>
                <button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all disabled:opacity-50"
                >
                    <RefreshCcw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                    {isScanning ? 'Scanning...' : 'Scan Now'}
                </button>
            </div>

            {payments.length === 0 && !isScanning ? (
                <div className="py-20 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                        <Search className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="text-gray-400 font-medium tracking-tight">No payments found yet. Try scanning!</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">TX Hash</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {payments.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
                                                    <ArrowDownLeft className="w-4 h-4" />
                                                </div>
                                                <span className="font-bold text-gray-900">{p.amount}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-sm text-gray-500 font-medium">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5" />
                                                {p.timestamp}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-sm font-mono text-gray-400">
                                            <div className="flex items-center gap-2">
                                                <Hash className="w-3.5 h-3.5" />
                                                {p.txHash}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${p.status === 'unclaimed' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            {p.status === 'unclaimed' && (
                                                <button className="flex items-center gap-1.5 ml-auto px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-sm hover:bg-indigo-100 transition-colors">
                                                    <Landmark className="w-3.5 h-3.5" />
                                                    Withdraw
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
