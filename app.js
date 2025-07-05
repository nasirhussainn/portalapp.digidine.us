// app.js
const express = require("express");
const authRoutes = require("./routes/auth");
const account = require("./routes/account");
const db = require('./config/db');
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/", account)


// Start the server
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.send('Hello, World!');
  });
  
  // Start the server
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
