document.addEventListener('DOMContentLoaded', function () {
    let recorder;

    const recordButton = document.getElementById('recordButton');
    const resultContainer = document.getElementById('resultContainer');
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

                    recorder.onstop = () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });

                        // Send the audio data to the backend
                        sendAudioData(audioBlob)
                            .then(async response => {
                                const threadId = response.threadId;
                                const runId = response.runId;
                                await waitForRunComplete(threadId, runId);
                                retrieveAndDisplayMessages(threadId);
                            })
                            .catch(error => {
                                console.error('Error sending audio data:', error);
                            });

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
    function sendAudioData(audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recorded_audio.wav');

        return fetch('/chat', {
            method: 'POST',
            body: formData,
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
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

    function retrieveRun(threadId, runId) {
        return fetch(`/messages/${threadId}/${runId}`, {
            method: 'GET'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .catch(error => {
            console.error(`Error retrieving run status for ${threadId}/${runId}:`, error);
        });
    }

    function retrieveAndDisplayMessages(threadId) {
        return fetch(`/messages/${threadId}`, {
            method: 'GET'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(messages => {
            console.log(messages);
            updateMessageList(messages);
        })
        .catch(error => {
            console.error(`Error retrieving messages for ${threadId}:`, error);
        });
    }

    // Function to update the message list in the UI
    function updateMessageList(messages) {
        // Clear existing messages
        messageList.innerHTML = '';

        // Append new messages to the list
        for (let msg of messages.data) {
            const role = msg.role;
            for (let content of msg.content) {
                if (content.type === "text") {
                    const listItem = document.createElement('li');
                    const text = content.text.value;
                    listItem.textContent = `${role}: ${text}`;
                    messageList.appendChild(listItem);
                }
            }
        }
    }
});
