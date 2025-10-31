/**
 * IPFS Service using Pinata
 */

import { PinataSDK } from "pinata";
import axios from 'axios';

let pinata = null;
let pinataGateway = null;

// Initialize Pinata SDK and Gateway
function initPinata() {
  if (!pinata) {
    pinataGateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';
    
    // Try to use scoped key JWT first, fallback to API key + secret
    if (process.env.PINATA_JWT) {
      pinata = new PinataSDK({
        pinataJwt: process.env.PINATA_JWT,
        pinataGateway: pinataGateway
      });
      console.log('[IPFS] Pinata initialized with JWT');
    } else if (process.env.PINATA_API_KEY && process.env.PINATA_API_SECRET) {
      pinata = new PinataSDK({
        pinataApiKey: process.env.PINATA_API_KEY,
        pinataApiSecret: process.env.PINATA_API_SECRET,
        pinataGateway: pinataGateway
      });
      console.log('[IPFS] Pinata initialized with API Key/Secret');
    } else {
      throw new Error('PINATA_JWT or PINATA_API_KEY/SECRET environment variables must be set');
    }
    console.log(`[IPFS] Using gateway: ${pinataGateway}`);
  }
  return pinata;
}

/**
 * Upload contract content to IPFS via Pinata SDK
 * @param {string} content - The contract content to upload
 * @returns {Promise<string>} - The IPFS hash (CID)
 */
export async function uploadToIPFS(content) {
  const client = initPinata();

  try {
    console.log('[IPFS] Uploading content to Pinata...');
    
    // Prepare content as an object
    let uploadContent = { content: content };
    
    // Use the new SDK to upload JSON
    const result = await client.upload.public.json({
      data: uploadContent
    });

    const hash = result.cid || result.IpfsHash;
    console.log(`[IPFS] Content uploaded successfully: ${hash}`);
    return hash;
  } catch (error) {
    console.error('[IPFS] Error uploading to IPFS:', error.response?.data || error.message);
    throw new Error(`Failed to upload content to IPFS: ${error.message}`);
  }
}

/**
 * Retrieve content from IPFS via public gateway
 * @param {string} ipfsHash - The IPFS hash (CID)
 * @returns {Promise<string>} - The content
 */
export async function retrieveFromIPFS(ipfsHash) {
  initPinata(); // Ensure gateway is initialized
  
  try {
    console.log(`[IPFS] Retrieving content from IPFS: ${ipfsHash}`);
    
    // Use the configured gateway
    const gatewayUrl = `${pinataGateway}/ipfs/${ipfsHash}`;
    const response = await axios.get(gatewayUrl);

    const content = response.data;
    
    // Handle the content based on its structure
    if (typeof content === 'string') {
    console.log(`[IPFS] Successfully retrieved ${content.length} bytes`);
      return content;
    } else if (content && content.content) {
      // If it's wrapped in an object with a 'content' property, extract it
      console.log(`[IPFS] Successfully retrieved wrapped content`);
      return content.content;
    } else {
      // Otherwise stringify the object
      console.log(`[IPFS] Successfully retrieved object content`);
      return JSON.stringify(content);
    }
  } catch (error) {
    console.error('[IPFS] Error retrieving from IPFS:', error.response?.data || error.message);
    throw new Error(`Failed to retrieve content from IPFS: ${error.message}`);
  }
}

/**
 * Pin content to IPFS to ensure it persists on Pinata
 * Note: With the new SDK, content is already pinned during upload
 * @param {string} ipfsHash - The IPFS hash (CID) to pin
 * @returns {Promise<void>}
 */
export async function pinToIPFS(ipfsHash) {
  const client = initPinata();

  try {
    console.log(`[IPFS] Content already pinned during upload: ${ipfsHash}`);
    // With the new SDK, content is automatically pinned when uploaded
    // This is a no-op for compatibility
  } catch (error) {
    console.error('[IPFS] Error pinning to IPFS:', error.response?.data || error.message);
    // Don't throw - pinning failure shouldn't break the flow
    console.warn('[IPFS] Pinning failed but continuing');
  }
}
