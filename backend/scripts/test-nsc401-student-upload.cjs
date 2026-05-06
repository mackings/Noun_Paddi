const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { cloudinary } = require('../config/cloudinary');
const User = require('../models/User');
const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const Course = require('../models/Course');
const Material = require('../models/Material');
const Question = require('../models/Question');

const API_BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:5001/api';
const PDF_PATH = path.resolve(__dirname, '..', '..', 'NSC 401 PDF.pdf');
const COURSE_CODE = 'NSC 401';
const COURSE_NAME = 'medical nursing 2';
const CREDIT_UNITS = 3;
const STUDENT_EMAIL = 'nsc401.upload.test@student.nounpaddi.local';
const STUDENT_PASSWORD = 'StudentTest123!';
const TIMEOUT_MS = Number(process.env.TEST_UPLOAD_TIMEOUT_MS || 12 * 60 * 1000);
const POLL_MS = Number(process.env.TEST_UPLOAD_POLL_MS || 2000);

const nowIso = () => new Date().toISOString();
const elapsed = (startedAt) => `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(pathname, options = {}) {
  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.message || body.error?.message || response.statusText;
    const error = new Error(`${response.status} ${message}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function ensureTestRecords() {
  await mongoose.connect(process.env.MONGODB_URI);

  const faculty = await Faculty.findOneAndUpdate(
    { name: 'Health Sciences Upload Test' },
    { name: 'Health Sciences Upload Test', code: 'HSUT', isArchived: false },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const department = await Department.findOneAndUpdate(
    { code: 'NURS', facultyId: faculty._id },
    { name: 'Nursing Science Upload Test', code: 'NURS', facultyId: faculty._id, isArchived: false },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const course = await Course.findOneAndUpdate(
    { courseCode: COURSE_CODE },
    {
      courseCode: COURSE_CODE,
      courseName: COURSE_NAME,
      creditUnits: CREDIT_UNITS,
      departmentId: department._id,
      isArchived: false,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  let student = await User.findOne({ email: STUDENT_EMAIL });
  if (!student) {
    student = await User.create({
      name: 'Nsc Student',
      email: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
      role: 'student',
      faculty: faculty.name,
      department: department.name,
      studyCenter: 'Upload Test Center',
      matricNumber: `NSC${Date.now()}`,
    });
  }

  return { course, student };
}

async function uploadToCloudinary(fileHash) {
  const uploadStartedAt = Date.now();
  console.log(`[${nowIso()}] cloudinary upload started`);
  const result = await cloudinary.uploader.upload(PDF_PATH, {
    resource_type: 'raw',
    folder: 'nounpaddi-materials',
    public_id: `nsc-401-test-${Date.now()}-${fileHash.slice(0, 8)}`,
    overwrite: false,
  });
  console.log(`[${nowIso()}] cloudinary upload finished elapsed=${elapsed(uploadStartedAt)}`);
  return result;
}

async function main() {
  const overallStartedAt = Date.now();
  if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`Missing test PDF: ${PDF_PATH}`);
  }

  const pdfBuffer = fs.readFileSync(PDF_PATH);
  const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
  console.log(`[${nowIso()}] test started file=${path.basename(PDF_PATH)} bytes=${pdfBuffer.length} hash=${fileHash}`);

  const { course, student } = await ensureTestRecords();
  const token = jwt.sign({ id: student._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  console.log(`[${nowIso()}] records ready student=${student._id} course=${course._id} ${COURSE_CODE}`);

  const previousMaterials = await Material.find({ courseId: course._id, fileHash }).select('_id');
  if (previousMaterials.length) {
    const previousMaterialIds = previousMaterials.map((material) => material._id);
    await Question.deleteMany({ materialId: { $in: previousMaterialIds } });
    await Material.deleteMany({ _id: { $in: previousMaterialIds } });
    console.log(`[${nowIso()}] removed previous duplicate test material count=${previousMaterials.length}`);
  }

  const cloudinaryResult = await uploadToCloudinary(fileHash);

  const apiStartedAt = Date.now();
  console.log(`[${nowIso()}] student-upload API request started`);
  const uploadResponse = await request('/materials/student-upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: COURSE_NAME,
      courseId: String(course._id),
      cloudinaryUrl: cloudinaryResult.secure_url,
      cloudinaryPublicId: cloudinaryResult.public_id,
      fileType: 'application/pdf',
      originalFilename: path.basename(PDF_PATH),
      fileHash,
    }),
  });
  console.log(`[${nowIso()}] student-upload API response elapsed=${elapsed(apiStartedAt)} material=${uploadResponse.data._id}`);

  const materialId = uploadResponse.data._id;
  let lastStatus = '';
  let firstReadyAt = null;

  while (Date.now() - overallStartedAt < TIMEOUT_MS) {
    const statusResponse = await request(`/materials/${materialId}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = statusResponse.data;
    const snapshot = `${data.processingStatus}|summary=${data.hasSummary}|questions=${data.questionsCount}/${data.expectedQuestions}|error=${data.processingError || ''}`;
    if (snapshot !== lastStatus) {
      console.log(`[${nowIso()}] status elapsed=${elapsed(overallStartedAt)} ${snapshot}`);
      lastStatus = snapshot;
    }

    const frontendReady = data.hasSummary && data.questionsCount >= 10;
    if (frontendReady && !firstReadyAt) {
      firstReadyAt = Date.now();
      console.log(`[${nowIso()}] frontend-ready elapsed=${elapsed(overallStartedAt)}`);
    }

    if (data.processingStatus === 'completed' || data.processingStatus === 'failed' || frontendReady) {
      const material = await Material.findById(materialId).lean();
      const finalQuestionCount = await Question.countDocuments({ materialId });
      console.log(`[${nowIso()}] final elapsed=${elapsed(overallStartedAt)} status=${data.processingStatus} hasSummary=${data.hasSummary} questions=${finalQuestionCount}`);
      console.log(JSON.stringify({
        success: data.processingStatus !== 'failed',
        frontendReady,
        totalSeconds: Number(((Date.now() - overallStartedAt) / 1000).toFixed(1)),
        apiResponseSeconds: Number(((Date.now() - apiStartedAt) / 1000).toFixed(1)),
        frontendReadySeconds: firstReadyAt ? Number(((firstReadyAt - overallStartedAt) / 1000).toFixed(1)) : null,
        materialId,
        courseId: String(course._id),
        processingStatus: data.processingStatus,
        hasSummary: data.hasSummary,
        hasQuestions: data.hasQuestions,
        questionsCount: finalQuestionCount,
        processingError: data.processingError || '',
        lastGenerationStartedAt: material?.lastGenerationStartedAt || null,
        lastGenerationCompletedAt: material?.lastGenerationCompletedAt || null,
      }, null, 2));
      return;
    }

    await sleep(POLL_MS);
  }

  throw new Error(`Timed out after ${elapsed(overallStartedAt)} waiting for material processing`);
}

main()
  .catch((error) => {
    console.error(`[${nowIso()}] test failed:`, error.message);
    if (error.body) {
      console.error(JSON.stringify(error.body, null, 2));
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
