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
