document.addEventListener('DOMContentLoaded', function () {
    /**
     * @type {MediaRecorder|undefined}
     */
    let recorder;

    /** 
     * OpenAI ThreadId
     * @type {string|null}
     */
    let currentThreadId = null;

    const recordButton = document.getElementById('recordButton');
    const messageList = document.getElementById('messageList');

    recordButton.addEventListener('click', () => {
        if (!recorder) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    recorder = new MediaRecorder(stream);
                    const audioChunks = [];

                    recorder.ondataavailable = event => {
                        if (event.data.size > 0) {
                            audioChunks.push(event.data);
                        }
                    };

                    recorder.onstop = async () => {
                        // Send the audio data to the backend and handle response
                        try {
                            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                            const response = await sendAudioData(audioBlob, currentThreadId);
                            const threadId = response.threadId;
                            const runId = response.runId;
                            currentThreadId = threadId;
                            await waitForRunComplete(threadId, runId);
                            await retrieveAndDisplayMessages(threadId);
                        } catch (error) {
                            console.error('Error handling audio data:', error);
                        }

                        // Reset recorder and audioChunks
                        recorder = null;
                    };

                    recorder.start();
                    recordButton.textContent = 'Stop Recording';
                })
                .catch(error => {
                    console.error('Error accessing microphone:', error);
                });
        } else {
            recorder.stop();
            recordButton.textContent = 'Record Voice';
        }
    });

    /**
     * Send the user message to the backend.
     * @param {Blob} audioBlob recorded audio data
     * @param {string|null} threadId threadId, if null a new conversation is started
     * @returns {Promise<{spokenText: string, threadId: string, runId: string}>} conversation information
     */ 
    async function sendAudioData(audioBlob, threadId) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recorded_audio.wav');
        if (threadId) {
            formData.append('threadId', threadId);
        }

        const response = await fetch('/chat', {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    }

    /**
     * Sleep for a certain amount of time
     * @param {number} ms amount of milliseconds to sleep
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Waits for a message to be processed by the LLM. This is process is called a "run".
     * @param {string} threadId id of the current thread
     * @param {string} runId id of the current run
     */
    async function waitForRunComplete(threadId, runId) {
        let run = await retrieveRun(threadId, runId);
        while (run.status !== 'completed') {
            await sleep(1000);
            run = await retrieveRun(threadId, runId);
            console.debug(`run status for ${threadId}/${runId}: %s`, run.status);
        }
    }

    /**
     * Retrieves information about the current "run".
     * Can be used to check if a response was already created by the LLM.
     * @param {string} threadId id of the current thread
     * @param {string} runId id of the current run
     * @returns {Promise<{status: string}>} status information about the given run
     */
    async function retrieveRun(threadId, runId) {
        try {
            const response = await fetch(`/messages/${threadId}/${runId}`, {
                method: 'GET'
            });
            if (!response.ok) {
                throw new Error(`Cannot retrieve run data! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error retrieving run status for ${threadId}/${runId}:`, error);
        }
    }

    /**
     * Retrieves all messages in the current conversation and displays the messages on the page.
     * @param {string} threadId id of the current thread
     */
    async function retrieveAndDisplayMessages(threadId) {
        try {
            const response = await fetch(`/messages/${threadId}`, {
                method: 'GET'
            });
            if (!response.ok) {
                throw new Error(`Cannot retrieve messages! Status: ${response.status}`);
            }
            const messages = await response.json();
            console.log(messages);
            updateMessageList(messages);
        } catch (error) {
            console.error(`Error retrieving messages for ${threadId}:`, error);
        }
    }

    /**
     * Recreated the messages on the page
     */
    async function updateMessageList(messages) {
        // Clear existing messages
        messageList.innerHTML = '';

        // Append new messages to the list
        for (let i = 0; i < messages.data.length; i++) {
            const msg = messages.data[i];
            const role = msg.role;
            const firstMsg = i === 0;
            for (let content of msg.content) {
                if (content.type === "text") {
                    const text = content.text.value;
                    const listItem = document.createElement('li');

                    const withAudio = firstMsg && role === 'assistant';
                    const templateName = withAudio ? 'chatEntryAudio' : 'chatEntry';
                    const template = document.getElementById(templateName);
                    const clone = template.content.cloneNode(true);
                    const roleNode = clone.querySelector('b');
                    const roleText = document.createTextNode(role);
                    roleNode.appendChild(roleText);
                    const paragraphNode = clone.querySelector('p');
                    const textNode = document.createTextNode(text);
                    paragraphNode.appendChild(textNode);

                    if (withAudio) {
                        playAudioResponse(listItem, text);
                    }

                    listItem.appendChild(clone);
                    messageList.appendChild(listItem);
                }
            }
        }
    }

    /**
     * Creates an audio element which will autoplay a text message.
     * This function is used to make the LLM response audible.
     * @param {HTMLLIElement} listItem HTML element the audio element should be attached on
     * @param {string} text text for which an audio element is created
     */
    async function playAudioResponse(listItem, text) {
        const response = await fetch(`/text2speech`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });
        if (!response.ok) {
            throw new Error(`Cannot convert text to speech! Status: ${response.status}`);
        }
        const res = await response.json();
        const audio = listItem.querySelector('audio');
        audio.setAttribute('src', `/audio/${res.fileName}`);
    }
});
