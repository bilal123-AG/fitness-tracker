const http = require("http");
const fs = require("fs");
const path = require("path");

const BASE = __dirname;
const MIME = { ".html":"text/html",".js":"text/javascript",".json":"application/json",".png":"image/png",".svg":"image/svg+xml" };

http.createServer((req, res) => {
  let file = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const fp = path.join(BASE, file);
  if (!fs.existsSync(fp)) { res.writeHead(404); res.end("404"); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "text/plain" });
  fs.createReadStream(fp).pipe(res);
}).listen(8080, () => console.log("PWA running on http://localhost:8080"));