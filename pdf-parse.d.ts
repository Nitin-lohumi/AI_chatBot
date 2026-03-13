declare module 'pdf-parse/lib/pdf-parse.js' {
  function pdfParse(dataBuffer: Buffer, options?: any): Promise<{
    text: string;
    numpages: number;
    info: any;
    metadata: any;
  }>;
  export default pdfParse;
}