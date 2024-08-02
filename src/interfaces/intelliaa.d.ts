import { bo } from "@upstash/redis/zmscore-80635339";

export interface Assistant {
  id: string;
  name: string;
  type_assistant: string;
  template_id: string;
  account_id: string;
  namespace: string;
  document_id: string;
  prompt: string;
  temperature: number;
  token: number;
  activated_whatsapp: boolean;
  docs_keys: [];
  activated_whatsApp: boolean;
  keyword_transfer_ws: string;
  number_transfer_ws: string;
  qr_url: string;
  is_deploying_ws: boolean;
  service_id_rw: string;
  welcome_assistant: string;
  voice_assistant: string;
  detect_emotion: boolean;
  background_office: boolean;
  record_call: boolean;
  voice_assistant_id: string;
  documents_vapi: string[];
}

export interface Pdf_Doc {
  id: string;
  name: string;
  description?: string;
  s3_key: string;
  url: string;
  account_id: string;
  id_vapi_doc: string;
}

export interface Message {
  id?: string;
  role: "userMessage" | "apiMessage" | "systemMessage";
  chatflowid?: string;
  content: string;
  sourceDocuments?: string[];
  usedTools?: string[];
  fileAnnotations?: string[];
  fileUploads?: string[];
  chatType?: "EXTERNAL" | "INTERNAL";
  chatId?: string;
  memoryType?: string;
  sessionId?: string;
  createdDate?: string;
}

export interface Messages {
  messages: Message[];
}

export interface Prediction {
  question: string;
  socketIOClientId?: string;
  overrideConfig: {
    sessionId?: string;
    systemMessage?: string;
    supabaseMetadataFilter?: supabaseMetadataFilter;
    temperature: number;
    maxTokens: number;
  };
}

export interface AssistantTemplate {
  id: string;
  name: string;
  image_url: string;
  prompt: string;
  s3_key: string;
  temperature: number;
  tokens: number;
  docs_key: [];
}

export interface QAItem {
  id: string;
  question: string;
  answer: string;
  id_document: string;
  namespace: string;
}
