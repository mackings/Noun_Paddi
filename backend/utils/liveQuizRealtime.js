const { Server } = require('socket.io');
const LiveQuizParticipant = require('../models/LiveQuizParticipant');

let io = null;
const leaderboardRefreshes = new Map();
const leaderboardGenerations = new Map();

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

async function loadLeaderboard(quizId) {
  const leaders = await LiveQuizParticipant.find({ quizId })
    .sort({ correctCount: -1, score: -1, lastAnsweredAt: 1, createdAt: 1 })
    .limit(10)
    .select('username score correctCount answeredCount lastAnsweredAt createdAt');

  return leaders.map(serializeLeader);
}

async function getLeaderboard(quizId) {
  const key = String(quizId);
  const pendingRefresh = leaderboardRefreshes.get(key);
  if (pendingRefresh) {
    try {
      await pendingRefresh;
    } catch {
      // Retry with a fresh database read below.
    }
  }
  return loadLeaderboard(key);
}

function emitToQuiz(quizId, event, payload) {
  if (!io || !quizId) return;
  io.to(quizRoom(quizId)).emit(event, payload);
}

async function emitLeaderboard(quizId) {
  return queueLeaderboardRefresh(quizId);
}

function queueLeaderboardRefresh(quizId) {
  const key = String(quizId);
  const generation = leaderboardGenerations.get(key) || 0;
  const previousRefresh = leaderboardRefreshes.get(key) || Promise.resolve();
  const refresh = previousRefresh
    .catch(() => {})
    .then(async () => {
      const leaderboard = await loadLeaderboard(key);
      if ((leaderboardGenerations.get(key) || 0) === generation) {
        emitToQuiz(key, 'liveQuiz:leaderboard', {
          quizId: key,
          leaderboard,
        });
      }
      return leaderboard;
    });

  leaderboardRefreshes.set(key, refresh);
  refresh.then(
    () => {
      if (leaderboardRefreshes.get(key) === refresh) leaderboardRefreshes.delete(key);
    },
    () => {
      if (leaderboardRefreshes.get(key) === refresh) leaderboardRefreshes.delete(key);
    }
  );

  return refresh;
}

async function updateParticipantScore(quizId) {
  return queueLeaderboardRefresh(quizId);
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
  const key = String(quizId);
  leaderboardGenerations.set(key, (leaderboardGenerations.get(key) || 0) + 1);
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
