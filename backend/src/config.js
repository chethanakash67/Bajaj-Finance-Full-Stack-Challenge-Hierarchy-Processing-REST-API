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
    "G_CHETHAN_AKASH",
    '[config] USER_ID is not set. Using fallback "G_CHETHAN_AKASH".'
  ),
  email_id: getEnvValue(
    "EMAIL_ID",
    "ga0822@srmist.edu.in",
    '[config] EMAIL_ID is not set. Using fallback "ga0822@srmist.edu.in".'
  ),
  college_roll_number: getEnvValue(
    "COLLEGE_ROLL_NUMBER",
    "RA2311028010059",
    '[config] COLLEGE_ROLL_NUMBER is not set. Using fallback "RA2311028010059".'
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
