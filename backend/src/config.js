const warnedMessages = new Set();

function warnOnce(message) {
  if (!warnedMessages.has(message)) {
    warnedMessages.add(message);
    console.warn(message);
  }
}

function getEnvValue(key, fallback, warning) {
  const value = process.env[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  warnOnce(warning);
  return fallback;
}

const USER_DETAILS = {
  user_id: getEnvValue(
    "USER_ID",
    "yourname_ddmmyyyy",
    '[config] USER_ID is not set. Using fallback "yourname_ddmmyyyy".'
  ),
  email_id: getEnvValue(
    "EMAIL_ID",
    "yourmail@college.edu",
    '[config] EMAIL_ID is not set. Using fallback "yourmail@college.edu".'
  ),
  college_roll_number: getEnvValue(
    "COLLEGE_ROLL_NUMBER",
    "YOUR_ROLL_NUMBER",
    '[config] COLLEGE_ROLL_NUMBER is not set. Using fallback "YOUR_ROLL_NUMBER".'
  ),
};

module.exports = {
  HOST: process.env.HOST || "0.0.0.0",
  PORT: process.env.PORT || 3000,
  FRONTEND_URL: process.env.FRONTEND_URL || "*",
  HOSTED_FRONTEND_URL: process.env.HOSTED_FRONTEND_URL || "https://your-vercel-app.vercel.app",
  HOSTED_API_URL: process.env.HOSTED_API_URL || "https://your-render-backend.onrender.com",
  GITHUB_REPO_URL: process.env.GITHUB_REPO_URL || "https://github.com/your-username/your-repo",
  USER_DETAILS,
};
