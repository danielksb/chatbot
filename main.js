const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the "static" directory
app.use(express.static(path.join(__dirname, 'static')));

// Create a temporary directory for storing audio files
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Multer setup for handling form data
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

// Endpoint to receive and store audio data
app.post('/upload', upload.single('audio'), (req, res) => {
    const audioData = req.file.buffer;
    
    if (!audioData) {
        return res.status(400).json({ error: 'No audio data provided' });
    }

    const fileName = `audio_${Date.now()}.ogg`;
    const filePath = path.join(tempDir, fileName);

    fs.writeFile(filePath, audioData, 'binary', (err) => {
        if (err) {
            console.error('Error writing audio file:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        console.log('Audio file saved:', filePath);
        res.status(201).json({ success: true });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
