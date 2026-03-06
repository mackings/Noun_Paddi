#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Course = require('./models/Course');
const Material = require('./models/Material');
const Question = require('./models/Question');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    course: '',
    material: '',
    mode: 'append',
    target: 70,
    dryRun: false,
    limit: 0,
    help: false,
  };

  args.forEach((arg) => {
    if (arg === '--help' || arg === '-h') options.help = true;
    else
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--course=')) options.course = arg.split('=')[1];
    else if (arg.startsWith('--material=')) options.material = arg.split('=')[1];
    else if (arg.startsWith('--mode=')) options.mode = arg.split('=')[1];
    else if (arg.startsWith('--target=')) options.target = Number(arg.split('=')[1]) || 70;
    else if (arg.startsWith('--limit=')) options.limit = Number(arg.split('=')[1]) || 0;
  });

  if (!['append', 'replace'].includes(options.mode)) {
    throw new Error("Invalid --mode. Use 'append' or 'replace'.");
  }

  return options;
};

const normalizeKey = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/q\d+[:.)-]*/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const uniqueByQuestionText = (questions = [], existingKeys = new Set()) => {
  const seen = new Set(existingKeys);
  const unique = [];
  for (const question of questions) {
    const key = normalizeKey(question.questionText);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(question);
  }
  return unique;
};

const resolveCourseFilter = async (courseArg) => {
  if (!courseArg) return null;

  if (mongoose.Types.ObjectId.isValid(courseArg)) {
    return { _id: courseArg };
  }

  const course = await Course.findOne({
    courseCode: { $regex: `^${courseArg}$`, $options: 'i' },
  }).select('_id courseCode courseName');

  if (!course) {
    throw new Error(`Course not found for --course=${courseArg}`);
  }
  return { _id: course._id };
};

const buildMaterialQuery = async (options) => {
  if (options.material) {
    if (!mongoose.Types.ObjectId.isValid(options.material)) {
      throw new Error('Invalid --material ObjectId');
    }
    return { _id: options.material };
  }

  if (options.course) {
    const courseFilter = await resolveCourseFilter(options.course);
    return { courseId: courseFilter._id };
  }

  return {};
};

const printUsage = () => {
  console.log(`
Usage:
  node regenerate-tough-questions.js [options]

Options:
  --course=<courseId|courseCode>   Regenerate for a single course
  --material=<materialId>          Regenerate for a single material
  --mode=append|replace            append: top-up to target, replace: delete and rebuild (default: append)
  --target=<number>                Target questions per material (default: 70)
  --limit=<number>                 Limit number of materials processed
  --dry-run                        Preview only, no database writes

Examples:
  node regenerate-tough-questions.js --course=GST101 --mode=append
  node regenerate-tough-questions.js --material=65fd... --mode=replace --target=70
  node regenerate-tough-questions.js --mode=append --limit=10
`);
};

const main = async () => {
  let options;
  try {
    options = parseArgs();
  } catch (error) {
    console.error(error.message);
    printUsage();
    process.exit(1);
  }

  if (options.help) {
    printUsage();
    return;
  }

  const { generateQuestionsParallel } = require('./utils/aiHelper');
  console.log('Options:', options);
  await connectDB();

  try {
    const query = await buildMaterialQuery(options);
    let materialsQuery = Material.find(query)
      .sort({ createdAt: -1 })
      .select('_id courseId title cloudinaryUrl hasSummary');

    if (options.limit > 0) {
      materialsQuery = materialsQuery.limit(options.limit);
    }

    const materials = await materialsQuery.lean();
    if (materials.length === 0) {
      console.log('No materials found for provided filter.');
      return;
    }

    let processed = 0;
    let insertedTotal = 0;

    for (const material of materials) {
      console.log(`\n=== Material: ${material.title} (${material._id}) ===`);
      const existing = await Question.find({ materialId: material._id })
        .select('questionText')
        .lean();
      const existingKeys = new Set(existing.map((item) => normalizeKey(item.questionText)).filter(Boolean));

      let targetToGenerate = options.target;
      let baselineExclude = existing.map((item) => item.questionText).filter(Boolean);

      if (options.mode === 'append') {
        const remaining = options.target - existing.length;
        if (remaining <= 0) {
          console.log(`Skip: already has ${existing.length} questions (target ${options.target}).`);
          continue;
        }
        targetToGenerate = remaining;
      } else if (options.mode === 'replace') {
        console.log(`Replace mode: will rebuild from ${existing.length} existing questions.`);
      }

      if (options.dryRun) {
        console.log(`[dry-run] would generate ${targetToGenerate} questions.`);
        processed += 1;
        continue;
      }

      if (options.mode === 'replace') {
        await Question.deleteMany({ materialId: material._id });
      }

      const generated = await generateQuestionsParallel(
        material.cloudinaryUrl,
        material._id,
        null,
        targetToGenerate,
        baselineExclude
      );

      const deduped = uniqueByQuestionText(generated, options.mode === 'append' ? existingKeys : new Set());
      const docs = deduped.map((question) => ({
        materialId: material._id,
        courseId: material.courseId,
        questionText: question.questionText,
        questionType: question.questionType || 'multiple-choice',
        options: Array.isArray(question.options) ? question.options : [],
        correctAnswer: question.correctAnswer,
        explanation: question.explanation || '',
        difficulty: question.difficulty === 'easy' ? 'medium' : (question.difficulty || 'hard'),
      }));

      if (docs.length > 0) {
        await Question.insertMany(docs, { ordered: false });
      }

      const totalAfter = await Question.countDocuments({ materialId: material._id });
      await Material.updateOne(
        { _id: material._id },
        {
          hasQuestions: totalAfter >= options.target,
          processingStatus: totalAfter >= options.target ? 'completed' : 'processing',
        }
      );

      console.log(`Inserted ${docs.length} questions. Total now: ${totalAfter}.`);
      processed += 1;
      insertedTotal += docs.length;
    }

    console.log(`\nDone. Processed ${processed} materials. Inserted ${insertedTotal} questions.`);
  } finally {
    await mongoose.disconnect();
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
