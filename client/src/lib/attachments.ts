import * as pdfjsLib from 'pdfjs-dist';

// Configure worker with a reliable CDN matching installed version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.6.205/pdf.worker.min.mjs`;

export const extractTextFromPDF = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
};

export const fetchGmailAttachments = async (accessToken: string, messageId: string): Promise<any[]> => {
  const response = await fetch(`https://gmail.googleapis.com/v1/users/me/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const detail = await response.json();

  if (!detail.payload.parts) return [];

  const attachmentParts = detail.payload.parts.filter((p: any) => p.filename && p.body.attachmentId);

  const attachments = await Promise.all(attachmentParts.map(async (part: any) => {
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
