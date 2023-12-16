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
                            const response = await sendAudioData(audioBlob);
                            const threadId = response.threadId;
                            const runId = response.runId;
                            currentThreadId = threadId;
                            await waitForRunComplete(threadId, runId);
                            await retrieveAndDisplayMessages(threadId);
                        } catch(error) {
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

    // Function to send audio data to the backend
    async function sendAudioData(audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recorded_audio.wav');
        if (currentThreadId) {
            formData.append('threadId', currentThreadId);
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

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitForRunComplete(threadId, runId) {
        let run = await retrieveRun(threadId, runId);
        while (run.status !== 'completed') {
            await sleep(1000);
            run = await retrieveRun(threadId, runId);
            console.debug(`run status for ${threadId}/${runId}: %s`, run.status);
        }
    } 

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

    // Function to update the message list in the UI
    async function updateMessageList(messages) {
        // Clear existing messages
        messageList.innerHTML = '';

        // Append new messages to the list
        for (let msg of messages.data) {
            const role = msg.role;
            for (let content of msg.content) {
                if (content.type === "text") {
                    const text = content.text.value;
                    const listItem = document.createElement('li');

                    const templateName = role;
                    const template = document.getElementById(templateName);
                    const clone = template.content.cloneNode(true);
                    const roleNode = clone.querySelector('b');
                    const roleText = document.createTextNode(role);
                    roleNode.appendChild(roleText);
                    const paragraphNode = clone.querySelector('p');
                    const textNode = document.createTextNode(text);
                    paragraphNode.appendChild(textNode);

                    if (role === 'assistant') {
                        playAudioResponse(listItem, text);
                    }

                    listItem.appendChild(clone);
                    messageList.appendChild(listItem);
                }
            }
        }
    }

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
        audio.play();
    }
});
