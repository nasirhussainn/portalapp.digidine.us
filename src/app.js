const express = require('express');
const app = express();
const path = require("path");
const authRoutes = require('./routes/authRoutes');

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use('/api/auth', authRoutes)


// Default error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

module.exports = app;
