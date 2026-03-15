const jwt = require('jsonwebtoken');
const axios = require('axios');
const { answerAskQuery } = require('../utils/askHelper');

function issuePdfToken({ url, fileName, userId }) {
  return jwt.sign(
    {
      url,
      fileName,
      userId: String(userId || ''),
      type: 'ask-file',
    },
    process.env.JWT_SECRET,
    { expiresIn: '20m' }
  );
}

function attachFileTokens(files = [], userId) {
  return files.map((file) => ({
    ...file,
    token: issuePdfToken({
      url: file.url,
      fileName: file.fileName,
      userId,
    }),
  }));
}

exports.askQuestion = async (req, res) => {
  try {
    const query = String(req.body?.query || '').trim();
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a question.',
      });
    }

    const result = await answerAskQuery(query);
    const responseData = { ...result };

    if (result.pdfUrl) {
      responseData.pdf = {
        token: issuePdfToken({
          url: result.pdfUrl,
          fileName: result.fileName,
          userId: req.user?._id,
        }),
        fileName: result.fileName,
      };
      delete responseData.pdfUrl;
    }

    if (Array.isArray(result.files) && result.files.length > 0) {
      responseData.files = attachFileTokens(result.files, req.user?._id).map((file) => ({
        label: file.label,
        fileName: file.fileName,
        extension: file.extension,
        token: file.token,
      }));
    }

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    const status = error.response?.status;
    const message = status === 403
      ? 'Ask could not reach an external source right now. Please try again shortly.'
      : (error.message || 'Failed to process Ask request.');

    return res.status(500).json({
      success: false,
      message,
    });
  }
};

exports.streamAskPdf = async (req, res) => {
  try {
    const token = String(req.params?.token || '').trim();
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Missing file token.',
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'ask-file') {
      return res.status(401).json({
        success: false,
        message: 'Invalid file token.',
      });
    }

    if (String(payload.userId || '') !== String(req.user?._id || '')) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to open this PDF.',
      });
    }

    const response = await axios.get(payload.url, {
      responseType: 'stream',
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NounPaddiAsk/1.0; +https://paddi.com.ng)',
        Accept: 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream,text/html;q=0.8,*/*;q=0.5',
      },
    });

    const upstreamType = String(response.headers['content-type'] || '').toLowerCase();
    const upstreamDisposition = String(response.headers['content-disposition'] || '');
    const lowerUrl = String(payload.url || '').toLowerCase();
    const isAllowedFile =
      upstreamType.includes('application/pdf') ||
      upstreamType.includes('application/msword') ||
      upstreamType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
      upstreamType.includes('application/octet-stream') ||
      upstreamDisposition.toLowerCase().includes('.pdf') ||
      upstreamDisposition.toLowerCase().includes('.doc') ||
      upstreamDisposition.toLowerCase().includes('.docx') ||
      lowerUrl.includes('.pdf') ||
      lowerUrl.includes('.doc') ||
      lowerUrl.includes('.docx');

    if (!isAllowedFile) {
      response.data.destroy();
      return res.status(502).json({
        success: false,
        message: 'The located file could not be prepared for download.',
      });
    }

    res.setHeader('Content-Type', upstreamType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${String(payload.fileName || 'noun-file').replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');

    response.data.on('error', () => {
      if (!res.headersSent) {
        res.status(502).end('Failed to stream PDF');
      } else {
        res.end();
      }
    });

    response.data.pipe(res);
  } catch (error) {
    const status = error.response?.status;
    const message = status === 403
      ? 'This file source blocked access right now. Try another prompt or try again later.'
      : 'Failed to open file.';

    return res.status(500).json({
      success: false,
      message,
    });
  }
};
