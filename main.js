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
app.use(express.json());

// Create a temporary directory for storing audio files
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Serve files from the "temp" folder under the URL "/audio/:filename"
app.use('/audio', express.static(tempDir));

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
        const client = createOpenAIClient();
        const spokenText = await convertSpeechToText(client, audioData);
        res.status(200).json({ text: spokenText });
    } catch (error) {
        console.error("ERROR", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Endpoint to chat with the model
app.post('/chat', upload.single('audio'), async (req, res) => {
    const audioData = req.file.buffer;

    if (!audioData) {
        return res.status(400).json({ error: 'No audio data provided' });
    }

    
    try {
        const client = createOpenAIClient();
        const spokenText = await convertSpeechToText(client, audioData);
        // TODO: add threadId to form data, if set then don't create a new thread
        const thread = await client.beta.threads.create();
        console.debug("DEBUG thread %s", thread.id);
        await client.beta.threads.messages.create(
            thread.id,
            {
            role: "user",
            content: spokenText
        });
        const run = await client.beta.threads.runs.create(
            thread.id,
            {
                assistant_id: 'asst_XT9Gx9YxcqQCFR30bvsDFDd4'
            }
        );
        res.status(200).json({ text: spokenText, threadId: thread.id, runId: run.id });
    } catch (error) {
        console.error("ERROR", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/messages/:threadId/:runId', async (req, res) => {
    const threadId = req.params.threadId;
    const runId = req.params.runId;
    try {
        const client = createOpenAIClient();
        const run = await client.beta.threads.runs.retrieve(
            threadId,
            runId
        );
        res.status(200).json(run);
        
    } catch (error) {
        console.error('ERROR', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/messages/:threadId', async (req, res) => {
    const threadId = req.params.threadId;
    try {
        const client = createOpenAIClient();
        const messages = await client.beta.threads.messages.list(
            threadId
        );
        res.status(200).json(messages);
    } catch (error) {
        console.error('ERROR', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/text2speech', async (req, res) => {
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'No text provided for text-to-speech conversion' });
    }
    try {
        const client = createOpenAIClient();
        const audioData = await client.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: text,
            response_format: "mp3"
        })
        const buffer = Buffer.from(await audioData.arrayBuffer());
        const fileName = `audio_${Date.now()}.mp3`;
        const filePath = path.join(tempDir, fileName);
        await fs.promises.writeFile(filePath, buffer);
        res.status(200).json({fileName: fileName});
    } catch (error) {
        console.error('ERROR', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

function createOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API key not found. Set the OPENAI_API_KEY environment variable.');
    }
    return new openai.OpenAI({
        apiKey: apiKey
    });
}

/**
 * Converts recorded audio data to spoken text
 * @param {openai.OpenAI} client open ai client
 * @param {Buffer} audioData recorded audio data
 * @returns spoken text
 */
async function convertSpeechToText(client, audioData) {
    const file = await toFile(audioData, "record.wav", {type: 'audio/wav'});
    
    const transcription = await client.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
        });
        console.log("INFO", transcription)
    return transcription.text;
}

/**
 * Sends a prompt to the chat model
 * @param {string} prompt User input for the model
 */
async function sendPromptToModel(prompt) {

}