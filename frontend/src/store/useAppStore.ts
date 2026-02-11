import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MetaAddress } from '../lib/crypto/stealth';

interface Payment {
    id: string;
    type: 'sent' | 'received';
    amount: string;
    token: string;
    txHash: string;
    ephemeralPubKey: string;
    stealthAddress: string;
    tokenAddress: string;
    recipient?: string;
    timestamp: number;
    status: 'pending' | 'confirmed' | 'withdrawn';
}

interface AppState {
    // Wallet
    isWalletConnected: boolean;
    walletAddress: string | null;

    // Keys (only meta address stored, private keys in IndexedDB)
    metaAddress: MetaAddress | null;
    alias: string | null;
    isUnlocked: boolean;

    // Payments
    payments: Payment[];
    totalReceived: string;

    // UI
    isLoading: boolean;

    // Actions
    setWalletConnected: (connected: boolean, address?: string) => void;
    setMetaAddress: (metaAddress: MetaAddress | null, alias?: string) => void;
    setUnlocked: (unlocked: boolean) => void;
    addPayment: (payment: Payment) => void;
    updatePaymentStatus: (id: string, status: Payment['status']) => void;
    setLoading: (loading: boolean) => void;
    reset: () => void;
}

const initialState = {
    isWalletConnected: false,
    walletAddress: null,
    metaAddress: null,
    alias: null,
    isUnlocked: false,
    payments: [],
    totalReceived: '0',
    isLoading: false,
};

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            ...initialState,

            setWalletConnected: (connected, address) =>
                set({ isWalletConnected: connected, walletAddress: address || null }),

            setMetaAddress: (metaAddress, alias) =>
                set({ metaAddress, alias: alias || null }),

            setUnlocked: (unlocked) =>
                set({ isUnlocked: unlocked }),

            addPayment: (payment) =>
                set((state) => {
                    // Prevent duplicate entries
                    if (state.payments.some(p => p.id === payment.id)) {
                        return state;
                    }
                    return {
                        payments: [payment, ...state.payments],
                        totalReceived: payment.type === 'received'
                            ? (parseFloat(state.totalReceived) + parseFloat(payment.amount)).toString()
                            : state.totalReceived,
                    };
                }),

            updatePaymentStatus: (id, status) =>
                set((state) => ({
                    payments: state.payments.map((p) =>
                        p.id === id ? { ...p, status } : p
                    ),
                })),

            setLoading: (loading) =>
                set({ isLoading: loading }),

            reset: () => set(initialState),
        }),
        {
            name: 'zerolink-storage',
            partialize: (state) => ({
                metaAddress: state.metaAddress,
                alias: state.alias,
                payments: state.payments,
                totalReceived: state.totalReceived,
            }),
        }
    )
);
