const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const User = require('../models/User');
const LiveQuiz = require('../models/LiveQuiz');
const LiveQuizQuestion = require('../models/LiveQuizQuestion');
const LiveQuizParticipant = require('../models/LiveQuizParticipant');
const LiveQuizAnswer = require('../models/LiveQuizAnswer');
const { generateNou107QuizQuestions } = require('../utils/liveQuizHelper');

const PDF_PATH = path.resolve(__dirname, '..', '..', 'NOU107_A_Study_Guide_For_The_Distance_Learner.pdf');

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

  console.log('Generating 120 difficult questions exclusively from the NOU107 study guide...');
  const questions = await generateNou107QuizQuestions(fs.readFileSync(PDF_PATH));
  if (questions.length !== 120) {
    throw new Error(`Expected 120 usable questions but generated ${questions.length}.`);
  }

  const quiz = await LiveQuiz.create({
    title: 'NOU107 Live Quiz',
    courseCode: 'NOU107',
    description: '120 difficult questions sourced exclusively from the NOU107 study guide.',
    sourceFileName: path.basename(PDF_PATH),
    questionCount: questions.length,
    questionDurationSeconds: 40,
    createdBy: admin._id,
  });

  await LiveQuizQuestion.insertMany(questions.map((question, index) => ({
    ...question,
    quizId: quiz._id,
    order: index + 1,
  })));

  const oldQuizzes = await LiveQuiz.find({
    courseCode: 'NOU107',
    _id: { $ne: quiz._id },
  }).select('_id');
  const oldQuizIds = oldQuizzes.map((item) => item._id);

  if (oldQuizIds.length > 0) {
    await Promise.all([
      LiveQuizAnswer.deleteMany({ quizId: { $in: oldQuizIds } }),
      LiveQuizParticipant.deleteMany({ quizId: { $in: oldQuizIds } }),
      LiveQuizQuestion.deleteMany({ quizId: { $in: oldQuizIds } }),
    ]);
    await LiveQuiz.deleteMany({ _id: { $in: oldQuizIds } });
  }

  console.log(
    `Created replacement quiz ${quiz._id} with ${questions.length} questions `
    + `and removed ${oldQuizIds.length} previous NOU107 quiz record(s).`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
