const jwt = require('jsonwebtoken');
const axios = require('axios');
const { answerAskQuery } = require('../utils/askHelper');

function issuePdfToken({ url, fileName, userId }) {
  return jwt.sign(
    {
      url,
      fileName,
      userId: String(userId || ''),
      type: 'ask-pdf',
    },
    process.env.JWT_SECRET,
    { expiresIn: '20m' }
  );
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
        message: 'Missing PDF token.',
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'ask-pdf') {
      return res.status(401).json({
        success: false,
        message: 'Invalid PDF token.',
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
        Accept: 'application/pdf,application/octet-stream,text/html;q=0.8,*/*;q=0.5',
      },
    });

    const upstreamType = String(response.headers['content-type'] || '').toLowerCase();
    const upstreamDisposition = String(response.headers['content-disposition'] || '');
    const isPdf =
      upstreamType.includes('application/pdf') ||
      (upstreamType.includes('application/octet-stream') && upstreamDisposition.toLowerCase().includes('.pdf')) ||
      upstreamDisposition.toLowerCase().includes('.pdf') ||
      String(payload.url || '').toLowerCase().includes('.pdf');

    if (!isPdf) {
      response.data.destroy();
      return res.status(502).json({
        success: false,
        message: 'The located file is not a usable PDF.',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${String(payload.fileName || 'noun-past-question.pdf').replace(/"/g, '')}"`);
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
      ? 'This PDF source blocked access right now. Try another prompt or try again later.'
      : 'Failed to open PDF.';

    return res.status(500).json({
      success: false,
      message,
    });
  }
};
