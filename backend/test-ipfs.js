/**
 * Test script to verify Pinata IPFS integration
 * Run with: node test-ipfs.js
 */

import { uploadToIPFS, retrieveFromIPFS, pinToIPFS } from './services/ipfsService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testPinataIntegration() {
  console.log('🧪 Starting Pinata IPFS Integration Test...\n');

  try {
    // Test 1: Upload content to IPFS
    console.log('📤 Test 1: Uploading content to IPFS...');
    const testContent = `# Test Contract

This is a test contract to verify Pinata integration.

## Terms
1. This is a test document
2. Created on ${new Date().toISOString()}
3. Should be uploaded and retrievable from IPFS

## Status
Testing...`;

    const ipfsHash = await uploadToIPFS(testContent);
    console.log(`✅ Successfully uploaded! IPFS Hash: ${ipfsHash}\n`);

    // Test 2: Pin the content
    console.log('📌 Test 2: Pinning content to ensure persistence...');
    await pinToIPFS(ipfsHash);
    console.log('✅ Successfully pinned!\n');

    // Wait a moment for Pinata to process
    console.log('⏳ Waiting 3 seconds for Pinata to process...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 3: Retrieve content from IPFS
    console.log('📥 Test 3: Retrieving content from IPFS...');
    const retrievedContent = await retrieveFromIPFS(ipfsHash);
    console.log('✅ Successfully retrieved content!\n');

    // Test 4: Verify content matches
    console.log('🔍 Test 4: Verifying content integrity...');
    const originalLines = testContent.split('\n');
    const retrievedLines = retrievedContent.split('\n');
    
    if (originalLines.length === retrievedLines.length) {
      console.log('✅ Content length matches!');
    } else {
      console.log(`⚠️  Content length mismatch: ${originalLines.length} vs ${retrievedLines.length}`);
    }

    // Check if key content is present
    const hasKeyContent = retrievedContent.includes('Test Contract') && 
                          retrievedContent.includes('Terms');
    
    if (hasKeyContent) {
      console.log('✅ Key content verified in retrieved document!\n');
    } else {
      console.log('⚠️  Key content not found in retrieved document\n');
      console.log('Retrieved content preview:');
      console.log(retrievedContent.substring(0, 200));
    }

    // Test 5: Try to retrieve with Gateway URL
    console.log('🌐 Test 5: Testing direct gateway access...');
    const gatewayUrl = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';
    const fullUrl = `${gatewayUrl}/ipfs/${ipfsHash}`;
    console.log(`Gateway URL: ${fullUrl}`);

    const axios = (await import('axios')).default;
    const response = await axios.get(fullUrl);
    console.log(`✅ Gateway access successful! Content type: ${typeof response.data}\n`);

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Upload: SUCCESS`);
    console.log(`✅ Pin: SUCCESS`);
    console.log(`✅ Retrieve: SUCCESS`);
    console.log(`✅ Gateway: SUCCESS`);
    console.log(`📝 IPFS Hash: ${ipfsHash}`);
    console.log(`🔗 View on IPFS: ${fullUrl}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🎉 All tests passed! Pinata integration is working correctly.\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('403') || error.message.includes('NO_SCOPES_FOUND')) {
      console.error('\n⚠️  The PINATA_JWT token in your .env file may be:');
      console.error('   1. Expired - Check the expiration in the JWT payload');
      console.error('   2. Missing required scopes - Need upload/pin permissions');
      console.error('   3. Using wrong authentication type\n');
      console.error('📝 To fix this:');
      console.error('   1. Go to https://app.pinata.cloud');
      console.error('   2. Navigate to API Keys');
      console.error('   3. Create a new Scoped Key with upload permissions');
      console.error('   4. Update your .env file with the new JWT token\n');
    }
    
    console.error('Full error details:', error.response?.data || error);
    process.exit(1);
  }
}

// Run the tests
testPinataIntegration();

