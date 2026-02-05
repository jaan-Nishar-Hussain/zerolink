import { ec, hash, num } from 'starknet';

/**
 * Derive a Starknet address from a stealth public key.
 * Currently uses a simplified derivation (placeholder until contract spec is clear).
 * In production, this would use the contract factory's deployment formula.
 */
export function deriveStarknetAddressFromPublicKey(publicKeyHex: string): string {
    // Starknet public keys are usually the X coordinate of the point
    // For now, we'll hash the hex public key to get a valid-looking address
    const h = hash.starknetKeccak(publicKeyHex);
    return num.toHex(h);
}

/**
 * Format address for display (though stealth addresses shouldn't be shown)
 */
export function shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}
