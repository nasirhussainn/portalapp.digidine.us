const express = require('express');
const { db, pool } = require('../config/db');  // Assuming you have a DB connection pool set up
const router = express.Router();

router.get('/get-user-details', async (req, res) => {
    const { email } = req.query;
  
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
  
    const connection = await pool.getConnection();
    
    try {
      const [userResult] = await connection.query(
        "SELECT id, email, activation_token, is_active FROM users WHERE email = ?",
        [email]
      );
  
      if (userResult.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
  
      const user = userResult[0];
  
      const [profileResult] = await connection.query(
        "SELECT profile_image, first_name, last_name, contact_email, date_of_birth, address, city, state, zip_code, short_description, long_description FROM user_profiles WHERE user_id = ?",
        [user.id]
      );
  
      const profile = profileResult[0] || {};
  
      const [availabilityResult] = await connection.query(
        "SELECT availability FROM user_availability WHERE user_id = ?",
        [user.id]
      );
  
      const availability = availabilityResult[0]?.availability || "";
  
      const [interestsResult] = await connection.query(
        `SELECT user_interests.interest_type,
                COALESCE(categories.name, keywords.name) AS name
         FROM user_interests
         LEFT JOIN categories ON user_interests.category_id = categories.id
         LEFT JOIN keywords ON user_interests.keyword_id = keywords.id
         WHERE user_interests.user_id = ?`,
        [user.id]
      );
      
  
      const interests = interestsResult.map(row => ({
        type: row.interest_type,
        name: row.name
      }));
  
      const userDetails = {
        user: {
          id: user.id,
          email: user.email,
          isActive: user.is_active,
          activationToken: user.activation_token
        },
        profile: profile,
        availability: availability,
        interests: interests
     
      };
  
      res.json(userDetails);
      
    } catch (error) {
      console.error("Error fetching user details:", error);  // Log the exact error
      res.status(500).json({ error: "Failed to fetch user details, please try again later." });
    } finally {
      connection.release();
    }
  });
  

// DELETE /account/delete-account
router.delete('/delete-account', async (req, res) => {
  const { email } = req.body;

  // Validate the input
  if (!email) {
    return res.status(400).json({ error: "Email is required to delete an account." });
  }

  const connection = await pool.getConnection();
  try {
    // Begin transaction
    await connection.beginTransaction();

    // Check if the user exists
    const [userResult] = await connection.query("SELECT id FROM users WHERE email = ?", [email]);
    if (userResult.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    const userId = userResult[0].id;

    // Delete user from `users` table (cascades to related tables if set up with ON DELETE CASCADE)
    await connection.query("DELETE FROM users WHERE id = ?", [userId]);

    // Commit transaction
    await connection.commit();

    res.json({ message: "Account deleted successfully." });
  } catch (error) {
    console.error("Error deleting account:", error);

    // Rollback transaction if there's an error
    await connection.rollback();

    res.status(500).json({ error: "Failed to delete account, please try again later." });
  } finally {
    connection.release(); // Release the connection back to the pool
  }
});

module.exports = router;

