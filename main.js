const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const openai = require('openai');
const {toFile} = require('openai/uploads')

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

    const fileName = `audio_${Date.now()}.wav`;
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

// Endpoint to convert audio data to text
app.post('/speech2text', upload.single('audio'), async (req, res) => {
    const audioData = req.file.buffer;

    if (!audioData) {
        return res.status(400).json({ error: 'No audio data provided' });
    }

    try {
        const spokenText = await convertSpeechToText(audioData);
        res.status(200).json({ text: spokenText });
    } catch (error) {
        console.error("ERROR", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

/**
 * Converts recorded audio data to spoken text
 * @param {Buffer} audioData recorded audio data
 * @returns spoken text
 */
async function convertSpeechToText(audioData) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API key not found. Set the OPENAI_API_KEY environment variable.');
    }

    const file = await toFile(audioData, "record.wav", {type: 'audio/wav'});

    const client = new openai.OpenAI();
    client.apiKey = apiKey;
    const transcription = await client.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
        });
        console.log("INFO", transcription)
    return transcription.text;
}
