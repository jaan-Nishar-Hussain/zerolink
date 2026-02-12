/**
 * ZeroLink API Client
 * Communicates with the backend for alias registry and announcements
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface MetaAddress {
    spendPubKey: string;
    viewingPubKey: string;
}

export interface AliasInfo {
    alias: string;
    metaAddress: MetaAddress;
    displayName?: string;
    avatarUrl?: string;
    createdAt: string;
}

export interface StealthAnnouncement {
    id: string;
    stealthAddress: string;
    ephemeralPubKey: string;
    token: string;
    amount: string;
    txHash: string;
    blockNumber: string;
    timestamp: string;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE) {
        this.baseUrl = baseUrl;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        return response.json();
    }

    // Alias Registry

    async getAlias(alias: string): Promise<AliasInfo> {
        return this.request<AliasInfo>(`/alias/${encodeURIComponent(alias)}`);
    }

    async checkAliasAvailable(alias: string): Promise<{ alias: string; available: boolean }> {
        return this.request<{ alias: string; available: boolean }>(
            `/alias/check/${encodeURIComponent(alias)}`
        );
    }

    async registerAlias(
        alias: string,
        metaAddress: MetaAddress,
        displayName?: string
    ): Promise<{ message: string; alias: string; createdAt: string }> {
        return this.request('/alias', {
            method: 'POST',
            body: JSON.stringify({
                alias,
                spendPubKey: metaAddress.spendPubKey,
                viewingPubKey: metaAddress.viewingPubKey,
                displayName,
            }),
        });
    }

    async updateAlias(
        alias: string,
        updates: { displayName?: string; avatarUrl?: string }
    ): Promise<{ message: string; alias: string; updatedAt: string }> {
        return this.request(`/alias/${encodeURIComponent(alias)}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    // Stealth Announcements

    async getAnnouncements(
        fromBlock?: string,
        limit?: number
    ): Promise<{ announcements: StealthAnnouncement[]; count: number }> {
        const params = new URLSearchParams();
        if (fromBlock) params.set('fromBlock', fromBlock);
        if (limit) params.set('limit', limit.toString());

        return this.request(`/announcements?${params.toString()}`);
    }

    async scanAnnouncements(
        fromBlock?: string,
        limit?: number
    ): Promise<{ announcements: StealthAnnouncement[]; count: number }> {
        const params = new URLSearchParams();
        if (fromBlock) params.set('fromBlock', fromBlock);
        if (limit) params.set('limit', limit.toString());

        return this.request(`/announcements/scan?${params.toString()}`);
    }

    async getAnnouncementStats(): Promise<{
        totalAnnouncements: number;
        lastBlockNumber: string;
        lastUpdated: string | null;
    }> {
        return this.request('/announcements/stats');
    }

    async announcePayment(announcement: {
        txHash: string;
        stealthAddress: string;
        ephemeralPubKey: string;
        token: string;
        amount: string;
        timestamp: string;
        blockNumber?: string;
    }): Promise<{ message: string; id: string }> {
        return this.request('/announcements/announce', {
            method: 'POST',
            body: JSON.stringify(announcement),
        });
    }

    // Health Check

    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        return this.request('/health'.replace('/api', ''));
    }
}

export const api = new ApiClient();
export default api;
