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

    if (result.type === 'past_question_pdf' && result.pdfUrl) {
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
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process Ask request.',
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
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NounPaddiAsk/1.0; +https://paddi.com.ng)',
      },
    });

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
    return res.status(500).json({
      success: false,
      message: 'Failed to open PDF.',
    });
  }
};
