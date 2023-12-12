document.addEventListener('DOMContentLoaded', function () {
    let recorder;

    const recordButton = document.getElementById('recordButton');
    const resultContainer = document.getElementById('resultContainer');
    const spokenTextElement = document.getElementById('spokenText');

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
                            .then(response => {
                                const spokenText = response.text;
                                resultContainer.style.display = 'block';
                                spokenTextElement.textContent = spokenText;
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

        return fetch('/speech2text', {
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
});
