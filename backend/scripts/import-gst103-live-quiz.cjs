const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const User = require('../models/User');
const LiveQuiz = require('../models/LiveQuiz');
const LiveQuizQuestion = require('../models/LiveQuizQuestion');
const { generateQuizQuestionsFromPdfBuffer } = require('../utils/liveQuizHelper');

const PDF_PATH = path.resolve(__dirname, '..', '..', 'GST103 PDF.pdf');

async function main() {
  if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`Missing PDF: ${PDF_PATH}`);
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
  if (!admin) throw new Error('No admin user exists to own the quiz.');

  console.log('Generating GST103 live quiz questions with Gemini...');
  const questions = await generateQuizQuestionsFromPdfBuffer(fs.readFileSync(PDF_PATH), 100);
  if (questions.length < 20) {
    throw new Error(`Only ${questions.length} usable questions were generated.`);
  }

  const quiz = await LiveQuiz.create({
    title: 'GST103 Live Quiz',
    courseCode: 'GST103',
    description: 'Live GST103 quiz generated from the course PDF.',
    sourceFileName: path.basename(PDF_PATH),
    questionCount: questions.length,
    createdBy: admin._id,
  });

  await LiveQuizQuestion.insertMany(questions.map((question, index) => ({
    ...question,
    quizId: quiz._id,
    order: index + 1,
  })));

  console.log(`Created quiz ${quiz._id} with ${questions.length} questions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
