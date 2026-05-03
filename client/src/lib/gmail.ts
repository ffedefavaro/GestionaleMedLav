const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export interface GmailMessage {
  id: string;
  snippet: string;
  body: string;
  date: string;
}

interface GapiResponse<T> {
  result: T;
}

interface GmailListResponse {
  messages?: { id: string }[];
}

interface GmailMessageDetail {
  id: string;
  snippet: string;
  payload: {
    parts?: { mimeType: string; body: { data?: string } }[];
    body?: { data?: string };
    headers: { name: string; value: string }[];
  };
}

export const initGoogleAuth = (clientId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const gapi = (window as any).gapi;
    if (!gapi) {
      reject(new Error("GAPI library not found"));
      return;
    }

    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          clientId: clientId,
          scope: GMAIL_SCOPE,
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"]
        });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
};

export const fetchGmailMessages = async (_accessToken: string, workerEmail: string): Promise<GmailMessage[]> => {
  const gapi = (window as any).gapi;
  if (!gapi || !gapi.client || !gapi.client.gmail) {
    throw new Error("GAPI client not initialized");
  }

  const query = `from:${workerEmail}`;
  const listRes: GapiResponse<GmailListResponse> = await gapi.client.gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 10
  });

  const messagesMetadata = listRes.result.messages;
  if (!messagesMetadata) return [];

  const messages = await Promise.all(messagesMetadata.map(async (m) => {
    const detailRes: GapiResponse<GmailMessageDetail> = await gapi.client.gmail.users.messages.get({
      userId: 'me',
      id: m.id
    });
    const detail = detailRes.result;

    let body = "";
    if (detail.payload.parts) {
      const part = detail.payload.parts.find(p => p.mimeType === 'text/plain');
      if (part && part.body.data) {
        body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
    } else if (detail.payload.body && detail.payload.body.data) {
      body = atob(detail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }

    const dateHeader = detail.payload.headers.find(h => h.name === 'Date');

    return {
      id: detail.id,
      snippet: detail.snippet,
      body: body || detail.snippet,
      date: dateHeader ? dateHeader.value : ''
    };
  }));

  return messages;
};
