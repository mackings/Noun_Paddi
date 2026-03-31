const axios = require('axios');
const { generateProjectTopics } = require('../utils/aiHelper');

const FEE_CHECKER_FIREBASE_PROJECT_ID = 'noun-summary';
const FEE_CHECKER_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp';
const FEE_CHECKER_FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FEE_CHECKER_FIREBASE_PROJECT_ID}/databases/(default)/documents`;

let feeCheckerAuthState = null;

function getFeeCheckerApiKey() {
  return String(process.env.FEE_CHECKER_FIREBASE_API_KEY || '').trim();
}

function getNumericValue(value) {
  const numeric = Number(String(value || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseFirestoreValue(value) {
  if (!value || typeof value !== 'object') return value;
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return Boolean(value.booleanValue);
  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue;
  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;

  if (value.arrayValue) {
    return Array.isArray(value.arrayValue.values)
      ? value.arrayValue.values.map(parseFirestoreValue)
      : [];
  }

  if (value.mapValue) {
    return Object.entries(value.mapValue.fields || {}).reduce((result, [key, nestedValue]) => {
      result[key] = parseFirestoreValue(nestedValue);
      return result;
    }, {});
  }

  return value;
}

function parseFirestoreDocument(document) {
  const fields = parseFirestoreValue({ mapValue: { fields: document.fields || {} } }) || {};
  const pathSegments = String(document.name || '').split('/');

  return {
    id: pathSegments[pathSegments.length - 1],
    name: document.name,
    createTime: document.createTime,
    updateTime: document.updateTime,
    ...fields,
  };
}

async function authenticateFeeChecker(forceRefresh = false) {
  const apiKey = getFeeCheckerApiKey();
  if (!apiKey) {
    throw new Error('Fee checker is not configured on the server.');
  }

  if (
    !forceRefresh &&
    feeCheckerAuthState?.idToken &&
    feeCheckerAuthState.expiresAt > Date.now() + 60_000
  ) {
    return feeCheckerAuthState.idToken;
  }

  const response = await axios.post(
    `${FEE_CHECKER_AUTH_URL}?key=${apiKey}`,
    { returnSecureToken: true },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  const payload = response.data || {};
  if (!payload.idToken) {
    throw new Error('Fee checker authentication failed.');
  }

  feeCheckerAuthState = {
    idToken: payload.idToken,
    expiresAt: Date.now() + Number(payload.expiresIn || 3600) * 1000,
  };

  return feeCheckerAuthState.idToken;
}

async function fetchFeeCheckerCollection(path, retry = true) {
  const token = await authenticateFeeChecker();

  try {
    const response = await axios.get(`${FEE_CHECKER_FIRESTORE_BASE_URL}/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 20000,
    });

    return Array.isArray(response.data?.documents)
      ? response.data.documents.map(parseFirestoreDocument)
      : [];
  } catch (error) {
    if (retry && [401, 403].includes(error.response?.status)) {
      feeCheckerAuthState = null;
      return fetchFeeCheckerCollection(path, false);
    }

    const upstreamMessage = error.response?.data?.error?.message;
    throw new Error(upstreamMessage || 'Failed to load fee checker data.');
  }
}

function sortByName(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''));
}

function sortLevels(a, b) {
  return Number(a.name || 0) - Number(b.name || 0);
}

function sortSemesters(a, b) {
  return Number(a.id || a.name || 0) - Number(b.id || b.name || 0);
}

function normalizeSemesterPayload(semester) {
  const normalized = { ...semester };

  Object.keys(normalized).forEach((key) => {
    if (!/^\d+$/.test(key) || !normalized[key] || typeof normalized[key] !== 'object') return;

    normalized[key] = {
      ...normalized[key],
      code: String(normalized[key].code || '').replace(/\s+/g, ' ').trim(),
      title: String(normalized[key].title || '').replace(/\s+/g, ' ').trim(),
      status: String(normalized[key].status || '').trim().toUpperCase(),
      unit: Number(normalized[key].unit || 0),
      courseFee: getNumericValue(normalized[key].courseFee),
      examFee: getNumericValue(normalized[key].examFee),
      link: String(normalized[key].link || '').trim(),
    };
  });

  normalized.fees = getNumericValue(normalized.fees);
  normalized.bottomText = String(normalized.bottomText || '').trim();

  return normalized;
}

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

// @desc    Get fee checker faculties
// @route   GET /api/projects/fees/faculties
// @access  Private
exports.getFeeCheckerFaculties = async (req, res) => {
  try {
    const documents = await fetchFeeCheckerCollection('faculty?pageSize=50');

    return res.status(200).json({
      success: true,
      data: [...documents].sort(sortByName).map(({ id, name }) => ({ id, name })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load fee checker faculties.',
    });
  }
};

// @desc    Get fee checker programs
// @route   GET /api/projects/fees/programs?facultyId=...
// @access  Private
exports.getFeeCheckerPrograms = async (req, res) => {
  try {
    const facultyId = String(req.query?.facultyId || '').trim();
    if (!facultyId) {
      return res.status(400).json({
        success: false,
        message: 'facultyId is required.',
      });
    }

    const documents = await fetchFeeCheckerCollection(`faculty/${facultyId}/programs?pageSize=100`);

    return res.status(200).json({
      success: true,
      data: [...documents].sort(sortByName).map(({ id, name }) => ({ id, name })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load fee checker programmes.',
    });
  }
};

// @desc    Get fee checker levels
// @route   GET /api/projects/fees/levels?facultyId=...&programId=...
// @access  Private
exports.getFeeCheckerLevels = async (req, res) => {
  try {
    const facultyId = String(req.query?.facultyId || '').trim();
    const programId = String(req.query?.programId || '').trim();

    if (!facultyId || !programId) {
      return res.status(400).json({
        success: false,
        message: 'facultyId and programId are required.',
      });
    }

    const documents = await fetchFeeCheckerCollection(
      `faculty/${facultyId}/programs/${programId}/levels?pageSize=30`
    );

    return res.status(200).json({
      success: true,
      data: [...documents].sort(sortLevels).map(({ id, name }) => ({ id, name })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load fee checker levels.',
    });
  }
};

// @desc    Get fee checker semesters
// @route   GET /api/projects/fees/semesters?facultyId=...&programId=...&levelId=...
// @access  Private
exports.getFeeCheckerSemesters = async (req, res) => {
  try {
    const facultyId = String(req.query?.facultyId || '').trim();
    const programId = String(req.query?.programId || '').trim();
    const levelId = String(req.query?.levelId || '').trim();

    if (!facultyId || !programId || !levelId) {
      return res.status(400).json({
        success: false,
        message: 'facultyId, programId, and levelId are required.',
      });
    }

    const documents = await fetchFeeCheckerCollection(
      `faculty/${facultyId}/programs/${programId}/levels/${levelId}/semesters?pageSize=10`
    );

    return res.status(200).json({
      success: true,
      data: [...documents].sort(sortSemesters).map(normalizeSemesterPayload),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load fee checker semesters.',
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
