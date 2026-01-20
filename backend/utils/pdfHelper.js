const axios = require('axios');
const pdfParse = require('pdf-parse');

// Function to clean extracted text
function cleanExtractedText(text) {
  if (!text) return '';

  let cleaned = text
    // Remove multiple newlines and replace with single space
    .replace(/\n+/g, ' ')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Remove page numbers (standalone numbers)
    .replace(/\s+\d+\s+/g, ' ')
    // Trim whitespace from start and end
    .trim();

  return cleaned;
}

async function extractTextFromPDF(urlOrPath) {
  try {
    let pdfBuffer;

    // Check if it's a URL or a local file path
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      console.log('Downloading PDF from:', urlOrPath);
      const response = await axios.get(urlOrPath, {
        responseType: 'arraybuffer',
      });
      pdfBuffer = Buffer.from(response.data);
      console.log('PDF downloaded, size:', pdfBuffer.length, 'bytes');
    } else {
      // It's a local file path
      const fs = require('fs');
      console.log('Reading PDF from local path:', urlOrPath);
      pdfBuffer = fs.readFileSync(urlOrPath);
      console.log('PDF read, size:', pdfBuffer.length, 'bytes');
    }

    const data = await pdfParse(pdfBuffer);
    console.log('PDF parsed, raw text length:', data.text.length);

    // Clean the extracted text
    const cleanedText = cleanExtractedText(data.text);
    console.log('Text cleaned, final length:', cleanedText.length);

    return cleanedText;
  } catch (error) {
    console.error('PDF extraction error:', error.message);
    console.error('Error details:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

// Extract text directly from a buffer (no download needed)
async function extractTextFromBuffer(pdfBuffer) {
  try {
    console.log('Parsing PDF buffer, size:', pdfBuffer.length, 'bytes');
    const data = await pdfParse(pdfBuffer);
    console.log('PDF parsed, raw text length:', data.text.length);
    const cleanedText = cleanExtractedText(data.text);
    console.log('Text cleaned, final length:', cleanedText.length);
    return cleanedText;
  } catch (error) {
    console.error('PDF buffer extraction error:', error.message);
    throw new Error('Failed to extract text from PDF buffer');
  }
}

module.exports = { extractTextFromPDF, extractTextFromBuffer, cleanExtractedText };
