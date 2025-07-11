const express = require('express');
const app = express();
const path = require("path");
const authRoutes = require('./routes/authRoutes');
const accountRoutes = require('./routes/accountRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');
const portfolioImageRoutes = require('./routes/portfolioImageRoutes');
const portfolioKeywordRoutes = require('./routes/portfolioKeywordRoutes');

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/account', accountRoutes)
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/portfolio', portfolioImageRoutes);
app.use('/api/portfolio', portfolioKeywordRoutes);


// Default error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

module.exports = app;
