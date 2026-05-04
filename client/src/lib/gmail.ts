const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export interface GmailMessage {
  id: string;
  snippet: string;
  body: string;
  date: string;
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPart {
  mimeType: string;
  filename?: string;
  body: {
    data?: string;
    attachmentId?: string;
  };
  parts?: GmailPart[];
}

export interface GmailMessageDetail {
  id: string;
  snippet: string;
  payload: {
    headers: GmailHeader[];
    parts?: GmailPart[];
    body?: {
      data?: string;
    };
  };
}

interface GapiResponse<T> {
  result: T;
}

interface Gapi {
  load: (name: string, callback: () => void) => void;
  client: {
    init: (args: { discoveryDocs?: string[] }) => Promise<void>;
    setToken: (token: { access_token: string } | null) => void;
    gmail: {
      users: {
        messages: {
          list: (args: { userId: string; q?: string; maxResults?: number }) => Promise<GapiResponse<{ messages?: { id: string }[] }>>;
          get: (args: { userId: string; id: string }) => Promise<GapiResponse<GmailMessageDetail>>;
          attachments: {
            get: (args: { userId: string; messageId: string; id: string }) => Promise<GapiResponse<{ data: string }>>;
          }
        }
      }
    }
  };
}

export interface TokenResponse {
  access_token: string;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
}

export interface TokenClient {
  requestAccessToken: () => void;
}

import type { Attachment } from './attachments';
import type { EmailAnalysis } from '../types';

interface Google {
  accounts: {
    oauth2: {
      initTokenClient: (config: TokenClientConfig) => TokenClient;
    };
  };
}

declare global {
  interface Window {
    gapi: Gapi;
    google: Google;
  }
}

export const initGapiClient = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!window.gapi) {
      reject(new Error("GAPI script not loaded"));
      return;
    }
    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
        });
        resolve();
      } catch (error) {
        console.error("GAPI init error:", error);
        reject(error);
      }
    });
  });
};

export const fetchGmailMessages = async (accessToken: string, workerEmail: string): Promise<GmailMessage[]> => {
  if (!window.gapi?.client?.gmail) {
    await initGapiClient();
  }

  window.gapi.client.setToken({ access_token: accessToken });

  const response = await window.gapi.client.gmail.users.messages.list({
    userId: 'me',
    q: `from:${workerEmail}`,
    maxResults: 10
  });

  const messagesMetadata = response.result.messages;
  if (!messagesMetadata) return [];

  const messages = await Promise.all(messagesMetadata.map(async (m) => {
    const detailResponse = await window.gapi.client.gmail.users.messages.get({
      userId: 'me',
      id: m.id!
    });
    const detail = detailResponse.result;

    // Extract snippet and simple text body
    let body = "";
    if (detail.payload.parts) {
      const part = detail.payload.parts.find((p: GmailPart) => p.mimeType === 'text/plain');
      if (part && part.body.data) {
        body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
    } else if (detail.payload.body && detail.payload.body.data) {
      body = atob(detail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }

    const dateHeader = detail.payload.headers.find((h: GmailHeader) => h.name === 'Date');

    return {
      id: detail.id,
      snippet: detail.snippet,
      body: body || detail.snippet,
      date: dateHeader ? dateHeader.value : ''
    };
  }));

  return messages;
};

export const initGoogleAuth = (clientId: string): Promise<TokenClient | TokenResponse> => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GMAIL_SCOPE,
        callback: (response: TokenResponse) => resolve(response),
      });
      resolve(client);
    };
    document.body.appendChild(script);
  });
};
export const analyzeEmailWithAI = async (
  msg: GmailMessage,
  attachments: Attachment[]
): Promise<EmailAnalysis> => {

  // Costruisci il contenuto multimodale per Claude
  const contentParts: object[] = [];

  // Testo email
  contentParts.push({
    type: "text",
    text: `Sei un assistente medico per un medico del lavoro italiano. 
Analizza il seguente contenuto inviato da un paziente e restituisci SOLO un JSON valido senza markdown, con questa struttura:
{
  "tipoEsame": ["lista dei tipi di esame trovati"],
  "diagnosi": "sintesi clinica in linguaggio medico, max 3 righe",
  "valoriAnomali": ["lista valori fuori range o patologie rilevanti"],
  "notePerMedico": "cosa il medico deve sapere prima della visita, max 2 righe",
  "dataEsame": "data referto se trovata, altrimenti null"
}

Contenuto email del ${msg.date}:
${msg.body}`
  });

  // Allegati PDF come documento base64
  attachments.forEach(att => {
    if (att.mimeType === 'application/pdf' && att.base64Data) {
      contentParts.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: att.base64Data
        }
      });
    }
    // Immagini (RX, ECG fotografati, ecc.)
    if (att.mimeType?.startsWith('image/') && att.base64Data) {
      contentParts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: att.mimeType,
          data: att.base64Data
        }
      });
    }
    // Testo estratto da altri allegati
    if (att.extractedText) {
      contentParts.push({
        type: "text",
        text: `\n--- ALLEGATO: ${att.filename} ---\n${att.extractedText}`
      });
    }
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: contentParts }]
    })
  });

  const data = await response.json();
  const text = data.content.map((i: {type: string; text?: string}) => i.text || "").join("");
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as EmailAnalysis;
};
