const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

/**
 * Extracts raw text from an uploaded file (PDF or Word .docx).
 * filePath  - path to the temporarily saved upload (from multer)
 * mimeType  - the file's mime type, used to decide which parser to use
 */
const parseDocument = async (filePath, mimeType) => {
  if (mimeType === "application/pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error("Unsupported file type. Please upload a PDF or .docx file.");
};

/**
 * Splits raw text into overlapping chunks, since embedding an entire
 * document as one giant record loses retrieval precision.
 *
 * chunkSize   - approx characters per chunk
 * overlap     - characters shared between consecutive chunks, so context
 *               isn't lost right at chunk boundaries
 */
const chunkText = (text, chunkSize = 1000, overlap = 150) => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const chunks = [];

  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    chunks.push(cleaned.slice(start, end));
    start += chunkSize - overlap;
  }

  return chunks;
};

module.exports = { parseDocument, chunkText };