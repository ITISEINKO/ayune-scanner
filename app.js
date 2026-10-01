const { createServer } = require("node:http");
const next = require("next");

const app = next({ dev: false, dir: __dirname });

app.prepare().then(() => {
  createServer(app.getRequestHandler()).listen(process.env.PORT || 3000);
});
