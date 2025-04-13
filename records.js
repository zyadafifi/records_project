// DOM Elements
const sentenceElement = document.getElementById("sentence");
const micButton = document.getElementById("micButton");
const retryButton = document.getElementById("retryButton");
const nextButton = document.getElementById("nextButton");
const recognizedTextDiv = document.getElementById("recognizedText");
const pronunciationScoreDiv = document.getElementById("pronunciationScore");
const listenButton = document.getElementById("listenButton");
const listen2Button = document.getElementById("listen2Button");
const missingWordDiv = document.getElementById("missingWordDiv");
const dialogContainer = document.querySelector(".dialog-container");
const progressCircle = document.getElementById("progress");
const sentencesSpokenDiv = document.getElementById("sentencesSpoken");
const overallScoreDiv = document.getElementById("overallScore");
const continueButton = document.querySelector(".continue-to-next-lesson");
const bookmarkIcon = document.querySelector(".bookmark-icon");
const bookmarkIcon2 = document.querySelector("#bookmark-icon2");
const recordingIndicator = document.getElementById("recordingIndicator");
let noSpeechTimeout;
const NO_SPEECH_TIMEOUT_MS = 5000;

// Google Cloud API Key
const GOOGLE_CLOUD_API_KEY = "AIzaSyAGEKiq1X3cGWkS-CLS3oepkO6xoK_5j6M";

// Check if the API key is valid
async function checkApiKeyValidity() {
  try {
    // Make a simple request to the Speech-to-Text API to check if the key is valid
    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_CLOUD_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          config: {
            encoding: "WEBM_OPUS",
            sampleRateHertz: 48000,
            languageCode: "en-US",
          },
          audio: {
            content: "", // Empty content just to test the API key
          },
        }),
      }
    );

    // If we get a 400 error, it means the API key is valid but the request is invalid (which is expected)
    // If we get a 403 error, it means the API key is invalid
    if (response.status === 403) {
      console.error("API key is invalid or has insufficient permissions");
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error checking API key validity:", error);
    return false;
  }
}

// Dialog backdrop
const dialogBackdrop = document.createElement("div");
dialogBackdrop.classList.add("dialog-backdrop");
document.body.appendChild(dialogBackdrop);
dialogBackdrop.style.display = "none";

// Global variables
let lessons = [];
let currentLessonIndex = 0;
let currentSentenceIndex = 0;
let totalSentencesSpoken = 0;
let totalPronunciationScore = 0;
let mediaRecorder;
let audioChunks = [];
let recordedAudioBlob;
let isRecording = false;
let speechDetected = false;
let audioContext;
let silenceTimer;
const SILENCE_DETECTION_TIMEOUT = 2000; // 2 seconds of silence to stop recording

// Initialize and resume AudioContext
function initializeAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

async function resumeAudioContext() {
  if (audioContext && audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

// Recording functions with improved silence detection
async function startAudioRecording() {
  try {
    console.log("Starting audio recording...");

    // Reset any existing state
    audioChunks = [];
    isRecording = false;
    speechDetected = false;

    // Initialize audio context
    initializeAudioContext();
    await resumeAudioContext();

    // Get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
        channelCount: 1,
        autoGainControl: true,
        latency: 0,
      },
    });

    console.log("Microphone access granted");

    // Determine the best audio format for the browser and API compatibility
    let mimeType = "audio/webm;codecs=opus";
    let audioBitsPerSecond = 128000;

    // Check browser compatibility
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      console.warn("WebM with Opus codec not supported, trying alternatives");

      // Try different formats in order of preference
      const formats = [
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        "audio/wav",
      ];

      for (const format of formats) {
        if (MediaRecorder.isTypeSupported(format)) {
          mimeType = format;
          console.log(`Using alternative format: ${mimeType}`);
          break;
        }
      }

      // If no supported format found, use default
      if (
        mimeType === "audio/webm;codecs=opus" &&
        !MediaRecorder.isTypeSupported(mimeType)
      ) {
        console.warn("No supported audio format found, using default");
        mimeType = "";
      }
    }

    // Create MediaRecorder with the best compatible format
    const options = {
      mimeType: mimeType,
      audioBitsPerSecond: audioBitsPerSecond,
    };

    console.log("Recording with options:", options);
    mediaRecorder = new MediaRecorder(stream, options);

    // Set recording state
    isRecording = true;
    speechDetected = false;

    // Update UI
    toggleListenButtons(true);
    toggleBookmarkButtons(true);
    micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    micButton.style.color = "#ff0000";
    micButton.disabled = true;
    recordingIndicator.style.display = "inline-block";

    // Start no speech timeout
    clearTimeout(noSpeechTimeout);
    noSpeechTimeout = setTimeout(() => {
      if (isRecording && !speechDetected) {
        console.log("No speech detected - stopping recording");
        stopRecording();
      }
    }, NO_SPEECH_TIMEOUT_MS);

    // Setup silence detection
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function checkSilence() {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;

      if (average > 20) {
        // Sound detected
        speechDetected = true;
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          if (isRecording) {
            console.log("Silence detected - stopping recording");
            stopRecording();
          }
        }, SILENCE_DETECTION_TIMEOUT);
      }

      if (isRecording) {
        requestAnimationFrame(checkSilence);
      }
    }

    // Set a flag to prevent duplicate data handling
    let isProcessingData = false;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && !isProcessingData) {
        isProcessingData = true;
        audioChunks.push(event.data);
        console.log(`Audio chunk received: ${event.data.size} bytes`);
        isProcessingData = false;
      }
    };

    mediaRecorder.onstop = async () => {
      console.log("MediaRecorder onstop event triggered");
      try {
        // Create the audio blob with the correct MIME type
        recordedAudioBlob = new Blob(audioChunks, {
          type: mimeType || "audio/webm;codecs=opus",
        });

        console.log(
          `Recording stopped. Total size: ${recordedAudioBlob.size} bytes, type: ${recordedAudioBlob.type}`
        );

        // Check if the audio blob is too small (likely no speech)
        if (recordedAudioBlob.size < 1000) {
          console.warn("Audio recording too small, likely no speech detected");
          alert("No speech detected. Please try again and speak clearly.");
          updateUIAfterRecording();
          return;
        }

        updateUIAfterRecording();

        // Convert the audio to a format compatible with the Speech-to-Text API if needed
        let audioForTranscription = recordedAudioBlob;

        // If we're not using WebM with Opus codec, we might need to convert
        if (mimeType !== "audio/webm;codecs=opus" && mimeType !== "") {
          console.log(
            "Converting audio to WebM with Opus codec for API compatibility"
          );
          try {
            // Create an audio element to play the recorded audio
            const audioElement = new Audio();
            audioElement.src = URL.createObjectURL(recordedAudioBlob);

            // Create a MediaRecorder to capture the audio from the audio element
            const audioContext = new AudioContext();
            const source = audioContext.createMediaElementSource(audioElement);
            const destination = audioContext.createMediaStreamDestination();
            source.connect(destination);

            // Create a new MediaRecorder with WebM/Opus
            const converter = new MediaRecorder(destination.stream, {
              mimeType: "audio/webm;codecs=opus",
              audioBitsPerSecond: 128000,
            });

            const convertedChunks = [];
            converter.ondataavailable = (e) => {
              if (e.data.size > 0) {
                convertedChunks.push(e.data);
              }
            };

            converter.onstop = () => {
              audioForTranscription = new Blob(convertedChunks, {
                type: "audio/webm;codecs=opus",
              });
              console.log(
                `Converted audio size: ${audioForTranscription.size} bytes`
              );

              // Proceed with transcription
              transcribeAudio(audioForTranscription);
            };

            // Start recording and playing
            converter.start();
            audioElement.play();

            // Stop after the audio finishes playing
            audioElement.onended = () => {
              converter.stop();
              audioContext.close();
            };

            return; // Exit early, transcription will be handled in the onstop callback
          } catch (conversionError) {
            console.error("Error converting audio format:", conversionError);
            // Fall back to using the original audio
            audioForTranscription = recordedAudioBlob;
          }
        }

        // If we didn't need conversion or conversion failed, proceed with transcription
        transcribeAudio(audioForTranscription);
      } catch (error) {
        console.error("Error in recording stop handler:", error);
        alert("Error processing recording. Please try again.");
      } finally {
        cleanupRecording(stream);
      }
    };

    // Helper function to handle transcription
    async function transcribeAudio(audioBlob) {
      try {
        console.log("Starting transcription process...");
        const transcription = await transcribeAudioWithGoogle(audioBlob);
        if (transcription) {
          console.log("Transcription successful:", transcription);
          processTranscription(transcription);
        } else {
          console.warn("Transcription returned null or empty result");
        }
      } catch (error) {
        console.error("Error during transcription:", error);
        alert("Failed to transcribe audio. Please try again.");
      }
    }

    // Start recording with a larger timeslice to reduce the number of data events
    mediaRecorder.start(1000); // 1 second timeslice
    console.log("MediaRecorder started");

    // Start silence detection
    checkSilence();
  } catch (error) {
    console.error("Error accessing microphone:", error);
    alert("Please allow microphone access to use this feature.");
    handleRecordingError();
  }
}

// FIX: Update the stopRecording function to ensure proper cleanup
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    try {
      // Set a flag to prevent multiple stop calls
      if (isRecording) {
        console.log("Stopping recording...");
        isRecording = false;

        // Clear any existing timeouts
        clearTimeout(noSpeechTimeout);
        clearTimeout(silenceTimer);

        // Stop the MediaRecorder
        mediaRecorder.stop();
        console.log("MediaRecorder stopped");

        // Update UI immediately
        micButton.innerHTML = '<i class="fas fa-microphone"></i>';
        micButton.style.color = "#fff";
        micButton.disabled = false;
        retryButton.style.display = "inline-block";
        retryButton.disabled = false;
        recordingIndicator.style.display = "none";
      }
    } catch (error) {
      console.error("Error stopping MediaRecorder:", error);
    }
  }
}

// FIX: Update the cleanupRecording function to ensure proper cleanup
function cleanupRecording(stream) {
  try {
    console.log("Cleaning up recording resources...");

    // Stop all tracks in the MediaStream to release the microphone
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
        console.log("MediaStream track stopped");
      });
    }

    // Reset recording state
    isRecording = false;
    speechDetected = false;

    // Re-enable buttons
    toggleListenButtons(false);
    toggleBookmarkButtons(false);

    // Clear timeouts
    clearTimeout(noSpeechTimeout);
    clearTimeout(silenceTimer);

    console.log("Recording cleanup completed");
  } catch (error) {
    console.error("Error in cleanupRecording:", error);
  }
}

// FIX: Update the updateUIAfterRecording function to ensure UI is updated properly
function updateUIAfterRecording() {
  console.log("Updating UI after recording...");

  // Update microphone button
  micButton.innerHTML = '<i class="fas fa-microphone"></i>';
  micButton.style.color = "#fff";
  micButton.style.backgroundColor = "";
  micButton.disabled = false;

  // Update retry button
  retryButton.style.display = "inline-block";
  retryButton.disabled = false;

  // Hide recording indicator
  recordingIndicator.style.display = "none";

  console.log("UI updated after recording");
}

// FIX: Update the processTranscription function to ensure it's called correctly
function processTranscription(transcription) {
  console.log("Processing transcription:", transcription);

  const currentLesson = lessons[currentLessonIndex];
  const pronunciationScore = calculatePronunciationScore(
    transcription,
    currentLesson.sentences[currentSentenceIndex]
  );

  // Update UI with pronunciation score
  pronunciationScoreDiv.textContent = `${pronunciationScore}%`;
  updateProgressCircle(pronunciationScore);

  // Update overall statistics
  totalSentencesSpoken++;
  totalPronunciationScore += pronunciationScore;

  // Show the dialog with results
  openDialog();

  console.log("Transcription processed, score:", pronunciationScore);
}

// Update the displayed sentence and reset UI
function updateSentence() {
  if (lessons.length === 0) return; // Ensure lessons are loaded
  const currentLesson = lessons[currentLessonIndex];

  // Update the sentence
  sentenceElement.textContent = currentLesson.sentences[currentSentenceIndex];

  // Reset UI
  recognizedTextDiv.textContent = "";
  pronunciationScoreDiv.textContent = "0%";
  micButton.style.display = "inline-block";
  retryButton.style.display = "none";
  retryButton.disabled = true;
  missingWordDiv.textContent = "";
  closeDialog();
  updateProgressCircle(0);
  nextButton.style.backgroundColor = "";

  // Enable listen buttons in case they were disabled
  listenButton.disabled = false;
  listen2Button.disabled = false;

  // Enable bookmark buttons in case they were disabled
  toggleBookmarkButtons(false);
}

// Function to reset UI without changing the sentence
function resetUI() {
  // Reset UI elements
  recognizedTextDiv.textContent = "";
  pronunciationScoreDiv.textContent = "0%";
  micButton.style.display = "inline-block";
  micButton.style.color = "#fff";
  micButton.style.backgroundColor = "";
  micButton.disabled = false;
  retryButton.style.display = "none";
  retryButton.disabled = true;
  missingWordDiv.textContent = "";
  closeDialog();
  updateProgressCircle(0);
  recordingIndicator.style.display = "none";

  // Reset recording state and re-enable buttons
  isRecording = false;
  speechDetected = false; // Reset speech detection flag
  toggleListenButtons(false);
  toggleBookmarkButtons(false);

  // Clear the timeout
  clearTimeout(noSpeechTimeout);
}

// Normalize text (remove punctuation and convert to lowercase)
function normalizeText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, "");
}

// Check if two words are exactly the same
function isExactMatch(word1, word2) {
  return word1 === word2;
}

// Calculate Levenshtein distance between two strings
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  // Create a matrix of size (m+1) x (n+1)
  const dp = Array(m + 1)
    .fill()
    .map(() => Array(n + 1).fill(0));

  // Fill the first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] =
          1 +
          Math.min(
            dp[i - 1][j], // deletion
            dp[i][j - 1], // insertion
            dp[i - 1][j - 1] // substitution
          );
      }
    }
  }

  return dp[m][n];
}

// Helper function to calculate similarity between two words
// Returns a value between 0 (no similarity) and 1 (identical)
function calculateSimilarity(word1, word2) {
  // Convert to lowercase
  word1 = word1.toLowerCase();
  word2 = word2.toLowerCase();

  // If words are identical, return 1
  if (word1 === word2) return 1;

  // If length difference is too great, they're likely different words
  const lengthDiff = Math.abs(word1.length - word2.length);
  if (lengthDiff > Math.min(word1.length, word2.length)) {
    return 0.1; // Very low similarity for words with vastly different lengths
  }

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(word1, word2);

  // Calculate maximum possible distance
  const maxDistance = Math.max(word1.length, word2.length);

  // Convert distance to similarity score (1 - normalized distance)
  let similarity = 1 - distance / maxDistance;

  // Apply additional penalties for differences in word length
  if (lengthDiff > 0) {
    similarity *= 1 - (lengthDiff / maxDistance) * 0.5;
  }

  // Penalize short words that differ by even one character more heavily
  if (Math.min(word1.length, word2.length) <= 3 && distance > 0) {
    similarity *= 0.7;
  }

  // If one word starts with the other but is much longer, reduce similarity
  if ((word1.startsWith(word2) || word2.startsWith(word1)) && lengthDiff > 2) {
    similarity *= 0.8;
  }

  return similarity;
}

// Update the progress circle based on the pronunciation score
function updateProgressCircle(score) {
  const circumference = 251.2; // 2 * π * r (r = 40)
  const offset = circumference - (circumference * score) / 100;
  progressCircle.style.strokeDashoffset = offset;

  // Change circle color based on score
  if (score >= 80) {
    progressCircle.style.stroke = "#0aa989"; // Green for high scores
    playSoundEffect(800, 200); // High-pitched beep for success
  } else if (score >= 50) {
    progressCircle.style.stroke = "#ffa500"; // Orange for medium scores
    playSoundEffect(500, 200); // Medium-pitched beep for neutral
  } else {
    progressCircle.style.stroke = "#ff0000"; // Red for low scores
    playSoundEffect(300, 200); // Low-pitched beep for failure
  }
}

// Play sound effects using the Web Audio API
function playSoundEffect(frequency, duration) {
  if (!audioContext) {
    console.error(
      "AudioContext not initialized. Call initializeAudioContext() first."
    );
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.frequency.value = frequency; // Frequency in Hz
  oscillator.type = "sine"; // Type of waveform

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  gainNode.gain.setValueAtTime(1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + duration / 1000
  );
  oscillator.stop(audioContext.currentTime + duration / 1000);
}

// Calculate pronunciation score and log recognized words to the console
function calculatePronunciationScore(transcript, expectedSentence) {
  const transcriptWords = normalizeText(transcript)
    .split(/\s+/)
    .filter((word) => word.trim() !== "");
  const sentenceWords = normalizeText(expectedSentence)
    .split(/\s+/)
    .filter((word) => word.trim() !== "");

  let correctWords = 0;
  let highlightedText = "";
  let missingWords = [];
  let incorrectWords = [];

  // Log the recognized words and expected words to the console
  console.log("Recognized Words:", transcriptWords);
  console.log("Expected Words:", sentenceWords);

  // Create arrays to track which words have been matched
  let matchedTranscriptIndices = new Array(transcriptWords.length).fill(false);
  let matchedSentenceIndices = new Array(sentenceWords.length).fill(false);

  // First pass: find exact matches
  for (let i = 0; i < sentenceWords.length; i++) {
    for (let j = 0; j < transcriptWords.length; j++) {
      if (
        !matchedTranscriptIndices[j] &&
        !matchedSentenceIndices[i] &&
        isExactMatch(transcriptWords[j], sentenceWords[i])
      ) {
        matchedTranscriptIndices[j] = true;
        matchedSentenceIndices[i] = true;
        correctWords++;
        break;
      }
    }
  }

  // Second pass: find close matches for unmatched words
  // Use an array to store all potential matches with similarity scores
  let potentialMatches = [];

  for (let i = 0; i < sentenceWords.length; i++) {
    if (matchedSentenceIndices[i]) continue; // Skip already matched words

    for (let j = 0; j < transcriptWords.length; j++) {
      if (matchedTranscriptIndices[j]) continue; // Skip already matched words

      const similarity = calculateSimilarity(
        transcriptWords[j],
        sentenceWords[i]
      );
      if (similarity > 0) {
        potentialMatches.push({
          sentenceIndex: i,
          transcriptIndex: j,
          similarity: similarity,
        });
      }
    }
  }

  // Sort matches by similarity score (highest first)
  potentialMatches.sort((a, b) => b.similarity - a.similarity);

  // Apply matches greedily, starting with the highest similarity
  for (const match of potentialMatches) {
    if (
      !matchedSentenceIndices[match.sentenceIndex] &&
      !matchedTranscriptIndices[match.transcriptIndex]
    ) {
      // Apply match only if it exceeds our high similarity threshold
      if (match.similarity >= 0.85) {
        matchedSentenceIndices[match.sentenceIndex] = true;
        matchedTranscriptIndices[match.transcriptIndex] = true;

        // Award partial credit for close matches
        correctWords += match.similarity;
      }
    }
  }

  // Generate the highlighted text based on the matching results
  for (let i = 0; i < sentenceWords.length; i++) {
    const expectedWord = sentenceWords[i];

    if (matchedSentenceIndices[i]) {
      // Word was matched correctly or closely
      highlightedText += `<span style="color: green;">${expectedWord}</span> `;
      console.log(`Correct: "${expectedWord}"`);
    } else {
      // Find most similar word that wasn't matched yet
      let mostSimilarWord = "";
      let highestSimilarity = 0;
      let mostSimilarIndex = -1;

      for (let j = 0; j < transcriptWords.length; j++) {
        if (!matchedTranscriptIndices[j]) {
          const similarity = calculateSimilarity(
            transcriptWords[j],
            expectedWord
          );
          if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            mostSimilarWord = transcriptWords[j];
            mostSimilarIndex = j;
          }
        }
      }

      if (highestSimilarity >= 0.5 && highestSimilarity < 0.85) {
        // Word was attempted but not close enough
        highlightedText += `<span style="color: red;">${expectedWord}</span> `;
        incorrectWords.push({
          expected: expectedWord,
          got: mostSimilarWord,
        });
        console.log(
          `Incorrect: Expected "${expectedWord}", got "${mostSimilarWord}" (similarity: ${highestSimilarity.toFixed(
            2
          )})`
        );
        matchedTranscriptIndices[mostSimilarIndex] = true;
      } else {
        // Word was completely missed
        highlightedText += `<span style="color: grey;">${expectedWord}</span> `;
        missingWords.push(expectedWord);
        console.log(`Missing: "${expectedWord}"`);
      }
    }
  }

  // Check for extra words that were spoken but not matched
  for (let j = 0; j < transcriptWords.length; j++) {
    if (!matchedTranscriptIndices[j]) {
      // This is an extra word, check if it's similar to any expected word
      let mostSimilarWord = "";
      let highestSimilarity = 0;

      for (let i = 0; i < sentenceWords.length; i++) {
        const similarity = calculateSimilarity(
          transcriptWords[j],
          sentenceWords[i]
        );
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          mostSimilarWord = sentenceWords[i];
        }
      }

      // Very strict threshold for considering a word as "incorrect" vs "extra"
      if (highestSimilarity >= 0.5) {
        highlightedText += `<span style="color: red;">[Incorrect: ${transcriptWords[j]}]</span> `;
        console.log(
          `Incorrect: "${
            transcriptWords[j]
          }" (similar to "${mostSimilarWord}", score: ${highestSimilarity.toFixed(
            2
          )})`
        );
      } else {
        highlightedText += `<span style="color: red;">[Extra: ${transcriptWords[j]}]</span> `;
        console.log(`Extra: "${transcriptWords[j]}"`);
      }
    }
  }

  // Display the result
  recognizedTextDiv.innerHTML = highlightedText.trim();

  // Show missing words
  if (missingWords.length > 0) {
    missingWordDiv.textContent = `Missing: ${missingWords.join(", ")}`;
  } else {
    missingWordDiv.textContent = "";
  }

  // Calculate pronunciation score with fractional correctness
  const pronunciationScore = (correctWords / sentenceWords.length) * 100;

  // Update the "Continue" button color based on the score
  if (pronunciationScore < 50) {
    nextButton.style.backgroundColor = "#ff0000"; // Red for low scores
  } else {
    nextButton.style.backgroundColor = "#0aa989"; // Reset to default color
  }

  return Math.round(pronunciationScore);
}

// Speak the sentence using Google Cloud Text-to-Speech API
async function speakSentence() {
  // Check if currently recording - if so, don't allow listening
  if (isRecording) {
    console.log("Cannot listen while recording");
    alert(
      "Cannot listen to example while recording. Please finish recording first."
    );
    return; // Exit the function without speaking
  }

  if (lessons.length === 0) return; // Ensure lessons are loaded
  const currentLesson = lessons[currentLessonIndex];
  const sentence = currentLesson.sentences[currentSentenceIndex];

  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_CLOUD_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text: sentence },
          voice: { languageCode: "en-US", name: "en-US-Wavenet-D" },
          audioConfig: { audioEncoding: "MP3" },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Text-to-Speech API error: ${response.statusText}`);
    }

    const data = await response.json();
    const audioContent = data.audioContent;
    const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
    audio.play();
  } catch (error) {
    console.error("Error with Text-to-Speech API:", error);
    alert("Failed to play audio. Please try again.");
  }
}

// Toggle listen buttons state
function toggleListenButtons(disabled) {
  listenButton.disabled = disabled;
  listen2Button.disabled = disabled;

  // Visual feedback on disabled buttons
  if (disabled) {
    listenButton.style.opacity = "0.5";
    listen2Button.style.opacity = "0.5";
    listenButton.title = "Cannot listen while recording";
    listen2Button.title = "Cannot listen while recording";
  } else {
    listenButton.style.opacity = "1";
    listen2Button.style.opacity = "1";
    listenButton.title = "Listen to example";
    listen2Button.title = "Listen to example";
  }
}

// Toggle bookmark buttons state
function toggleBookmarkButtons(disabled) {
  bookmarkIcon.disabled = disabled;
  bookmarkIcon2.disabled = disabled;

  // Visual feedback on disabled buttons
  if (disabled) {
    bookmarkIcon.style.opacity = "0.5";
    bookmarkIcon2.style.opacity = "0.5";
    bookmarkIcon.title = "Cannot play audio while recording";
    bookmarkIcon2.title = "Cannot play audio while recording";
  } else {
    bookmarkIcon.style.opacity = "1";
    bookmarkIcon2.style.opacity = "1";
    bookmarkIcon.title = "Play recorded audio";
    bookmarkIcon2.title = "Play recorded audio";
  }
}

// Transcribe audio using Google Cloud Speech-to-Text API
async function transcribeAudioWithGoogle(audioBlob) {
  try {
    // Convert Blob to base64
    const base64Audio = await blobToBase64(audioBlob);

    // Remove the data URL prefix
    const base64Data = base64Audio.split(",")[1];

    // Log the size of the audio data for debugging
    console.log(`Audio data size: ${base64Data.length} characters`);

    // Prepare the API request body with improved configuration
    const requestBody = {
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
        model: "default",
        useEnhanced: true,
        metadata: {
          recordingDeviceType: "OTHER_INDOOR_DEVICE",
          originalMediaType: "AUDIO",
        },
      },
      audio: {
        content: base64Data,
      },
    };

    // Log a sample of the request body for debugging (first 100 chars)
    console.log(
      "Request body sample:",
      JSON.stringify(requestBody).substring(0, 100) + "..."
    );

    console.log("Sending request to Speech-to-Text API...");

    // Add a timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_CLOUD_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorDetails = await response.json();
      console.error("API Error Details:", errorDetails);

      // Check for specific 400 error details
      if (response.status === 400) {
        if (errorDetails.error && errorDetails.error.message) {
          console.error("Specific error message:", errorDetails.error.message);

          // Handle common 400 errors
          if (errorDetails.error.message.includes("audio content")) {
            throw new Error("Invalid audio content format or encoding");
          } else if (errorDetails.error.message.includes("sample rate")) {
            throw new Error("Invalid sample rate configuration");
          } else if (errorDetails.error.message.includes("encoding")) {
            throw new Error("Unsupported audio encoding format");
          }
        }
      }

      // Provide more specific error messages based on status code
      if (response.status === 403) {
        throw new Error("API key is invalid or has insufficient permissions");
      } else if (response.status === 400) {
        throw new Error("Invalid request format or audio data");
      } else if (response.status === 429) {
        throw new Error("API quota exceeded. Please try again later");
      } else {
        throw new Error(`Speech-to-Text API error: ${response.statusText}`);
      }
    }

    const data = await response.json();
    console.log("API Response:", data);

    if (data.results && data.results[0] && data.results[0].alternatives[0]) {
      return data.results[0].alternatives[0].transcript;
    } else {
      console.warn("No transcription results returned. Full response:", data);

      // Try a fallback approach with a different configuration
      if (audioBlob.size > 0) {
        console.log(
          "Attempting fallback transcription with different configuration..."
        );
        return await fallbackTranscription(audioBlob);
      } else {
        throw new Error(
          "No transcription results returned and audio blob is empty"
        );
      }
    }
  } catch (error) {
    console.error("Error with Speech-to-Text API:", error);

    // Provide more user-friendly error messages
    if (error.name === "AbortError") {
      alert("The transcription request timed out. Please try again.");
    } else if (error.message.includes("API key")) {
      alert("There's an issue with the API key. Please contact support.");
    } else if (error.message.includes("quota")) {
      alert(
        "The service is currently busy. Please try again in a few minutes."
      );
    } else if (
      error.message.includes("audio content") ||
      error.message.includes("encoding") ||
      error.message.includes("sample rate")
    ) {
      alert("There's an issue with the audio format. Please try again.");
    } else {
      alert("Failed to transcribe audio. Please try again.");
    }

    return null;
  }
}

// Fallback transcription method with different configuration
async function fallbackTranscription(audioBlob) {
  try {
    const base64Audio = await blobToBase64(audioBlob);
    const base64Data = base64Audio.split(",")[1];

    // Try with a simpler configuration
    const requestBody = {
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
        model: "default",
        useEnhanced: false,
      },
      audio: {
        content: base64Data,
      },
    };

    console.log("Attempting fallback with simplified configuration");

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_CLOUD_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorDetails = await response.json();
      console.error("Fallback API Error Details:", errorDetails);
      throw new Error(`Fallback transcription failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.results && data.results[0] && data.results[0].alternatives[0]) {
      return data.results[0].alternatives[0].transcript;
    } else {
      throw new Error("Fallback transcription returned no results");
    }
  } catch (error) {
    console.error("Fallback transcription error:", error);
    throw error; // Re-throw to be caught by the main function
  }
}

// Helper function to convert Blob to base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Play the recorded audio
function playRecordedAudio() {
  if (!recordedAudioBlob) {
    alert("No recorded audio available.");
    return;
  }

  // Prevent playing recorded audio during recording
  if (isRecording) {
    console.log("Cannot play audio while recording");
    alert("Cannot play audio while recording. Please finish recording first.");
    return;
  }

  const audioURL = URL.createObjectURL(recordedAudioBlob);
  const audio = new Audio(audioURL);
  audio.play();
}

// Event listeners
listenButton.addEventListener("click", speakSentence);
listen2Button.addEventListener("click", speakSentence);
bookmarkIcon.addEventListener("click", playRecordedAudio);
bookmarkIcon2.addEventListener("click", playRecordedAudio);

// Load lessons from the JSON file
async function loadLessons() {
  try {
    // Check API key validity first
    const isApiKeyValid = await checkApiKeyValidity();
    if (!isApiKeyValid) {
      console.error(
        "Google Cloud API key is invalid or has insufficient permissions"
      );
      alert(
        "There's an issue with the Speech-to-Text API. Some features may not work correctly."
      );
    }

    const url =
      "https://raw.githubusercontent.com/zyadafifi/lessons/main/lessons.json";
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch lessons: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Fetched data:", data);

    // Ensure the data has the expected structure
    if (!data || !data.lessons) {
      throw new Error("Invalid JSON structure: 'lessons' array not found");
    }

    lessons = data.lessons;
    console.log("Lessons loaded successfully:", lessons);

    // Get the quizId from the URL
    const quizId = getQuizIdFromURL();
    console.log("Quiz ID from URL:", quizId);

    // Find the lesson with the matching quizId
    currentLessonIndex = lessons.findIndex(
      (lesson) => lesson.quizId === quizId
    );

    if (currentLessonIndex === -1) {
      console.error("Lesson not found for quizId:", quizId);
      return;
    }

    // Update the UI with the first sentence
    updateSentence();
  } catch (error) {
    console.error("Error loading lessons:", error);
  }
}

// Get the quiz ID from the URL
function getQuizIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("quizId");
}

// Load lessons when the page loads
loadLessons();

// Event listeners for buttons
micButton.addEventListener("click", async () => {
  // Initialize and resume AudioContext on user gesture
  initializeAudioContext();
  await resumeAudioContext();

  micButton.style.display = "none";
  retryButton.style.display = "inline-block";
  retryButton.disabled = false;
  startAudioRecording();
});

retryButton.addEventListener("click", () => {
  // First close the dialog to show the sentence again
  closeDialog();

  // Reset UI without changing the sentence
  resetUI();

  // Clear the timeout
  clearTimeout(noSpeechTimeout);

  // Stop any ongoing recording
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
});

nextButton.addEventListener("click", () => {
  const currentLesson = lessons[currentLessonIndex];
  if (currentSentenceIndex < currentLesson.sentences.length - 1) {
    currentSentenceIndex++;
    updateSentence();

    // Reset recording state and re-enable listen/bookmark buttons
    isRecording = false;
    toggleListenButtons(false);
    toggleBookmarkButtons(false);

    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
  } else {
    // All sentences in the current lesson completed
    const congratulationModal = new bootstrap.Modal(
      document.getElementById("congratulationModal")
    );

    // Update the modal content
    sentencesSpokenDiv.textContent = totalSentencesSpoken;
    overallScoreDiv.textContent = `${Math.round(
      totalPronunciationScore / totalSentencesSpoken
    )}%`;

    congratulationModal.show(); // Show the congratulation modal
  }
});

// Continue button logic
continueButton.addEventListener("click", () => {
  const congratulationModal = bootstrap.Modal.getInstance(
    document.getElementById("congratulationModal")
  );
  congratulationModal.hide(); // Hide the modal
});
