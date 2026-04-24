const { HOST, PORT } = require("./config");
const { createApp } = require("./app");

const app = createApp();
app.listen(PORT, HOST, () => {
  console.log(`Backend listening on http://${HOST}:${PORT}`);
});
