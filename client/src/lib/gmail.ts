const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export interface GmailMessage {
  id: string;
  snippet: string;
  body: string;
  date: string;
}

export const initGoogleAuth = (clientId: string) => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      const client = (window as unknown as { google?: { accounts?: { oauth2?: { initTokenClient: (config: { client_id: string; scope: string; callback: (response: unknown) => void }) => unknown } } } }).google?.accounts?.oauth2?.initTokenClient({
        client_id: clientId,
        scope: GMAIL_SCOPE,
        callback: (response: unknown) => resolve(response),
      });
      resolve(client);
    };
    document.body.appendChild(script);
  });
};

export const fetchGmailMessages = async (accessToken: string, workerEmail: string): Promise<GmailMessage[]> => {
  const query = encodeURIComponent(`from:${workerEmail}`);
  const response = await fetch(`https://gmail.googleapis.com/v1/users/me/messages?q=${query}&maxResults=10`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const data = await response.json() as { messages?: Array<{ id: string }> };
  if (!data.messages) return [];

  const messages = await Promise.all(data.messages.map(async (m) => {
    const detailRes = await fetch(`https://gmail.googleapis.com/v1/users/me/messages/${m.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const detail = await detailRes.json() as { 
      id: string; 
      snippet: string; 
      payload?: { 
        parts?: Array<{ mimeType: string; body?: { data: string } }>; 
        headers?: Array<{ name: string; value: string }>;
        body?: { data: string };
      }
    };

    // Extract snippet and simple text body
    let body = "";
    if (detail.payload?.parts) {
      const part = detail.payload.parts.find((p) => p.mimeType === 'text/plain');
      if (part && part.body?.data) {
        body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
    } else if (detail.payload?.body?.data) {
      body = atob(detail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }

    const dateHeader = detail.payload?.headers?.find((h) => h.name === 'Date');

    return {
      id: detail.id,
      snippet: detail.snippet,
      body: body || detail.snippet,
      date: dateHeader ? dateHeader.value : ''
    };
  }));

  return messages;
};
