import * as pdfjsLib from 'pdfjs-dist';
import { initGapiClient, type GmailMessageDetail, type GmailPart } from './gmail';

// Configure worker with a reliable CDN matching installed version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.6.205/pdf.worker.min.mjs`;

export interface Attachment {
  filename: string;
  mimeType: string;
  data: Uint8Array;
  extractedText: string;
}

export const extractTextFromPDF = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // Use proper typing for textContent.items
    const pageText = textContent.items.map((item) => {
      if ('str' in item) return (item as { str: string }).str;
      return '';
    }).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
};

export const fetchGmailAttachments = async (accessToken: string, messageId: string): Promise<Attachment[]> => {
  if (!window.gapi?.client?.gmail) {
    await initGapiClient();
  }

  window.gapi.client.setToken({ access_token: accessToken });

  const detailRes = await window.gapi.client.gmail.users.messages.get({
    userId: 'me',
    id: messageId
  });
  const detail: GmailMessageDetail = detailRes.result;

  if (!detail.payload.parts) return [];

  const attachmentParts = detail.payload.parts.filter((p: GmailPart) => p.filename && p.body.attachmentId);

  const attachments = await Promise.all(attachmentParts.map(async (part: GmailPart) => {
    const attachRes = await window.gapi.client.gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: part.body.attachmentId!
    });
    const attachData = attachRes.result;

    const binaryData = atob(attachData.data.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }

    let extractedText = '';
    if (part.mimeType === 'application/pdf') {
      try {
        extractedText = await extractTextFromPDF(bytes.buffer);
      } catch (e) {
        console.error("PDF Extraction failed", e);
      }
    }

    return {
      filename: part.filename!,
      mimeType: part.mimeType,
      data: bytes,
      extractedText
    };
  }));

  return attachments;
};
