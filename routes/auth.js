// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require('nodemailer');
const { db, pool } = require('../config/db');
const crypto = require('crypto');
const dayjs = require("dayjs");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

require("dotenv").config();

const router = express.Router();

// Set up the uploads directory
const uploadsDir = path.join(__dirname, 'uploads/profile_images');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`Uploads folder created at: ${uploadsDir}`);
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Signup route
router.post('/signup', upload.single('profileImage'), async (req, res) => {
  const connection = await pool.getConnection();

  try {
    // Begin transaction
    await connection.beginTransaction();

    const {
      email,
      password,
      firstName,
      lastName,
      contactEmail,
      dateOfBirth,
      address,
      city,
      state,
      zipCode,
      shortDescription,
      longDescription,
      availability,
      categories,
      keywords,
    } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate activation token
    const activationToken = crypto.randomBytes(20).toString('hex');

    // Insert user into the `users` table
    const [userResult] = await connection.query(
      'INSERT INTO users (email, password, activation_token, is_active) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, activationToken, false]
    );
    const userId = userResult.insertId;

    // Handle profile image
    let profileImagePath = null;
    if (req.file) {
      profileImagePath = `/uploads/profile_images/${req.file.filename}`;
    }

    // Insert profile details into `user_profiles` table
    await connection.query(
      'INSERT INTO user_profiles (user_id, profile_image, first_name, last_name, contact_email, date_of_birth, address, city, state, zip_code, short_description, long_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        profileImagePath,
        firstName,
        lastName,
        contactEmail,
        dateOfBirth,
        address,
        city,
        state,
        zipCode,
        shortDescription,
        longDescription,
      ]
    );

    // Insert availability into `user_availability` table
    await connection.query('INSERT INTO user_availability (user_id, availability) VALUES (?, ?)', [userId, availability]);

    // Function to insert categories and keywords into `user_interests`
    const insertInterest = async (interestName, interestType) => {
      const table = interestType === 'category' ? 'categories' : 'keywords';
      const [existingInterestResult] = await connection.query(
        `SELECT id FROM ${table} WHERE name = ?`,
        [interestName]
      );
      let interestId;
      if (existingInterestResult.length > 0) {
        interestId = existingInterestResult[0].id;
      } else {
        const [insertInterestResult] = await connection.query(`INSERT INTO ${table} (name) VALUES (?)`, [interestName]);
        interestId = insertInterestResult.insertId;
      }
      return interestId;
    };

    // Insert categories into `user_interests`
    const categoryPromises = JSON.parse(categories || '[]').map((category) => insertInterest(category, 'category'));
    const categoryIds = await Promise.all(categoryPromises);

    // Insert keywords into `user_interests`
    const keywordPromises = JSON.parse(keywords || '[]').map((keyword) => insertInterest(keyword, 'keyword'));
    const keywordIds = await Promise.all(keywordPromises);

    // Insert categories and keywords into `user_interests`
    const interestPromises = [
      ...categoryIds.map((categoryId) =>
        connection.query('INSERT INTO user_interests (user_id, category_id, interest_type) VALUES (?, ?, ?)', [
          userId,
          categoryId,
          'category',
        ])
      ),
      ...keywordIds.map((keywordId) =>
        connection.query('INSERT INTO user_interests (user_id, keyword_id, interest_type) VALUES (?, ?, ?)', [
          userId,
          keywordId,
          'keyword',
        ])
      ),
    ];
    await Promise.all(interestPromises);

    // Commit the transaction
    await connection.commit();

    // Send activation email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      to: email,
      from: process.env.EMAIL_USER,
      subject: 'Account Activation',
      text: `Please click the link to activate your account: http://localhost:3000/auth/activate-account/${activationToken}`,
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) {
        return res.status(500).json({ message: 'Error sending activation email.' });
      }
      res.json({ message: 'Signup successful! Please check your email to activate your account.' });
    });
  } catch (error) {
    console.error(error);
    await connection.rollback();
    res.status(500).json({ error: 'Signup failed, please try again later.' });
  } finally {
    connection.release();
  }
});


router.get("/activate-account/:token", (req, res) => {
  const { token } = req.params;

  // Verify the activation token
  db.query("SELECT * FROM users WHERE activation_token = ?", [token], (err, results) => {
      if (err) return res.status(500).json({ error: "Database error" });

      if (results.length === 0) {
          return res.status(400).json({ message: "Invalid or expired activation token" });
      }

      const user = results[0];

      // Activate the user by setting is_active to true
      db.query("UPDATE users SET is_active = true, activation_token = NULL WHERE id = ?",
          [user.id],
          (err) => {
              if (err) return res.status(500).json({ error: "Database error" });
              res.json({ message: "Account successfully activated! You can now log in." });
          }
      );
  });
});

// routes/auth.js
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
  }

  // Check if user exists
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
      if (err) return res.status(500).json({ error: "Database error" });

      if (results.length === 0) {
          return res.status(400).json({ message: "User not found" });
      }

      const user = results[0];

      // Check if the user is activated
      if (!user.is_active) {
          return res.status(400).json({ message: "Account not activated. Please check your email." });
      }

      // Compare password
      bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) return res.status(500).json({ error: "Encryption error" });

          if (!isMatch) {
              return res.status(400).json({ message: "Invalid password" });
          }

          // Generate JWT token
          const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
              expiresIn: "1h",
          });

          // Send a successful response with the token
          res.json({ message: "Login successful", token });
      });
  });
});


router.post('/forgot-password', (req, res) => {
    const { email } = req.body;
  
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
  
    // Check if user exists
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error("Database query error:", "Database error"); // Log the exact error
            return res.status(500).json({ error: err});
        }
  
      if (results.length === 0) {
        return res.status(400).json({ message: 'User not found' });
      }
  
      const user = results[0];
  
      // Generate a password reset token
      const token = crypto.randomBytes(10).toString('hex');
      const resetTokenExpiry = dayjs().add(1, "hour").format("YYYY-MM-DD HH:mm:ss");
  
      // Store the reset token and its expiry time in the database
      db.query(
        'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?',
        [token, resetTokenExpiry, email],
        (err) => {
          if (err) return res.status(500).json({ error: 'Database error' });
  
          // Send the password reset email with the token
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.EMAIL_USER,  // your email
              pass: process.env.EMAIL_PASS,  // your email password or app-specific password
            },
          });
  
          const mailOptions = {
            to: email,
            from: process.env.EMAIL_USER,
            subject: 'Password Reset',
            text: `You are receiving this email because you requested a password reset. Please click the following link to reset your password: 
            http://localhost:3000/auth/reset-password/${token}`,
          };
  
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              return res.status(500).json({ message: 'Error sending email' });
            }
            res.json({ message: 'Password reset link sent to your email' });
          });
        }
      );
    });
  });
  
  router.post('/reset-password/:token', (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ message: 'New password is required' });
    }

    // Find the user with the reset token and check if it's not expired
    db.query('SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > ?', [token, Date.now()], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        if (results.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        const user = results[0];

        // Hash the new password
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) return res.status(500).json({ error: 'Encryption error' });

            // Update the user's password in the database and clear reset token and expiry
            db.query('UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?', [hashedPassword, user.id], (err) => {
                if (err) return res.status(500).json({ error: 'Database error' });

                res.json({ message: 'Password has been successfully reset' });
            });
        });
    });
});
  

module.exports = router;
