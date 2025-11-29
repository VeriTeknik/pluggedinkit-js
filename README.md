# Plugged.in JavaScript/TypeScript SDK

[![npm version](https://badge.fury.io/js/pluggedinkit-js.svg)](https://www.npmjs.com/package/pluggedinkit-js)
[![Node.js Version](https://img.shields.io/node/v/pluggedinkit-js.svg)](https://www.npmjs.com/package/pluggedinkit-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official JavaScript/TypeScript SDK for the Plugged.in Library API. Easily interact with document management, RAG (Retrieval-Augmented Generation) capabilities, and file uploads.

**NPM**: [https://www.npmjs.com/package/pluggedinkit-js](https://www.npmjs.com/package/pluggedinkit-js)

## Installation

```bash
npm install pluggedinkit-js
# or
yarn add pluggedinkit-js
# or
pnpm add pluggedinkit-js
```

## Quick Start

```typescript
import { PluggedInClient } from 'pluggedinkit-js';

// Initialize the client
const client = new PluggedInClient({
  apiKey: 'your-api-key',
  // baseUrl is optional, defaults to https://plugged.in
});

// List documents
const documents = await client.documents.list({
  limit: 10,
  source: 'all'
});

// Search documents semantically
const results = await client.documents.search('machine learning', {
  tags: ['ai', 'ml'],
  dateFrom: '2024-01-01T00:00:00Z'
});

// Query knowledge base
const answer = await client.rag.query('What is the latest update on the project?');
```

## Features

- 📄 **Document Management** - Full CRUD operations for documents
- 🔍 **Semantic Search** - AI-powered document search
- 🤖 **RAG Integration** - Query your knowledge base with natural language
- 📋 **Clipboard/Memory** - Persistent key-value storage for MCP tools and AI agents
- 📤 **File Uploads** - Upload files with progress tracking
- 🔄 **Version Control** - Document versioning and history
- ⚡ **Type Safety** - Full TypeScript support with comprehensive types
- 🔐 **Authentication** - Secure API key authentication
- 🔁 **Retry Logic** - Automatic retries with exponential backoff
- 📊 **Rate Limiting** - Built-in rate limit handling

## Authentication

Get your API key from your Plugged.in profile settings and initialize the client:

```typescript
const client = new PluggedInClient({
  apiKey: process.env.PLUGGEDIN_API_KEY,
  // baseUrl defaults to https://plugged.in
  // For local development, use: baseUrl: 'http://localhost:12005'
});
```

## Documentation

### Document Operations

#### List Documents

```typescript
const response = await client.documents.list({
  source: 'ai_generated',
  tags: ['report', 'analysis'],
  sort: 'date_desc',
  limit: 20,
  offset: 0
});

console.log(`Found ${response.total} documents`);
response.documents.forEach(doc => {
  console.log(`- ${doc.title} (${doc.fileSize} bytes)`);
});
```

#### Get Document

```typescript
// Get document metadata
const doc = await client.documents.get('document-id');

// Get document with content
const docWithContent = await client.documents.get('document-id', {
  includeContent: true,
  includeVersions: true
});

console.log(docWithContent.content);
```

#### Search Documents

```typescript
const searchResults = await client.documents.search('quarterly report', {
  modelProvider: 'anthropic',
  dateFrom: '2024-01-01T00:00:00Z',
  tags: ['finance', 'q4']
}, 10, 0);

searchResults.results.forEach(result => {
  console.log(`${result.title} (relevance: ${result.relevanceScore})`);
  console.log(`  Snippet: ${result.snippet}`);
});
```

#### Update Document

```typescript
const updateResult = await client.documents.update('document-id', {
  operation: 'append',
  content: '\n\n## New Section\n\nAdditional content here.',
  metadata: {
    changeSummary: 'Added new section on implementation details',
    model: {
      name: 'claude-3-opus',
      provider: 'anthropic',
      version: '20240229'
    }
  }
});

console.log(`Document updated to version ${updateResult.version}`);
```

#### Create AI-Generated Document

```typescript
const newDoc = await client.documents.create(
  'API Integration Guide',
  '# API Integration Guide\n\n## Introduction\n\n...',
  {
    format: 'md',
    category: 'documentation',
    tags: ['api', 'integration', 'guide'],
    model: {
      name: 'gpt-4',
      provider: 'openai',
      version: '0613'
    },
    prompt: 'Create a comprehensive API integration guide',
    visibility: 'workspace'
  }
);

console.log(`Created document: ${newDoc.id}`);
```

### RAG Operations

#### Query Knowledge Base

```typescript
// Simple query
const answer = await client.rag.askQuestion('What are our deployment procedures?');
console.log(answer);

// Query with source documents
const { answer, sources } = await client.rag.queryWithSources(
  'Explain the authentication flow',
  'project-uuid' // Optional project scope
);

console.log('Answer:', answer);
console.log('Sources:');
sources.forEach(source => {
  console.log(`- ${source.name} (relevance: ${source.relevance}%)`);
});
```

#### Find Relevant Documents

```typescript
const relevantDocs = await client.rag.findRelevantDocuments(
  'user authentication',
  'project-uuid',
  5 // Return top 5 documents
);

relevantDocs.forEach(doc => {
  console.log(`- ${doc.name}`);
  if (doc.model) {
    console.log(`  Created by: ${doc.model.provider}/${doc.model.name}`);
  }
});
```

### File Upload Operations

#### Upload Single File

```typescript
// Node.js example with fs
import fs from 'fs';

const fileBuffer = fs.readFileSync('./report.pdf');
const uploadResult = await client.uploads.uploadFile(
  fileBuffer,
  {
    name: 'Q4 Report.pdf',
    description: 'Quarterly financial report',
    tags: ['finance', 'q4', '2024'],
    purpose: 'Financial documentation',
    relatedTo: 'PROJECT-123'
  },
  (progress) => {
    console.log(`Upload progress: ${progress}%`);
  }
);

if (uploadResult.success) {
  console.log(`File uploaded successfully: ${uploadResult.documentId}`);

  // Track RAG processing if applicable
  if (uploadResult.uploadId) {
    await client.uploads.trackUpload(
      uploadResult.uploadId,
      (status) => {
        console.log(`Processing: ${status.status} - ${status.message}`);
      }
    );
  }
}
```

#### Browser File Upload

```typescript
// Browser example with File API
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const file = fileInput.files[0];

const result = await client.uploads.uploadFile(
  file,
  {
    name: file.name,
    description: 'User uploaded document',
    tags: ['user-upload']
  },
  (progress) => {
    updateProgressBar(progress);
  }
);
```

#### Batch Upload

```typescript
const files = [
  { file: file1, metadata: { name: 'doc1.pdf', tags: ['batch'] }},
  { file: file2, metadata: { name: 'doc2.txt', tags: ['batch'] }},
  { file: file3, metadata: { name: 'doc3.md', tags: ['batch'] }}
];

const results = await client.uploads.uploadBatch(
  files,
  (current, total) => {
    console.log(`Uploaded ${current}/${total} files`);
  }
);

results.forEach((result, index) => {
  if (result.success) {
    console.log(`✓ ${files[index].metadata.name} uploaded`);
  } else {
    console.log(`✗ ${files[index].metadata.name} failed: ${result.error}`);
  }
});
```

### Clipboard Operations

The clipboard provides persistent key-value storage for MCP tools and AI agents.

#### Set Named Entry

```typescript
const entry = await client.clipboard.set({
  name: 'user_preferences',
  value: JSON.stringify({ theme: 'dark', lang: 'en' }),
  contentType: 'application/json',
  encoding: 'utf-8',
  visibility: 'private',
  ttlSeconds: 86400 // 24 hours
});

console.log(`Created entry: ${entry.uuid}`);
console.log(`Source: ${entry.source}`); // 'sdk' - automatically set
```

#### Get Entry

```typescript
// By name
const entry = await client.clipboard.getByName('user_preferences');
console.log(entry.value);

// By index (stack access)
const latest = await client.clipboard.getByIndex(0);
```

#### Push to Stack

```typescript
const entry = await client.clipboard.push({
  value: 'Processing step 1 result',
  contentType: 'text/plain'
});

console.log(`Pushed to index: ${entry.idx}`);
```

#### Pop from Stack

```typescript
const entry = await client.clipboard.pop();
if (entry) {
  console.log(`Popped value: ${entry.value}`);
}
```

#### List and Delete

```typescript
// List all entries
const { entries, total } = await client.clipboard.list();
entries.forEach(entry => {
  console.log(`${entry.name || `idx:${entry.idx}`} - source: ${entry.source}`);
});

// Delete by name
await client.clipboard.delete({ name: 'old_entry' });

// Clear all
await client.clipboard.clearAll();
```

#### Clipboard Entry Structure

```typescript
interface ClipboardEntry {
  uuid: string;
  name: string | null;           // Semantic key
  idx: number | null;            // Stack index
  value: string;
  contentType: string;
  encoding: 'utf-8' | 'base64' | 'hex';
  sizeBytes: number;
  visibility: 'private' | 'workspace' | 'public';
  createdByTool: string | null;
  createdByModel: string | null;
  source?: 'ui' | 'sdk' | 'mcp'; // Auto-set based on creation method
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}
```

> **Note**: The `source` field is automatically set to `'sdk'` when using this SDK. It indicates how the entry was created (UI, SDK, or MCP proxy).

### Error Handling

The SDK provides typed error classes for better error handling:

```typescript
import {
  PluggedInError,
  AuthenticationError,
  RateLimitError,
  NotFoundError
} from 'pluggedinkit-js';

try {
  const doc = await client.documents.get('invalid-id');
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
    // Refresh API key
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter} seconds`);
    // Wait and retry
  } else if (error instanceof NotFoundError) {
    console.error('Document not found');
  } else if (error instanceof PluggedInError) {
    console.error(`API error: ${error.message}`);
    console.error('Details:', error.details);
  }
}
```

### Advanced Configuration

```typescript
const client = new PluggedInClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.plugged.in',
  timeout: 60000, // 60 seconds
  maxRetries: 5,
  debug: true // Enable debug logging
});

// Update API key at runtime
client.setApiKey('new-api-key');

// Get current configuration
const config = client.getConfig();
```

## Environment Variables

For security, store your API key in environment variables:

```bash
# .env
PLUGGEDIN_API_KEY=your-api-key
PLUGGEDIN_BASE_URL=https://api.plugged.in
```

```typescript
const client = new PluggedInClient({
  apiKey: process.env.PLUGGEDIN_API_KEY!,
  baseUrl: process.env.PLUGGEDIN_BASE_URL
});
```

## Rate Limiting

The SDK automatically handles rate limiting with exponential backoff:

- **API Endpoints**: 60 requests per minute
- **Document Search**: 10 requests per hour for AI document creation
- **RAG Queries**: Subject to plan limits

## TypeScript Support

The SDK is written in TypeScript and provides comprehensive type definitions:

```typescript
import type {
  Document,
  DocumentFilters,
  RagResponse,
  UploadMetadata
} from 'pluggedinkit-js';

// All types are fully documented with JSDoc comments
const filters: DocumentFilters = {
  source: 'ai_generated',
  tags: ['important'],
  sort: 'date_desc'
};
```

## Examples

See the [examples](./examples) directory for complete working examples:

- [Basic Usage](./examples/basic.ts)
- [Document Management](./examples/documents.ts)
- [RAG Queries](./examples/rag.ts)
- [File Upload](./examples/upload.ts)
- [Error Handling](./examples/errors.ts)
- [Browser Usage](./examples/browser.html)

## Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT - see [LICENSE](LICENSE) for details.

## Support

- **NPM Package**: [https://www.npmjs.com/package/pluggedinkit-js](https://www.npmjs.com/package/pluggedinkit-js)
- **GitHub Repository**: [https://github.com/VeriTeknik/pluggedinkit-js](https://github.com/VeriTeknik/pluggedinkit-js)
- **Documentation**: [https://docs.plugged.in](https://docs.plugged.in)
- **Issues**: [GitHub Issues](https://github.com/VeriTeknik/pluggedinkit-js/issues)
- **Discord**: [Join our community](https://discord.gg/pluggedin)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.