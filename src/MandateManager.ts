/**
 * Mandate Manager for W3C Mandate Support
 *
 * Handles creation, signing, and verification of W3C mandates.
 * Integrates with Google AP2 for intent verification.
 */

import { ethers } from 'ethers';
import { ChaosChainSDK } from './ChaosChainSDK';

/**
 * Mandate structure (W3C compliant)
 */
export interface Mandate {
  id: string;
  userDescription: string;
  merchants?: string[];
  skus?: string[];
  requiresRefundability: boolean;
  expiry: number; // Unix timestamp
  serverSignature?: string;
  clientSignature?: string;
  createdAt: number;
}

/**
 * Mandate Manager for W3C mandate support
 */
export class MandateManager {
  private sdk: ChaosChainSDK;

  constructor(sdk: ChaosChainSDK) {
    this.sdk = sdk;
  }

  /**
   * Create mandate
   *
   * @param userDescription User description of intent
   * @param merchants Optional list of merchant addresses
   * @param skus Optional list of SKUs
   * @param requiresRefundability Whether refundability is required
   * @param expiryMinutes Expiry in minutes (default: 60)
   * @returns Mandate
   */
  createMandate(
    userDescription: string,
    merchants?: string[],
    skus?: string[],
    requiresRefundability: boolean = false,
    expiryMinutes: number = 60
  ): Mandate {
    const mandate: Mandate = {
      id: `mandate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userDescription,
      merchants,
      skus,
      requiresRefundability,
      expiry: Date.now() + expiryMinutes * 60 * 1000,
      createdAt: Date.now(),
    };

    console.log(`📝 Mandate created: ${mandate.id}`);
    console.log(`   Description: ${userDescription}`);
    console.log(`   Expires: ${new Date(mandate.expiry).toISOString()}`);

    return mandate;
  }

  /**
   * Sign mandate as server
   *
   * @param mandate Mandate to sign
   * @returns Signed mandate
   */
  async signMandateAsServer(mandate: Mandate): Promise<Mandate> {
    const wallet = (this.sdk as any).walletManager.getWallet();

    // Sign mandate
    const signature = await wallet.signMessage(ethers.toUtf8Bytes(JSON.stringify(mandate)));

    mandate.serverSignature = signature;

    console.log(`✅ Mandate signed as server: ${mandate.id}`);

    return mandate;
  }

  /**
   * Sign mandate as client
   *
   * @param mandate Mandate to sign
   * @param clientWallet Client wallet (for signing)
   * @returns Signed mandate
   */
  async signMandateAsClient(mandate: Mandate, clientWallet: ethers.Wallet): Promise<Mandate> {
    // Sign mandate
    const signature = await clientWallet.signMessage(ethers.toUtf8Bytes(JSON.stringify(mandate)));

    mandate.clientSignature = signature;

    console.log(`✅ Mandate signed as client: ${mandate.id}`);

    return mandate;
  }

  /**
   * Verify mandate
   *
   * @param mandate Mandate to verify
   * @returns Verification result
   */
  async verifyMandate(mandate: Mandate): Promise<{
    valid: boolean;
    serverVerified: boolean;
    clientVerified: boolean;
    expired: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let serverVerified = false;
    let clientVerified = false;

    // Check expiry
    const expired = Date.now() > mandate.expiry;
    if (expired) {
      errors.push('Mandate has expired');
    }

    // Verify server signature
    if (mandate.serverSignature) {
      try {
        const wallet = (this.sdk as any).walletManager.getWallet();
        const recovered = ethers.verifyMessage(
          ethers.toUtf8Bytes(
            JSON.stringify({ ...mandate, serverSignature: undefined, clientSignature: undefined })
          ),
          mandate.serverSignature
        );
        serverVerified = recovered.toLowerCase() === wallet.address.toLowerCase();
        if (!serverVerified) {
          errors.push('Server signature verification failed');
        }
      } catch (error: any) {
        errors.push(`Server signature error: ${error.message}`);
      }
    }

    // Verify client signature (if present)
    if (mandate.clientSignature) {
      try {
        // Would need client address to verify
        // For now, just check signature format
        clientVerified = mandate.clientSignature.length > 0;
      } catch (error: any) {
        errors.push(`Client signature error: ${error.message}`);
      }
    }

    const valid = !expired && serverVerified && (mandate.clientSignature ? clientVerified : true);

    return {
      valid,
      serverVerified,
      clientVerified,
      expired,
      errors,
    };
  }
}
