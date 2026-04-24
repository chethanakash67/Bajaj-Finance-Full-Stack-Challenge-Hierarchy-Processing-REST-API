const USER_DETAILS = {
  user_id: "yourname_ddmmyyyy",
  email_id: "yourmail@college.edu",
  college_roll_number: "YOUR_ROLL_NUMBER",
};

module.exports = {
  HOST: process.env.HOST || "0.0.0.0",
  PORT: process.env.PORT || 3000,
  FRONTEND_URL: process.env.FRONTEND_URL || "*",
  USER_DETAILS,
};
