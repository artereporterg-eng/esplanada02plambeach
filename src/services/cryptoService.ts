
/**
 * Service to handle RSA digital signatures for documents
 */
export class CryptoService {
  private static PUBLIC_KEY_STORAGE_KEY = 'rsa_public_key';
  private static PRIVATE_KEY_STORAGE_KEY = 'rsa_private_key';

  /**
   * Generates a new RSA Key Pair if not already existing
   */
  static async ensureKeys(): Promise<{ publicKey: string; privateKey: string }> {
    const existingPublic = localStorage.getItem(this.PUBLIC_KEY_STORAGE_KEY);
    const existingPrivate = localStorage.getItem(this.PRIVATE_KEY_STORAGE_KEY);

    if (existingPublic && existingPrivate) {
      return { publicKey: existingPublic, privateKey: existingPrivate };
    }

    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify']
    );

    const publicKeyExported = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKeyExported = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    const publicKeyPem = this.arrayBufferToBase64(publicKeyExported);
    const privateKeyPem = this.arrayBufferToBase64(privateKeyExported);

    localStorage.setItem(this.PUBLIC_KEY_STORAGE_KEY, publicKeyPem);
    localStorage.setItem(this.PRIVATE_KEY_STORAGE_KEY, privateKeyPem);

    return { publicKey: publicKeyPem, privateKey: privateKeyPem };
  }

  /**
   * Signs a document object
   */
  static async signData(data: any): Promise<string> {
    const { privateKey } = await this.ensureKeys();
    
    // Create a stable string representation
    // We remove the signature if it exists to sign the core data
    const { signature, ...cleanData } = data;
    const dataString = JSON.stringify(cleanData, Object.keys(cleanData).sort());
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(dataString);

    const privateKeyBuffer = this.base64ToArrayBuffer(privateKey);
    const cryptoKey = await window.crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    const signatureBuffer = await window.crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      encodedData
    );

    return this.arrayBufferToBase64(signatureBuffer);
  }

  /**
   * Verifies a document object's signature
   */
  static async verifyData(data: any, signature: string): Promise<boolean> {
    const { publicKey } = await this.ensureKeys();
    
    const { signature: _, ...cleanData } = data;
    const dataString = JSON.stringify(cleanData, Object.keys(cleanData).sort());
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(dataString);

    const publicKeyBuffer = this.base64ToArrayBuffer(publicKey);
    const cryptoKey = await window.crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['verify']
    );

    const signatureBuffer = this.base64ToArrayBuffer(signature);
    
    return await window.crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signatureBuffer,
      encodedData
    );
  }

  /**
   * Returns a shortened hash for UI display
   */
  static getShortHash(signature: string): string {
    if (!signature) return 'N/A';
    return signature.slice(0, 8) + '...' + signature.slice(-8);
  }

  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
