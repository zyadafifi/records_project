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
const currentSentenceElement = document.querySelector(".current-count");
const totalSentencesElement = document.querySelector(".total-count");
let noSpeechTimeout;
const NO_SPEECH_TIMEOUT_MS = 3000; // 3 seconds timeout to detect speech

// AssemblyAI API Key
const ASSEMBLYAI_API_KEY = "bdb00961a07c4184889a80206c52b6f2"; // Replace with your AssemblyAI API key

// Create a backdrop for the dialog
const dialogBackdrop = document.createElement("div");
dialogBackdrop.classList.add("dialog-backdrop");
document.body.appendChild(dialogBackdrop);

// Hide the dialog backdrop initially
dialogBackdrop.style.display = "none";

// Function to open the dialog
function openDialog() {
  dialogContainer.style.display = "block";
  dialogBackdrop.style.display = "block";
}

// Function to close the dialog
function closeDialog() {
  dialogContainer.style.display = "none";
  dialogBackdrop.style.display = "none";
}
// JavaScript for mobile support
function addButtonActiveClass(e) {
  e.currentTarget.classList.add("button-active");
  setTimeout(() => e.currentTarget.classList.remove("button-active"), 200);
}

micButton.addEventListener("touchstart", addButtonActiveClass);
listenButton.addEventListener("touchstart", addButtonActiveClass);
// ... and so on for other buttons
// Event listeners for closing the dialog
document.querySelector(".close-icon").addEventListener("click", closeDialog);
dialogBackdrop.addEventListener("click", closeDialog);

// Global variables
let isSpeaking = false;
let isPlaying = false;
let currentUtterance = null;
let currentAudio = null;
let lessons = []; // Stores loaded lessons
let currentLessonIndex = 0; // Tracks the current lesson
let currentSentenceIndex = 0; // Tracks the current sentence in the lesson
let totalSentencesSpoken = 0; // Tracks total sentences spoken
let totalPronunciationScore = 0; // Tracks total pronunciation score
let mediaRecorder;
let audioChunks = [];
let recordedAudioBlob; // Stores the recorded audio blob
let isRecording = false; // Flag to track recording state
let speechDetected = false; // Flag to track if speech was detected
retryButton.style.display = "none"; // Hide retry button initially

// AudioContext for sound effects and waveform
let audioContext;

// Waveform specific variables
let analyser;
let dataArray;
let canvasCtx;
let animationId;
let waveformCanvas;
let recordingStartTime;
let waveformContainer; // Container for canvas and buttons
let stopRecButton; // Stop button
let deleteRecButton; // Delete button
let isRecordingCancelled = false; // Flag for cancellation

// Function to initialize AudioContext
function initializeAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log("AudioContext initialized.");
  }
}

// Function to resume AudioContext
async function resumeAudioContext() {
  if (audioContext && audioContext.state === "suspended") {
    try {
      await audioContext.resume();
      console.log("AudioContext resumed.");
    } catch (error) {
      console.error("Failed to resume AudioContext:", error);
    }
  }
}

// Function to create and setup waveform visualization
function setupWaveformVisualization(stream) {
  if (!audioContext) {
    console.error("Cannot setup waveform: AudioContext not initialized.");
    return;
  }

  // Create container if it doesn't exist
  // Create container if it doesn't exist
  if (!waveformContainer) {
    waveformContainer = document.createElement("div");
    waveformContainer.id = "waveformContainer";
    waveformContainer.style.display = "flex";
    waveformContainer.style.flexDirection = "column";
    waveformContainer.style.justifyContent = "space-between";
    waveformContainer.style.alignItems = "center";
    waveformContainer.style.width = "100%";
    waveformContainer.style.marginTop = "10px";
    waveformContainer.style.padding = "5px 15px"; // Reduced padding
    waveformContainer.style.backgroundColor = "#4b9b94";
    waveformContainer.style.borderRadius = "30px";
    waveformContainer.style.display = "none";
    waveformContainer.style.height = "40px";
    // Create inner container for buttons and waveform
    const controlsContainer = document.createElement("div");
    controlsContainer.style.display = "flex";
    controlsContainer.style.alignItems = "center";
    controlsContainer.style.width = "100%";
    controlsContainer.style.height = "30px"; // Reduced height
    controlsContainer.style.justifyContent = "space-between";
    controlsContainer.style.marginTop = "0"; // Removed margin
    controlsContainer.style.marginBottom = "0";
    controlsContainer.style.padding = "0 15px";
    controlsContainer.style.gap = "10px";

    // Create timer element
    const timerElement = document.createElement("div");
    timerElement.id = "recordingTimer";
    timerElement.style.color = "#908c8c";
    timerElement.style.fontSize = "12px"; // Smaller font
    timerElement.style.fontWeight = "bold";
    timerElement.style.textShadow = "0 1px 2px rgba(0,0,0,0.3)";
    timerElement.style.marginTop = "11px"; // Reduced margin
    timerElement.textContent = "0:00";

    // Create and style buttons
    deleteRecButton = document.createElement("button");
    deleteRecButton.id = "deleteRecButton";
    deleteRecButton.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
    deleteRecButton.title = "Cancel Recording";
    deleteRecButton.style.background = "none";
    deleteRecButton.style.border = "none";
    deleteRecButton.style.color = "#f0f0f0";
    deleteRecButton.style.fontSize = "1em"; // Smaller icon
    deleteRecButton.style.cursor = "pointer";
    deleteRecButton.style.padding = "0 8px";

    stopRecButton = document.createElement("button");
    stopRecButton.id = "stopRecButton";
    stopRecButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
    stopRecButton.title = "Send Recording";

    // Create waveform canvas
    waveformCanvas = document.createElement("canvas");
    waveformCanvas.id = "waveformCanvas";
    waveformCanvas.style.width = "100%";
    waveformCanvas.style.height = "25px"; // Reduced height
    waveformCanvas.style.borderRadius = "30px";
    waveformCanvas.style.flexGrow = "1";
    waveformCanvas.style.margin = "0";

    // Build the structure
    controlsContainer.appendChild(deleteRecButton);
    controlsContainer.appendChild(waveformCanvas);
    controlsContainer.appendChild(stopRecButton);
    deleteRecButton.addEventListener("click", handleDeleteRecording);
    stopRecButton.addEventListener("click", handleStopRecording);

    waveformContainer.appendChild(controlsContainer);
    waveformContainer.appendChild(timerElement);

    // Insert into DOM
    const micButtonContainer = micButton.parentElement;
    if (micButtonContainer && micButtonContainer.parentNode) {
      micButtonContainer.parentNode.insertBefore(
        waveformContainer,
        micButtonContainer.nextSibling
      );
    } else {
      document.body.appendChild(waveformContainer);
    }

    // Insert container into DOM (adjust placement as needed)
    if (micButtonContainer && micButtonContainer.parentNode) {
      micButtonContainer.parentNode.insertBefore(
        waveformContainer,
        micButtonContainer.nextSibling
      );
      console.log("Waveform container with buttons added to DOM.");
    } else {
      console.error(
        "Could not find suitable parent to insert waveform container."
      );
      document.body.appendChild(waveformContainer); // Fallback
    }
  }

  // Get canvas context
  canvasCtx = waveformCanvas.getContext("2d");

  // Create analyzer
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 128;
  analyser.smoothingTimeConstant = 0.8;

  // Connect stream to analyzer
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  // Create data array
  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  // Reset cancellation flag
  isRecordingCancelled = false;

  // Make container visible and start drawing
  waveformContainer.style.display = "flex"; // Show container
  stopRecButton.disabled = false; // Ensure buttons are enabled
  deleteRecButton.disabled = false;
  drawWhatsAppWaveform();
  console.log("Waveform drawing started.");
}

// Function to draw WhatsApp-style waveform
function drawWhatsAppWaveform() {
  if (!isRecording || !analyser || !canvasCtx || !dataArray) return;

  animationId = requestAnimationFrame(drawWhatsAppWaveform);

  // Get frequency data
  analyser.getByteFrequencyData(dataArray);

  // Clear canvas
  canvasCtx.fillStyle = "#4b9b94";
  canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

  // Draw bars
  const barCount = 20;
  const barWidth = 6;
  const barSpacing = 3;
  const totalBarAreaWidth = barCount * (barWidth + barSpacing) - barSpacing;
  const startX = (waveformCanvas.width - totalBarAreaWidth) / 2;
  const maxBarHeight = waveformCanvas.height * 0.8;

  canvasCtx.fillStyle = "#f0f0f0";

  for (let i = 0; i < barCount; i++) {
    const dataIndex = Math.floor((i * dataArray.length) / barCount);
    const value = dataArray[dataIndex];
    const barHeight = Math.max(2, (value / 255) * maxBarHeight);
    const x = startX + i * (barWidth + barSpacing);
    const y = (waveformCanvas.height - barHeight) / 2;
    canvasCtx.fillRect(x, y, barWidth, barHeight);
  }

  // Update the external timer element
  if (recordingStartTime) {
    const recordingTime = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(recordingTime / 60);
    const seconds = recordingTime % 60;
    const timeText = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

    const timerElement = document.getElementById("recordingTimer");
    if (timerElement) {
      timerElement.textContent = timeText;
    }
  }
}

// --- Button Click Handlers ---

function handleStopRecording() {
  console.log("Stop button clicked.");
  if (mediaRecorder && mediaRecorder.state === "recording") {
    console.log("Calling mediaRecorder.stop() via button.");
    stopRecButton.disabled = true; // Prevent double clicks
    deleteRecButton.disabled = true;
    mediaRecorder.stop();
  }
}

function handleDeleteRecording() {
  console.log("Delete button clicked.");
  isRecordingCancelled = true; // Set the flag

  if (mediaRecorder && mediaRecorder.state === "recording") {
    console.log("Stopping MediaRecorder immediately for cancellation.");
    // Stop recorder without triggering normal onstop processing logic
    mediaRecorder.onstop = null; // Detach the normal handler temporarily
    mediaRecorder.stop();
  }

  // Stop visualization and audio stream directly
  stopWaveformVisualization();
  if (mediaRecorder && mediaRecorder.stream) {
    console.log("Stopping media stream tracks for cancellation.");
    mediaRecorder.stream.getTracks().forEach((track) => track.stop());
  }

  // Reset the UI immediately
  console.log("Calling resetUI for cancellation.");
  resetUI();

  // Optionally provide feedback
  recognizedTextDiv.textContent = "(Recording cancelled)";
}

// Function to stop waveform visualization and clean up
function stopWaveformVisualization() {
  console.log("Stopping waveform visualization.");
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (analyser) {
    analyser.disconnect();
    analyser = null;
  }

  // Reset the timer display
  const timerElement = document.getElementById("recordingTimer");
  if (timerElement) {
    timerElement.textContent = "0:00";
  }

  if (waveformContainer) {
    waveformContainer.style.display = "none";
  }

  if (waveformCanvas && canvasCtx) {
    canvasCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
  }
  dataArray = null;
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
  document.getElementById("recordingIndicator").style.display = "none";

  // Stop and hide waveform visualization
  stopWaveformVisualization(); // This now hides the container

  // Reset recording state and re-enable buttons
  isRecording = false;
  isRecordingCancelled = false; // Reset cancellation flag here
  mediaRecorder = null; // Ensure recorder instance is cleared
  recordingStartTime = null;
  speechDetected = false;
  toggleListenButtons(false);
  toggleBookmarkButtons(false);

  // Clear the timeouts
  clearTimeout(noSpeechTimeout);
  clearTimeout(recordingTimeout);
  console.log("UI Reset completed.");
}
function updateSentenceCounter() {
  if (lessons.length === 0 || currentLessonIndex === -1) return;

  const currentLesson = lessons[currentLessonIndex];
  currentSentenceElement.textContent = currentSentenceIndex + 1;
  totalSentencesElement.textContent = currentLesson.sentences.length;
}
// Update the displayed sentence and reset UI
function updateSentence() {
  if (lessons.length === 0) return; // Ensure lessons are loaded
  const currentLesson = lessons[currentLessonIndex];

  // Update the sentence
  sentenceElement.textContent = currentLesson.sentences[currentSentenceIndex];
  updateSentenceCounter();

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

// Speak the sentence using the Web Speech API
function speakSentence() {
  // Check if currently recording - if so, don't allow listening
  if (isRecording) {
    console.log("Cannot listen while recording");
    alert(
      "Cannot listen to example while recording. Please finish recording first."
    );
    return;
  }

  if (isSpeaking) {
    // If already speaking, stop the speech
    speechSynthesis.cancel();
    isSpeaking = false;
    updateListenButtonIcon();
    return;
  }

  // Check if lessons are loaded and valid
  if (!lessons || lessons.length === 0 || currentLessonIndex === -1) {
    console.log("No lessons loaded yet");
    alert("Please wait for lessons to load.");
    return;
  }

  const currentLesson = lessons[currentLessonIndex];
  if (
    !currentLesson ||
    !currentLesson.sentences ||
    !currentLesson.sentences[currentSentenceIndex]
  ) {
    console.log("Current lesson or sentence not found");
    alert("Current sentence not available.");
    return;
  }

  const sentence = currentLesson.sentences[currentSentenceIndex];

  // Update button immediately
  isSpeaking = true;
  updateListenButtonIcon();

  currentUtterance = new SpeechSynthesisUtterance(sentence);
  currentUtterance.lang = "en-US";

  currentUtterance.onend = function () {
    isSpeaking = false;
    setTimeout(() => {
      updateListenButtonIcon(); // This will show the sound icon again
    }, 100); // Small delay to ensure smooth transition
  };

  currentUtterance.onerror = function () {
    isSpeaking = false;
    setTimeout(() => {
      updateListenButtonIcon(); // This will show the sound icon again
    }, 100); // Small delay to ensure smooth transition
  };

  speechSynthesis.speak(currentUtterance);
}

// Modified playRecordedAudio function with toggle functionality
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

  if (isPlaying) {
    // If already playing, stop the audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    isPlaying = false;
    updateBookmarkIcons();
    return;
  }

  const audioURL = URL.createObjectURL(recordedAudioBlob);
  currentAudio = new Audio(audioURL);

  // Update button immediately
  isPlaying = true;
  updateBookmarkIcons();

  currentAudio.play();

  currentAudio.onended = function () {
    isPlaying = false;
    updateBookmarkIcons();
  };

  currentAudio.onerror = function () {
    isPlaying = false;
    updateBookmarkIcons();
  };
}
function updateListenButtonIcon() {
  if (isSpeaking) {
    listenButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" style="color: #4b9b94; width: 24px; height: 24px; background-color: white; transition: all 0.3s ease;">
        <path fill="#4b9b94" d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"/>
      </svg>`;
    listen2Button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" style="color: #4b9b94; width: 24px; height: 24px; background-color: white; transition: all 0.3s ease;">
        <path fill="#4b9b94" d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"/>
      </svg>`;
    listenButton.title = "Stop playback";
    listen2Button.title = "Stop playback";
  } else {
    listenButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="color: #4b9b94; width: 24px; height: 24px; background-color: white; transition: all 0.3s ease;">
        <path fill="#4b9b94" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"/>
      </svg>`;
    listen2Button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="color: #4b9b94; width: 24px; height: 24px; background-color: white; transition: all 0.3s ease;">
        <path fill="#4b9b94" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"/>
      </svg>`;
    listenButton.title = "Listen to example";
    listen2Button.title = "Listen to example";
  }
}

//Function to update bookmark icons
function updateBookmarkIcons() {
  if (isPlaying) {
    // When audio is playing - show pause icon
    bookmarkIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" style="color: #4b9b94; width: 24px; height: 24px; background-color: white; transition: all 0.3s ease;">
        <path fill="#4b9b94" d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"/>
      </svg>`;
    bookmarkIcon2.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" style="color: #4b9b94; width: 24px; height: 24px; background-color: white; transition: all 0.3s ease;">
        <path fill="#4b9b94" d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"/>
      </svg>`;
    bookmarkIcon.title = "Stop playback";
    bookmarkIcon2.title = "Stop playback";
  } else {
    // When no audio is playing - show ear icon
    bookmarkIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="color: #4b9b94; width: 24px; height: 24px; background-color: white; transition: all 0.3s ease;">
        <path fill="#4b9b94" d="M398.3 3.4c-15.8-7.9-35-1.5-42.9 14.3c-7.9 15.8-1.5 34.9 14.2 42.9l.4 .2c.4 .2 1.1 .6 2.1 1.2c2 1.2 5 3 8.7 5.6c7.5 5.2 17.6 13.2 27.7 24.2C428.5 113.4 448 146 448 192c0 17.7 14.3 32 32 32s32-14.3 32-32c0-66-28.5-113.4-56.5-143.7C441.6 33.2 427.7 22.2 417.3 15c-5.3-3.7-9.7-6.4-13-8.3c-1.6-1-3-1.7-4-2.2c-.5-.3-.9-.5-1.2-.7l-.4-.2-.2-.1c0 0 0 0-.1 0c0 0 0 0 0 0L384 32 398.3 3.4zM128.7 227.5c6.2-56 53.7-99.5 111.3-99.5c61.9 0 112 50.1 112 112c0 29.3-11.2 55.9-29.6 75.9c-17 18.4-34.4 45.1-34.4 78l0 6.1c0 26.5-21.5 48-48 48c-17.7 0-32 14.3-32 32s14.3 32 32 32c61.9 0 112-50.1 112-112l0-6.1c0-9.8 5.4-21.7 17.4-34.7C398.3 327.9 416 286 416 240c0-97.2-78.8-176-176-176C149.4 64 74.8 132.5 65.1 220.5c-1.9 17.6 10.7 33.4 28.3 35.3s33.4-10.7 35.3-28.3zM32 512a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM192 352a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3l64 64c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-64-64c-12.5-12.5-32.8-12.5-45.3 0zM208 240c0-17.7 14.3-32 32-32s32 14.3 32 32c0 13.3 10.7 24 24 24s24-10.7 24-24c0-44.2-35.8-80-80-80s-80 35.8-80 80c0 13.3 10.7 24 24 24s24-10.7 24-24z"/>
      </svg>`;
    bookmarkIcon2.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="color: #4b9b94; width: 24px; height: 24px; background-color: white; transition: all 0.3s ease;">
        <path fill="#4b9b94" d="M398.3 3.4c-15.8-7.9-35-1.5-42.9 14.3c-7.9 15.8-1.5 34.9 14.2 42.9l.4 .2c.4 .2 1.1 .6 2.1 1.2c2 1.2 5 3 8.7 5.6c7.5 5.2 17.6 13.2 27.7 24.2C428.5 113.4 448 146 448 192c0 17.7 14.3 32 32 32s32-14.3 32-32c0-66-28.5-113.4-56.5-143.7C441.6 33.2 427.7 22.2 417.3 15c-5.3-3.7-9.7-6.4-13-8.3c-1.6-1-3-1.7-4-2.2c-.5-.3-.9-.5-1.2-.7l-.4-.2-.2-.1c0 0 0 0-.1 0c0 0 0 0 0 0L384 32 398.3 3.4zM128.7 227.5c6.2-56 53.7-99.5 111.3-99.5c61.9 0 112 50.1 112 112c0 29.3-11.2 55.9-29.6 75.9c-17 18.4-34.4 45.1-34.4 78l0 6.1c0 26.5-21.5 48-48 48c-17.7 0-32 14.3-32 32s14.3 32 32 32c61.9 0 112-50.1 112-112l0-6.1c0-9.8 5.4-21.7 17.4-34.7C398.3 327.9 416 286 416 240c0-97.2-78.8-176-176-176C149.4 64 74.8 132.5 65.1 220.5c-1.9 17.6 10.7 33.4 28.3 35.3s33.4-10.7 35.3-28.3zM32 512a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM192 352a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3l64 64c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-64-64c-12.5-12.5-32.8-12.5-45.3 0zM208 240c0-17.7 14.3-32 32-32s32 14.3 32 32c0 13.3 10.7 24 24 24s24-10.7 24-24c0-44.2-35.8-80-80-80s-80 35.8-80 80c0 13.3 10.7 24 24 24s24-10.7 24-24z"/>
      </svg>`;
    bookmarkIcon.title = "Play recorded audio";
    bookmarkIcon2.title = "Play recorded audio";
  }
}
// Event listeners
listenButton.addEventListener("click", function () {
  // Add visual feedback
  this.classList.add("active");
  setTimeout(() => this.classList.remove("active"), 200);
  speakSentence();
});

listen2Button.addEventListener("click", function () {
  // Add visual feedback
  this.classList.add("active");
  setTimeout(() => this.classList.remove("active"), 200);
  speakSentence();
});

bookmarkIcon.addEventListener("click", function () {
  // Add visual feedback
  this.classList.add("active");
  setTimeout(() => this.classList.remove("active"), 200);
  playRecordedAudio();
});

bookmarkIcon2.addEventListener("click", function () {
  // Add visual feedback
  this.classList.add("active");
  setTimeout(() => this.classList.remove("active"), 200);
  playRecordedAudio();
});

// Add this CSS for click feedback
const style = document.createElement("style");
style.textContent = `
  #listenButton.active, #listen2Button.active,
  .bookmark-icon.active, #bookmark-icon2.active {
    transform: scale(0.95);
    transition: transform 0.2s ease;
  }
  #listenButton, #listen2Button,
  .bookmark-icon, #bookmark-icon2 {
    transition: transform 0.2s ease, opacity 0.2s ease;
    cursor: pointer;
  }
  .icon-circle {
    transition: all 0.3s ease;
  }
  .icon-circle:hover {
    transform: scale(1.05);
  }
  .icon-circle:active {
    transform: scale(0.95);
  }
`;
document.head.appendChild(style);

// Load lessons from the JSON file
async function loadLessons() {
  try {
    const url =
      "https://raw.githubusercontent.com/zyadafifi/lessons/main/lessons.json"; // Replace with your JSON URL
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch lessons: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Fetched data:", data); // Log the fetched data for debugging

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
    updateSentenceCounter();
    updateSimpleProgress();
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

// Update the retry button handler to clear the timeout
retryButton.addEventListener("click", () => {
  // Clear any existing recording timeout
  if (recordingTimeout) {
    clearTimeout(recordingTimeout);
  }

  // First close the dialog to show the sentence again
  closeDialog();

  // Reset UI without changing the sentence
  resetUI();

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
    updateSentenceCounter();
    updateSimpleProgress();
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

  // Reset icons container to default state
  const iconsContainer = document.querySelector(".icons-container");
  if (iconsContainer) {
    // Reset mic button
    micButton.innerHTML = '<i class="fas fa-microphone mic-icon"></i>';
    micButton.style.color = "#fff";
    micButton.style.backgroundColor = "";
    micButton.style.display = "inline-block";
    micButton.disabled = false;
    micButton.style.opacity = "1";

    // Reset listen button
    listenButton.disabled = false;
    listenButton.style.opacity = "1";

    // Hide recording indicator
    document.getElementById("recordingIndicator").style.display = "none";

    // Make sure the mic circle is visible and properly styled
    micButton.classList.remove("recording");
    micButton.style.animation = "pulse 2s infinite, glow 2s infinite alternate";
  }
});

function updateProgressBar(percentage) {
  const progressFill = document.querySelector(".progress-fill");
  const progressPercentage = document.querySelector(".progress-percentage");

  progressFill.style.width = `${percentage}%`;
  progressPercentage.textContent = `${percentage}%`;
}

// Add simple progress bar update function
function updateSimpleProgress() {
  if (lessons.length === 0 || currentLessonIndex === -1) return;

  const currentLesson = lessons[currentLessonIndex];
  const totalSentences = currentLesson.sentences.length;
  const progress = (currentSentenceIndex / totalSentences) * 100;

  const simpleProgressFill = document.querySelector(".simple-progress-fill");
  const simpleProgressPercentage = document.querySelector(
    ".simple-progress-percentage"
  );

  if (simpleProgressFill) {
    simpleProgressFill.style.width = `${progress}%`;
  }
  if (simpleProgressPercentage) {
    simpleProgressPercentage.textContent = `${Math.round(progress)}%`;
  }
}

// Function to start audio recording
async function startAudioRecording() {
  try {
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Initialize recording state
    isRecording = true;
    audioChunks = [];
    recordingStartTime = Date.now();
    speechDetected = false;

    // Show recording indicator
    document.getElementById("recordingIndicator").style.display = "block";

    // Setup waveform visualization
    setupWaveformVisualization(stream);

    // Create MediaRecorder instance
    mediaRecorder = new MediaRecorder(stream);

    // Handle data available event
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    // Handle recording stop event
    mediaRecorder.onstop = async () => {
      if (isRecordingCancelled) {
        console.log("Recording was cancelled, not processing audio.");
        return;
      }

      // Create audio blob from chunks
      recordedAudioBlob = new Blob(audioChunks, { type: "audio/wav" });

      // Stop all tracks in the stream
      stream.getTracks().forEach((track) => track.stop());

      // Process the recorded audio
      await processRecordedAudio(recordedAudioBlob);
    };

    // Start recording
    mediaRecorder.start();

    // Set timeout for no speech detection
    noSpeechTimeout = setTimeout(() => {
      if (
        !speechDetected &&
        mediaRecorder &&
        mediaRecorder.state === "recording"
      ) {
        console.log("No speech detected, stopping recording");
        mediaRecorder.stop();
      }
    }, NO_SPEECH_TIMEOUT_MS);
  } catch (error) {
    console.error("Error starting audio recording:", error);
    alert(
      "Error accessing microphone. Please ensure you have granted microphone permissions."
    );
    resetUI();
  }
}

// Function to process recorded audio
async function processRecordedAudio(audioBlob) {
  try {
    // Create FormData and append audio
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");

    // Send to AssemblyAI for transcription
    const response = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to upload audio");
    }

    const { upload_url } = await response.json();

    // Get transcription
    const transcriptResponse = await fetch(
      "https://api.assemblyai.com/v2/transcript",
      {
        method: "POST",
        headers: {
          Authorization: ASSEMBLYAI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio_url: upload_url,
          language_code: "en",
        }),
      }
    );

    if (!transcriptResponse.ok) {
      throw new Error("Failed to get transcription");
    }

    const { text } = await transcriptResponse.json();

    // Get current sentence
    const currentLesson = lessons[currentLessonIndex];
    const expectedSentence = currentLesson.sentences[currentSentenceIndex];

    // Calculate pronunciation score
    const score = calculatePronunciationScore(text, expectedSentence);

    // Update UI with results
    updateProgressCircle(score);
    openDialog();

    // Update statistics
    totalSentencesSpoken++;
    totalPronunciationScore += score;
  } catch (error) {
    console.error("Error processing audio:", error);
    alert("Error processing audio. Please try again.");
    resetUI();
  }
}
