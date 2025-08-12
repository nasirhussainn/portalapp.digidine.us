function sendResponse(req, res, { status, title, message }) {
    res.render("response-page", {
      status,
      title,
      message
    });
  }
  
module.exports = sendResponse;
  

