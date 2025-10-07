# INT-45: Implement Vercel AI SDK for WhatsApp Conversations with RAG

**Epic**: INT-43 - WhatsApp Evolution API Migration
**Priority**: P0 - Must Have
**Estimate**: 8-13 points (XL)
**Labels**: backend, ai, rag, whatsapp, vercel-ai-sdk

## User Story

As a WhatsApp assistant, I want to use Vercel AI SDK with RAG (Retrieval-Augmented Generation) to provide intelligent, context-aware responses using document knowledge bases, so that I can answer questions accurately based on uploaded documents.

## Acceptance Criteria

### AC1: Message Reception and Processing
**Given** a WhatsApp message is received via Evolution API webhook
**When** processing the message
**Then** system extracts text, sender info, and conversation context within 100ms

### AC2: RAG Document Retrieval
**Given** a user question about stored documents
**When** generating a response
**Then** system retrieves top 3 relevant document chunks from Pinecone/Upstash based on semantic similarity

### AC3: Streaming AI Responses
**Given** the AI is generating a response
**When** using Vercel AI SDK
**Then** response streams in real-time to WhatsApp (chunks sent as they're generated for responses >200 chars)

### AC4: Conversation Memory
**Given** an ongoing WhatsApp conversation
**When** processing subsequent messages
**Then** system maintains last 10 messages as context for coherent multi-turn conversations

### AC5: Source Attribution
**Given** AI uses documents to answer
**When** response is sent
**Then** system includes source attribution (e.g., "According to your Product Manual, page 5...")

### AC6: Fallback Handling
**Given** no relevant documents are found
**When** user asks a question
**Then** AI responds based on general knowledge with disclaimer: "I don't have specific information about this in your documents."

### AC7: Media Message Handling
**Given** user sends image, audio, or document
**When** processing the message
**Then** system extracts text (OCR for images, transcription for audio) and processes it through RAG pipeline

## Technical Notes

### Vercel AI SDK Integration
```typescript
// src/services/whatsappAiService.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { retrieveDocuments } from './ragService';

export async function generateWhatsAppResponse(
  message: string,
  assistantId: string,
  conversationHistory: Message[]
) {
  // Retrieve relevant documents
  const relevantDocs = await retrieveDocuments({
    query: message,
    assistantId,
    topK: 3,
  });

  // Build context from documents
  const context = relevantDocs
    .map((doc) => `[${doc.source}]: ${doc.content}`)
    .join('\n\n');

  // Build conversation context
  const messages = [
    {
      role: 'system',
      content: `You are a helpful WhatsApp assistant. Use the following context to answer questions:\n\n${context}\n\nIf the answer is not in the context, say so clearly.`,
    },
    ...conversationHistory.slice(-10), // Last 10 messages
    {
      role: 'user',
      content: message,
    },
  ];

  // Generate streaming response
  const result = await streamText({
    model: openai('gpt-4-turbo'),
    messages,
    temperature: 0.7,
    maxTokens: 500,
  });

  return result;
}
```

### RAG Service with Pinecone/Upstash
```typescript
// src/services/ragService.ts
import { Pinecone } from '@pinecone-database/pinecone';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index(process.env.PINECONE_INDEX);

export async function retrieveDocuments({
  query,
  assistantId,
  topK = 3,
}: RetrieveParams) {
  // Generate query embedding
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-ada-002'),
    value: query,
  });

  // Search Pinecone
  const results = await index.namespace(assistantId).query({
    vector: embedding,
    topK,
    includeMetadata: true,
  });

  return results.matches.map((match) => ({
    content: match.metadata.text,
    source: match.metadata.source,
    score: match.score,
  }));
}
```

### WhatsApp Webhook Handler
```typescript
// src/app/api/webhooks/whatsapp/message/route.ts
export async function POST(request: Request) {
  const webhook = await request.json();

  // Extract message data
  const { instance, data } = webhook;
  const message = data.message;
  const from = data.key.remoteJid;

  // Get assistant by instance name
  const assistant = await getAssistantByInstanceName(instance);

  // Get conversation history
  const history = await getConversationHistory(assistant.id, from);

  // Generate AI response
  const responseStream = await generateWhatsAppResponse(
    message.conversation || message.extendedTextMessage?.text,
    assistant.id,
    history
  );

  // Send response via Evolution API
  let fullResponse = '';
  for await (const chunk of responseStream.textStream) {
    fullResponse += chunk;
    
    // Send chunk if response is getting long
    if (fullResponse.length > 200) {
      await sendWhatsAppMessage(instance, from, fullResponse);
      fullResponse = '';
    }
  }

  // Send remaining response
  if (fullResponse) {
    await sendWhatsAppMessage(instance, from, fullResponse);
  }

  // Store conversation
  await storeConversation(assistant.id, from, message, fullResponse);

  return NextResponse.json({ success: true });
}
```

### Send WhatsApp Message via Evolution API
```typescript
// src/services/evolutionApiService.ts (continued)
async sendMessage(instanceName: string, to: string, text: string) {
  await this.client.post(`/message/sendText/${instanceName}`, {
    number: to,
    text,
  });
}

async sendMedia(instanceName: string, to: string, mediaUrl: string, caption?: string) {
  await this.client.post(`/message/sendMedia/${instanceName}`, {
    number: to,
    mediaUrl,
    caption,
  });
}
```

### Conversation Storage
```sql
CREATE TABLE whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID REFERENCES assistants(id) ON DELETE CASCADE,
  phone_number VARCHAR(50),
  message_type VARCHAR(20), -- 'incoming', 'outgoing'
  message_content TEXT,
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_conversations_assistant_phone 
  ON whatsapp_conversations(assistant_id, phone_number, created_at DESC);
```

### Media Processing
```typescript
// Handle images with OCR
async function processImageMessage(imageUrl: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-vision-preview',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract all text from this image' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
  });

  return response.choices[0].message.content;
}

// Handle audio with Whisper
async function processAudioMessage(audioUrl: string) {
  const audioBuffer = await fetch(audioUrl).then((r) => r.arrayBuffer());
  const transcription = await openai.audio.transcriptions.create({
    file: new File([audioBuffer], 'audio.ogg'),
    model: 'whisper-1',
  });

  return transcription.text;
}
```

## Definition of Done

- [ ] Vercel AI SDK integrated with OpenAI
- [ ] Message reception from Evolution API webhooks working
- [ ] RAG document retrieval from Pinecone/Upstash functional
- [ ] Streaming responses implemented
- [ ] Conversation memory (10 messages) working
- [ ] Source attribution in responses
- [ ] Fallback handling for missing documents
- [ ] Media processing (images, audio) implemented
- [ ] Conversation storage created
- [ ] WhatsApp message sending via Evolution API working
- [ ] Testing completed with real WhatsApp conversations
- [ ] Performance optimized (< 3s response time)
- [ ] Error handling and retry logic implemented
- [ ] Code reviewed and merged

## Dependencies

- **Requires**: INT-44 (Evolution API for message sending)
- **Requires**: Document storage with Pinecone/Upstash
- **Requires**: INTEL-001, INTEL-003 (Embedding and vector services)
- OpenAI API access

## Related Stories

- **Depends on**: INT-44 (Evolution API instance)
- **Uses**: INTEL-001 (Embedding service)
- **Uses**: INTEL-003 (Vector store)
- **Replaces**: Flowise integration for WhatsApp
