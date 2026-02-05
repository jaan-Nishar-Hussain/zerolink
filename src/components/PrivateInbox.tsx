import React, { useState } from 'react';
import { Search, Hash, Clock, ArrowDownLeft, RefreshCcw, Landmark, ShieldCheck } from 'lucide-react';
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
        <div className="glass rounded-[2.5rem] p-10 border-slate-100 overflow-hidden relative group">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                            <Search className="w-5 h-5" />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">Private Inbox</h3>
                    </div>
                    <p className="text-slate-400 font-bold text-sm ml-1">Cryptographic scanning active</p>
                </div>
                <button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-xl shadow-indigo-100 active:scale-95"
                >
                    <RefreshCcw className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} />
                    {isScanning ? 'Scanning Ledger...' : 'Scan Now'}
                </button>
            </div>

            {payments.length === 0 && !isScanning ? (
                <div className="py-24 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 flex flex-col items-center">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-slate-100 mb-8">
                        <ShieldCheck className="w-10 h-10 text-slate-200" />
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-2">Inbox is empty</h4>
                    <p className="text-slate-400 font-bold text-sm max-w-xs mx-auto">Click "Scan Now" to search for new stealth-payments sent to your identity.</p>
                </div>
            ) : (
                <div className="overflow-x-auto -mx-10 px-10">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="px-6 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Payment</th>
                                <th className="px-6 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Arrival</th>
                                <th className="px-6 py-6 text-xs font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Identity Link</th>
                                <th className="px-6 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Vault</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {payments.map((p) => (
                                <tr key={p.id} className="hover:bg-indigo-50/20 transition-all group/row">
                                    <td className="px-6 py-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm border border-slate-100 group-hover/row:scale-110 transition-transform">
                                                <ArrowDownLeft className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <span className="block text-lg font-black text-slate-900 leading-none mb-1">{p.amount}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Starknet Mainnet</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-8">
                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                                            <Clock className="w-4 h-4 text-slate-300" />
                                            {p.timestamp}
                                        </div>
                                    </td>
                                    <td className="px-6 py-8 hidden md:table-cell">
                                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-400 bg-slate-50 w-fit px-3 py-1.5 rounded-lg">
                                            <Hash className="w-3.5 h-3.5" />
                                            {p.txHash}
                                        </div>
                                    </td>
                                    <td className="px-6 py-8">
                                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${p.status === 'unclaimed'
                                            ? 'bg-amber-100 text-amber-700 block w-fit'
                                            : 'bg-slate-100 text-slate-400 block w-fit'
                                            }`}>
                                            {p.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-8 text-right">
                                        {p.status === 'unclaimed' ? (
                                            <button
                                                onClick={() => window.location.href = '/withdraw'}
                                                className="flex items-center gap-2 ml-auto px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg shadow-slate-200 active:scale-95"
                                            >
                                                <Landmark className="w-4 h-4" />
                                                Sweep to Wallet
                                            </button>
                                        ) : (
                                            <div className="text-xs font-bold text-slate-300 uppercase tracking-widest mr-4">Settled</div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {/* Gloss Decoration */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
        </div>
    );
};
