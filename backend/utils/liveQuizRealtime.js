const { Server } = require('socket.io');
const LiveQuizParticipant = require('../models/LiveQuizParticipant');

let io = null;
const leaderboardCache = new Map();

const quizRoom = (quizId) => `live-quiz:${quizId}`;

const serializeLeader = (participant, index) => ({
  rank: index + 1,
  _id: participant._id,
  username: participant.username,
  score: participant.correctCount,
  points: participant.score,
  correctCount: participant.correctCount,
  answeredCount: participant.answeredCount,
  lastAnsweredAt: participant.lastAnsweredAt,
  createdAt: participant.createdAt,
});

const sortLeaders = (leaders) => leaders
  .sort((a, b) => (
    (b.correctCount || 0) - (a.correctCount || 0)
    || (b.points || 0) - (a.points || 0)
    || new Date(a.lastAnsweredAt || a.createdAt || 0) - new Date(b.lastAnsweredAt || b.createdAt || 0)
    || new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  ))
  .slice(0, 10)
  .map((leader, index) => ({ ...leader, rank: index + 1 }));

const serializeParticipantForCache = (participant) => ({
  _id: String(participant._id),
  username: participant.username,
  score: participant.correctCount,
  points: participant.score,
  correctCount: participant.correctCount,
  answeredCount: participant.answeredCount,
  lastAnsweredAt: participant.lastAnsweredAt,
  createdAt: participant.createdAt,
});

async function loadLeaderboard(quizId) {
  const leaders = await LiveQuizParticipant.find({ quizId })
    .sort({ correctCount: -1, score: -1, lastAnsweredAt: 1, createdAt: 1 })
    .limit(10)
    .select('username score correctCount answeredCount lastAnsweredAt createdAt');

  const serialized = leaders.map(serializeLeader);
  leaderboardCache.set(String(quizId), serialized);
  return serialized;
}

async function getLeaderboard(quizId) {
  const key = String(quizId);
  if (leaderboardCache.has(key)) return leaderboardCache.get(key);
  return loadLeaderboard(key);
}

function emitToQuiz(quizId, event, payload) {
  if (!io || !quizId) return;
  io.to(quizRoom(quizId)).emit(event, payload);
}

async function emitLeaderboard(quizId) {
  const leaderboard = await getLeaderboard(quizId);
  emitToQuiz(quizId, 'liveQuiz:leaderboard', {
    quizId: String(quizId),
    leaderboard,
  });
}

async function updateParticipantScore(quizId, participant) {
  const key = String(quizId);
  let leaders = leaderboardCache.get(key);
  if (!leaders) {
    leaders = await loadLeaderboard(key);
  }

  const participantEntry = serializeParticipantForCache(participant);
  const withoutParticipant = leaders.filter((leader) => String(leader._id) !== participantEntry._id);
  const nextLeaders = sortLeaders([...withoutParticipant, participantEntry]);
  leaderboardCache.set(key, nextLeaders);

  emitToQuiz(key, 'liveQuiz:leaderboard', {
    quizId: key,
    leaderboard: nextLeaders,
  });
}

function emitParticipantJoined(quizId, participant) {
  emitToQuiz(quizId, 'liveQuiz:participantJoined', {
    quizId: String(quizId),
    participant: {
      _id: String(participant._id),
      username: participant.username,
    },
  });
}

function emitAnswerRecorded(quizId, participant) {
  emitToQuiz(quizId, 'liveQuiz:answerRecorded', {
    quizId: String(quizId),
    participantId: String(participant._id),
    answeredCount: participant.answeredCount,
    correctCount: participant.correctCount,
  });
}

function emitQuizStatus(quiz) {
  if (!quiz?._id) return;
  emitToQuiz(quiz._id, 'liveQuiz:status', {
    quizId: String(quiz._id),
    quiz: {
      _id: quiz._id,
      title: quiz.title,
      courseCode: quiz.courseCode,
      description: quiz.description,
      status: quiz.status,
      sourceFileName: quiz.sourceFileName,
      questionCount: quiz.questionCount,
      questionDurationSeconds: quiz.questionDurationSeconds,
      startedAt: quiz.startedAt,
      endedAt: quiz.endedAt,
      createdAt: quiz.createdAt,
    },
  });
}

function emitQuizDeleted(quizId) {
  emitToQuiz(quizId, 'liveQuiz:deleted', {
    quizId: String(quizId),
  });
}

function clearLeaderboard(quizId) {
  leaderboardCache.delete(String(quizId));
}

function initLiveQuizRealtime(server, corsOptions) {
  io = new Server(server, {
    cors: {
      origin: corsOptions.origin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('liveQuiz:joinQuiz', async ({ quizId } = {}) => {
      if (!quizId) return;
      socket.join(quizRoom(quizId));
      try {
        socket.emit('liveQuiz:leaderboard', {
          quizId: String(quizId),
          leaderboard: await getLeaderboard(quizId),
        });
      } catch {
        socket.emit('liveQuiz:error', { message: 'Could not load the live leaderboard.' });
      }
    });

    socket.on('liveQuiz:leaveQuiz', ({ quizId } = {}) => {
      if (quizId) socket.leave(quizRoom(quizId));
    });
  });

  return io;
}

module.exports = {
  clearLeaderboard,
  emitAnswerRecorded,
  emitLeaderboard,
  emitQuizDeleted,
  emitParticipantJoined,
  emitQuizStatus,
  getLeaderboard,
  initLiveQuizRealtime,
  loadLeaderboard,
  updateParticipantScore,
};
