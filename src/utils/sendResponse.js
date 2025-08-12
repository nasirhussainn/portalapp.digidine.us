const fs = require("fs");
const path = require("path");

function sendResponse(req, res, { status = "info", title = "", message = "" }) {
    const templatePath = path.join(__dirname, "../public/response-page.html");
  
    // If request wants JSON (e.g., mobile app)
    if (req.headers.accept?.includes("application/json") || req.query.format === "json") {
      return res.json({ status, title, message });
    }
  
    let html = fs.readFileSync(templatePath, "utf8");
  
    html = html
      .replace(/{{status}}/g, status)
      .replace(/{{title}}/g, title)
      .replace(/{{message}}/g, message);
  
    res.send(html);
  }
  

module.exports = sendResponse;
