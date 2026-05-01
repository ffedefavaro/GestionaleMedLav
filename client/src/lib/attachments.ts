import type { TextItem } from 'pdfjs-dist/types/src/display/api';

export const extractTextFromPDF = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  const pdfjsLib = await import('pdfjs-dist');
  // Configure worker with a reliable CDN matching installed version
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.6.205/pdf.worker.min.mjs`;

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => (item as TextItem).str || '')
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
};

interface GmailAttachment {
  filename: string;
  mimeType: string;
  data: Uint8Array;
  extractedText?: string;
}

interface GmailAttachmentPart {
  filename: string;
  mimeType: string;
  body: { attachmentId: string };
}

export const fetchGmailAttachments = async (accessToken: string, messageId: string): Promise<GmailAttachment[]> => {
  const response = await fetch(`https://gmail.googleapis.com/v1/users/me/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const detail = (await response.json()) as { payload: { parts?: GmailAttachmentPart[] } };

  if (!detail.payload.parts) return [];

  const attachmentParts = detail.payload.parts.filter((p) => p.filename && p.body.attachmentId);

  const attachments = await Promise.all(attachmentParts.map(async (part) => {
    const attachRes = await fetch(
      `https://gmail.googleapis.com/v1/users/me/messages/${messageId}/attachments/${part.body.attachmentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const attachData = await attachRes.json();
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
      filename: part.filename,
      mimeType: part.mimeType,
      data: bytes,
      extractedText
    };
  }));

  return attachments;
};
