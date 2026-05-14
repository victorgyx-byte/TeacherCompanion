declare module "pdf-parse" {
  type PdfParseResult = {
    text?: string;
    [key: string]: unknown;
  };

  export default function pdfParse(dataBuffer: Uint8Array | Buffer): Promise<PdfParseResult>;
}

declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = {
    text?: string;
    [key: string]: unknown;
  };

  export default function pdfParse(dataBuffer: Uint8Array | Buffer): Promise<PdfParseResult>;
}
