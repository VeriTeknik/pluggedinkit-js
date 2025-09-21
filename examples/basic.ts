/**
 * Basic Usage Example
 *
 * This example demonstrates the basic usage of the Plugged.in SDK
 */

import { PluggedInClient } from '@pluggedin/library-sdk';

async function main() {
  // Initialize the client
  const client = new PluggedInClient({
    apiKey: process.env.PLUGGEDIN_API_KEY || 'your-api-key',
    baseUrl: 'http://localhost:12005',
    debug: true // Enable debug logging
  });

  try {
    // 1. List all documents
    console.log('\n📄 Listing documents...');
    const documents = await client.documents.list({
      limit: 5,
      sort: 'date_desc'
    });

    console.log(`Found ${documents.total} total documents`);
    documents.documents.forEach(doc => {
      console.log(`- ${doc.title} (${doc.source})`);
    });

    // 2. Search for documents
    console.log('\n🔍 Searching documents...');
    const searchResults = await client.documents.search('api', {
      source: 'all'
    }, 3);

    console.log(`Found ${searchResults.total} matching documents`);
    searchResults.results.forEach(result => {
      console.log(`- ${result.title} (score: ${result.relevanceScore})`);
    });

    // 3. Query the knowledge base
    console.log('\n🤖 Querying knowledge base...');
    const answer = await client.rag.askQuestion(
      'What are the main features of the platform?'
    );
    console.log('Answer:', answer);

    // 4. Get RAG availability status
    console.log('\n✅ Checking RAG availability...');
    const ragStatus = await client.rag.checkAvailability();
    console.log('RAG available:', ragStatus.available);
    if (ragStatus.message) {
      console.log('Status:', ragStatus.message);
    }

    // 5. Get a specific document (if documents exist)
    if (documents.documents.length > 0) {
      console.log('\n📖 Getting document details...');
      const firstDoc = documents.documents[0];
      const fullDoc = await client.documents.get(firstDoc.id, {
        includeContent: false, // Don't include content for this example
        includeVersions: true
      });

      console.log(`Document: ${fullDoc.title}`);
      console.log(`Version: ${fullDoc.version}`);
      console.log(`Created: ${fullDoc.createdAt}`);
      console.log(`Tags: ${fullDoc.tags.join(', ') || 'None'}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
main().catch(console.error);