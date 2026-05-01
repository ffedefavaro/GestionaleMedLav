const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export interface GmailMessage {
  id: string;
  snippet: string;
  body: string;
  date: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export const initGoogleAuth = (clientId: string) => {
  return new Promise((resolve) => {
    const client = (window as unknown as { google: { accounts: { oauth2: { initTokenClient: (config: { client_id: string, scope: string, callback: (response: GoogleTokenResponse) => void }) => unknown } } } }).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPE,
      callback: (response: GoogleTokenResponse) => resolve(response),
    });
    resolve(client);
  });
};

interface GmailListResponse {
  messages?: { id: string, threadId: string }[];
  resultSizeEstimate: number;
}

interface GmailMessagePart {
  mimeType: string;
  body: { data?: string };
  parts?: GmailMessagePart[];
}

interface GmailMessageDetail {
  id: string;
  snippet: string;
  payload: {
    parts?: GmailMessagePart[];
    body?: { data?: string };
    headers: { name: string, value: string }[];
  };
}

export const fetchGmailMessages = async (accessToken: string, workerEmail: string): Promise<GmailMessage[]> => {
  const query = encodeURIComponent(`from:${workerEmail}`);
  const response = await fetch(`https://gmail.googleapis.com/v1/users/me/messages?q=${query}&maxResults=10`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const data = (await response.json()) as GmailListResponse;
  if (!data.messages) return [];

  const messages = await Promise.all(data.messages.map(async (m) => {
    const detailRes = await fetch(`https://gmail.googleapis.com/v1/users/me/messages/${m.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const detail = (await detailRes.json()) as GmailMessageDetail;

    // Extract snippet and simple text body
    let body = "";
    if (detail.payload.parts) {
      const part = detail.payload.parts.find((p) => p.mimeType === 'text/plain');
      if (part && part.body.data) {
        body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
    } else if (detail.payload.body && detail.payload.body.data) {
      body = atob(detail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }

    const dateHeader = detail.payload.headers.find((h) => h.name === 'Date');

    return {
      id: detail.id,
      snippet: detail.snippet,
      body: body || detail.snippet,
      date: dateHeader ? dateHeader.value : ''
    };
  }));

  return messages;
};
