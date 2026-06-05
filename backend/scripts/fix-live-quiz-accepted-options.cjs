const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const LiveQuiz = require('../models/LiveQuiz');
const LiveQuizQuestion = require('../models/LiveQuizQuestion');

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const stripOptionPrefix = (value) => String(value || '').replace(/^[A-F][.)]\s*/i, '').trim();

const resolveAnswer = (answer, options) => {
  const value = String(answer || '').trim();
  const letterMatch = value.match(/^([A-F])(?:[.)])?$/i);
  if (letterMatch) {
    return options[letterMatch[1].toUpperCase().charCodeAt(0) - 65] || value;
  }

  return options.find((option) => (
    normalize(option) === normalize(value)
    || normalize(stripOptionPrefix(option)) === normalize(value)
  )) || value;
};

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured.');

  await mongoose.connect(process.env.MONGODB_URI);
  const quiz = await LiveQuiz.findOne({ courseCode: 'NOU107' }).sort({ createdAt: -1 });
  if (!quiz) throw new Error('No NOU107 quiz was found.');

  const questions = await LiveQuizQuestion.find({
    quizId: quiz._id,
    questionType: 'single_answer',
  });
  const operations = [];

  questions.forEach((question) => {
    const acceptedAnswers = question.acceptedAnswers.map((answer) => (
      resolveAnswer(answer, question.options)
    ));
    if (JSON.stringify(acceptedAnswers) === JSON.stringify(question.acceptedAnswers)) return;

    operations.push({
      updateOne: {
        filter: { _id: question._id },
        update: { $set: { acceptedAnswers } },
      },
    });
  });

  if (operations.length > 0) await LiveQuizQuestion.bulkWrite(operations);

  const bareLetterAnswersRemaining = await LiveQuizQuestion.countDocuments({
    quizId: quiz._id,
    questionType: 'single_answer',
    acceptedAnswers: { $elemMatch: { $regex: /^[A-F](?:[.)])?$/i } },
  });

  console.log(JSON.stringify({
    quizId: String(quiz._id),
    singleAnswerQuestions: questions.length,
    updated: operations.length,
    bareLetterAnswersRemaining,
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
