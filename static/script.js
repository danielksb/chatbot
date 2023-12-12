document.addEventListener('DOMContentLoaded', function () {
    let recorder;
    let audioChunks = [];
    let recordedAudioUrl;

    const recordButton = document.getElementById('recordButton');
    const playButton = document.getElementById('playButton');
    let audioElement;

    recordButton.addEventListener('click', () => {
        if (!recorder) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    recorder = new MediaRecorder(stream);

                    recorder.ondataavailable = event => {
                        if (event.data.size > 0) {
                            audioChunks.push(event.data);
                        }
                    };

                    recorder.onstop = () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/ogg; codecs=opus' });
                        recordedAudioUrl = URL.createObjectURL(audioBlob);
                        playButton.disabled = false;

                        // Reset recorder and audioChunks
                        recorder = null;
                        audioChunks = [];

                        // Send the audio data to the backend
                        sendAudioData(audioBlob);
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

    playButton.addEventListener('click', () => {
        if (recordedAudioUrl) {
            // Remove existing audio element if it exists
            if (audioElement?.parentNode) {
                audioElement.parentNode.removeChild(audioElement);
            }
            // Create new audio element
            const audio = new Audio(recordedAudioUrl);
            audio.controls = true;
            document.body.appendChild(audio);
            audio.play();
        }
    });

    /**
     * Function to send audio data to the backend
     * @param {Blob} audioBlob
     */
    function sendAudioData(audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recorded_audio.ogg');

        fetch('/upload', {
            method: 'POST',
            body: formData,
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Handle the response from the server if needed
            console.log('Audio data sent successfully:', data);
        })
        .catch(error => {
            console.error('Error sending audio data to the server:', error);
        });
    }
});
