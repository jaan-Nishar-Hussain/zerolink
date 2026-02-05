import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export interface CreateLinkRequest {
    slug: string;
    spendingPublicKey: string;
    viewingPublicKey: string;
}

export interface LinkResponse {
    id: string;
    slug: string;
    metaAddress: {
        spendingPublicKey: string;
        viewingPublicKey: string;
    };
}

export const api = {
    createLink: async (data: CreateLinkRequest): Promise<LinkResponse> => {
        const response = await apiClient.post<LinkResponse>('/links', data);
        return response.data;
    },

    getLink: async (slug: string): Promise<LinkResponse> => {
        const response = await apiClient.get<LinkResponse>(`/links/${slug}`);
        return response.data;
    },

    // Potential endpoint for scanning (if backend helps index events)
    getPayments: async (metaAddress: string): Promise<any[]> => {
        const response = await apiClient.get(`/payments/${metaAddress}`);
        return response.data;
    }
};

export default apiClient;
