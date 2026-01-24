const axios = require('axios');
const { generateProjectTopics } = require('../utils/aiHelper');

// @desc    Generate project topics for a course and keywords
// @route   POST /api/projects/topics
// @access  Private
exports.generateTopics = async (req, res) => {
  try {
    const { course, courseName, courseCode, keywords } = req.body || {};
    const keywordList = Array.isArray(keywords)
      ? keywords.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (keywordList.length < 3 || keywordList.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Please provide 3 to 4 keywords.',
      });
    }

    const courseLabel = course || courseName || courseCode || 'the course';
    let topics = [];
    try {
      topics = await generateProjectTopics(courseLabel, keywordList, 5);
    } catch (error) {
      topics = keywordList.slice(0, 5).map((keyword, index) => (
        `${courseLabel}: A focused study on ${keyword} (${index + 1})`
      ));
      while (topics.length < 5) {
        topics.push(`${courseLabel}: Emerging trends in ${keywordList[0] || 'the field'}`);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        course: courseLabel,
        keywords: keywordList,
        topics,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate project topics',
    });
  }
};

// @desc    Request a paid consultation for project support
// @route   POST /api/projects/consultations
// @access  Private
exports.requestConsultation = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      department,
      projectTitle,
      issueSummary,
      preferredDate,
      preferredTime,
      paymentReference,
      hasPaid,
      acceptedTerms,
    } = req.body || {};

    const trimmedName = String(fullName || '').trim();
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedPhone = String(phone || '').trim();
    const trimmedDepartment = String(department || '').trim();
    const trimmedProjectTitle = String(projectTitle || '').trim();
    const trimmedIssueSummary = String(issueSummary || '').trim();
    const trimmedDate = String(preferredDate || '').trim();
    const trimmedTime = String(preferredTime || '').trim();
    const trimmedPaymentReference = String(paymentReference || '').trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone || !trimmedDepartment || !trimmedProjectTitle || !trimmedIssueSummary) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields.',
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    const allowedTimes = ['09:00', '12:00', '15:00'];
    if (!trimmedDate || !trimmedTime || !allowedTimes.includes(trimmedTime)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid consultation date and time slot.',
      });
    }

    if (!hasPaid) {
      return res.status(400).json({
        success: false,
        message: 'Payment is required before submitting the consultation request.',
      });
    }

    if (!acceptedTerms) {
      return res.status(400).json({
        success: false,
        message: 'Please accept the consultation terms before submitting.',
      });
    }

    const { sendConsultationRequest } = require('../utils/emailService');
    await sendConsultationRequest({
      fullName: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      department: trimmedDepartment,
      projectTitle: trimmedProjectTitle,
      issueSummary: trimmedIssueSummary,
      preferredDate: trimmedDate,
      preferredTime: trimmedTime,
      paymentReference: trimmedPaymentReference,
      userId: req.user?.id,
    });

    return res.status(200).json({
      success: true,
      message: 'Consultation request submitted. We will contact you shortly.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit consultation request',
    });
  }
};

// @desc    Initialize Flutterwave payment for consultation
// @route   POST /api/projects/consultations/initiate-payment
// @access  Private
exports.initiateConsultationPayment = async (req, res) => {
  try {
    const secretKey = process.env.FLW_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({
        success: false,
        message: 'Payment service is not configured.',
      });
    }

    const { email, fullName, phone } = req.body || {};
    const trimmedEmail = String(email || '').trim().toLowerCase();
    if (!trimmedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required to start payment.',
      });
    }

    const txRef = `consult_${req.user?.id || 'user'}_${Date.now()}`;
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/projects/consultation?consultation=1`;

    const payload = {
      tx_ref: txRef,
      amount: 2000,
      currency: 'NGN',
      redirect_url: redirectUrl,
      customer: {
        email: trimmedEmail,
        name: String(fullName || '').trim() || trimmedEmail,
        phonenumber: String(phone || '').trim(),
      },
      customizations: {
        title: 'NounPaddi Project Consultation',
        description: 'Project assessment and guidance (2 hours)',
      },
    };

    const response = await axios.post('https://api.flutterwave.com/v3/payments', payload, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        link: response.data?.data?.link,
        tx_ref: txRef,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.response?.data?.message || 'Failed to initialize payment.',
    });
  }
};

// @desc    Verify Flutterwave payment by reference
// @route   GET /api/projects/consultations/verify?tx_ref=...
// @access  Private
exports.verifyConsultationPayment = async (req, res) => {
  try {
    const secretKey = process.env.FLW_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({
        success: false,
        message: 'Payment service is not configured.',
      });
    }

    const txRef = String(req.query?.tx_ref || '').trim();
    if (!txRef) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required.',
      });
    }

    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    const data = response.data?.data || {};
    const isPaid = response.data?.status === 'success'
      && data?.status === 'successful'
      && Number(data?.amount) === 2000
      && String(data?.currency).toUpperCase() === 'NGN';

    if (!isPaid) {
      return res.status(400).json({
        success: false,
        message: 'Payment not verified.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        tx_ref: txRef,
        transactionId: data?.id,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.response?.data?.message || 'Failed to verify payment.',
    });
  }
};
