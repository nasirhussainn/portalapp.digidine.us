const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const multer = require('multer');
const { db, pool } = require('./config/db');
require("dotenv").config();

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Configure Multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Route to upload multiple images
app.post('/upload', upload.array('images', 3), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { name } = req.body;

        // Insert each image into the database
        const imageInserts = req.files.map(async (file) => {
            const imageBuffer = file.buffer;
            return connection.query(
                'INSERT INTO images (name, image) VALUES (?, ?)', 
                [name, imageBuffer]
            );
        });

        // Wait for all images to be inserted
        await Promise.all(imageInserts);

        res.json({ message: 'Images uploaded successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Image upload failed' });
    } finally {
        connection.release();
    }
});

// Route to retrieve an image by ID
app.get('/image/:id', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const imageId = req.params.id;
        const [rows] = await connection.query(
            'SELECT name, image FROM images WHERE id = ?', 
            [imageId]
        );

        if (rows.length > 0) {
            const image = rows[0];
            res.set('Content-Type', 'image/jpeg'); // Or change based on the image type
            res.send(image.image); // Send the image buffer directly
        } else {
            res.status(404).json({ message: 'Image not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve image' });
    } finally {
        connection.release();
    }
});

app.get('/test', async (req, res) => {
    res.status(404).json({ message: 'Image not found' });
})

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});