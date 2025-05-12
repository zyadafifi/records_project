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
const bookmarkIcon = document.getElementById("bookmarkIcon");
const bookmarkIcon2 = document.getElementById("bookmark-icon2");
const currentSentenceElement = document.querySelector(".current-count");
const totalSentencesElement = document.querySelector(".total-count");

// Global variables
let isSpeaking = false;
let isPlaying = false;
let currentUtterance = null;
let currentAudio = null;
let lessons = []; // Stores loaded lessons
let currentLessonIndex = 0; // Tracks the current lesson
let currentSentenceIndex = 0; // Tracks the current sentence in the lesson
let totalPronunciationScore = 0; // Tracks total pronunciation score
let mediaRecorder;
let audioChunks = [];
let recordedAudioBlob; // Stores the recorded audio blob
let isRecording = false; // Flag to track recording state
let speechDetected = false; // Flag to track if speech was detected
let noSpeechTimeout;
const NO_SPEECH_TIMEOUT_MS = 3000; // 3 seconds timeout to detect speech

// Sound effect variables
let soundEffects = {
  success: null,
  failure: null,
  progress: null,
};

// Function to create and load sound effects
async function initializeSoundEffects() {
  try {
    // Create audio context if not exists
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Create oscillator for success sound (high pitch, short duration)
    const successOsc = audioContext.createOscillator();
    const successGain = audioContext.createGain();
    successOsc.type = "sine";
    successOsc.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
    successGain.gain.setValueAtTime(0.3, audioContext.currentTime);
    successOsc.connect(successGain);
    successGain.connect(audioContext.destination);
    soundEffects.success = { osc: successOsc, gain: successGain };

    // Create oscillator for failure sound (low pitch, short duration)
    const failureOsc = audioContext.createOscillator();
    const failureGain = audioContext.createGain();
    failureOsc.type = "sine";
    failureOsc.frequency.setValueAtTime(220, audioContext.currentTime); // A3 note
    failureGain.gain.setValueAtTime(0.3, audioContext.currentTime);
    failureOsc.connect(failureGain);
    failureGain.connect(audioContext.destination);
    soundEffects.failure = { osc: failureOsc, gain: failureGain };

    // Create oscillator for progress sound (medium pitch, very short duration)
    const progressOsc = audioContext.createOscillator();
    const progressGain = audioContext.createGain();
    progressOsc.type = "sine";
    progressOsc.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
    progressGain.gain.setValueAtTime(0.2, audioContext.currentTime);
    progressOsc.connect(progressGain);
    progressGain.connect(audioContext.destination);
    soundEffects.progress = { osc: progressOsc, gain: progressGain };
  } catch (error) {
    console.error("Error initializing sound effects:", error);
  }
}

// Function to play sound effects
function playSoundEffect(type) {
  if (!audioContext || !soundEffects[type]) return;

  try {
    // Create new oscillator and gain node
    const newOsc = audioContext.createOscillator();
    const newGain = audioContext.createGain();

    // Set up the sound
    newOsc.type = soundEffects[type].osc.type;
    newOsc.frequency.setValueAtTime(
      soundEffects[type].osc.frequency.value,
      audioContext.currentTime
    );
    newGain.gain.setValueAtTime(
      soundEffects[type].gain.gain.value,
      audioContext.currentTime
    );

    // Connect nodes
    newOsc.connect(newGain);
    newGain.connect(audioContext.destination);

    // Play the sound
    newOsc.start();

    // Set duration based on type
    let duration = 0.1; // Default duration
    if (type === "success") duration = 0.2;
    else if (type === "failure") duration = 0.3;

    // Fade out and stop
    newGain.gain.setValueAtTime(newGain.gain.value, audioContext.currentTime);
    newGain.gain.linearRampToValueAtTime(
      0,
      audioContext.currentTime + duration
    );

    // Schedule the stop
    setTimeout(() => {
      try {
        newOsc.stop();
        newOsc.disconnect();
        newGain.disconnect();
      } catch (error) {
        console.error("Error cleaning up sound effect:", error);
      }
    }, duration * 1000);
  } catch (error) {
    console.error("Error playing sound effect:", error);
  }
}

// Initialize sound effects when the page loads
window.addEventListener("DOMContentLoaded", initializeSoundEffects);

// Translation related variables
let isTranslated = false;
let currentTranslation = null;
const GOOGLE_TRANSLATE_API_KEY = "YOUR_GOOGLE_TRANSLATE_API_KEY"; // Replace with your API key

// DOM Elements for translation
const translateButton = document.getElementById("translateButton");
const translationContainer = document.getElementById("translationContainer");
const translationText = document.querySelector(".translation-text");

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

// Audio elements for sound effects
let soundsInitialized = false;

// Create a backdrop for the dialog
const dialogBackdrop = document.createElement("div");
dialogBackdrop.classList.add("dialog-backdrop");
document.body.appendChild(dialogBackdrop);

// Hide the dialog backdrop initially
dialogBackdrop.style.display = "none";

// Function to initialize AudioContext
function initializeAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
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
    updateBookmarkIcons();
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
    updateListenButtonIcon();
  }
}

// Function to open the dialog
function openDialog() {
  dialogContainer.style.display = "block";
  dialogBackdrop.style.display = "block";
  // Add a small delay to ensure display: block is applied before adding active class
  setTimeout(() => {
    dialogContainer.classList.add("active");
  }, 10);
}

// Function to close the dialog
function closeDialog() {
  dialogContainer.classList.remove("active");
  // Wait for animation to complete before hiding
  setTimeout(() => {
    dialogContainer.style.display = "none";
    dialogBackdrop.style.display = "none";
  }, 300);
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

// Add this after the global variables section
let sentenceScores = []; // Array to store individual sentence scores
let completedSentences = new Set(); // Track completed sentences

// Constants for recording
const RECORDING_DURATION = 5000; // 5 seconds recording time
let recordingTimeout;

// AssemblyAI API Key
const ASSEMBLYAI_API_KEY = "bdb00961a07c4184889a80206c52b6f2"; // Replace with your AssemblyAI API key

// Function to create and setup waveform visualization
function setupWaveformVisualization(stream) {
  if (!audioContext) {
    console.error("Cannot setup waveform: AudioContext not initialized.");
    return;
  }

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
    waveformContainer.style.padding = "5px 15px";
    waveformContainer.style.background =
      "linear-gradient(135deg, #4b9b94 0%, #2c7873 100%)";
    waveformContainer.style.borderRadius = "30px";
    waveformContainer.style.display = "none";
    waveformContainer.style.height = "40px";
    waveformContainer.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.1)";
    waveformContainer.style.transition = "all 0.3s ease";
    waveformContainer.style.position = "relative";
    waveformContainer.style.overflow = "hidden";

    // Create inner container for buttons and waveform
    const controlsContainer = document.createElement("div");
    controlsContainer.style.display = "flex";
    controlsContainer.style.alignItems = "center";
    controlsContainer.style.width = "100%";
    controlsContainer.style.height = "30px";
    controlsContainer.style.justifyContent = "space-between";
    controlsContainer.style.marginTop = "0";
    controlsContainer.style.marginBottom = "0";
    controlsContainer.style.padding = "0 15px";
    controlsContainer.style.gap = "10px";

    // Create timer element
    const timerElement = document.createElement("div");
    timerElement.id = "recordingTimer";
    timerElement.style.color = "#908c8c";
    timerElement.style.fontSize = "12px";
    timerElement.style.fontWeight = "bold";
    timerElement.style.position = "relative";
    timerElement.style.marginTop = "11px";
    timerElement.style.textAlign = "center";
    timerElement.style.width = "100%";
    timerElement.textContent = "0:00";

    // Create and style buttons
    deleteRecButton = document.createElement("button");
    deleteRecButton.id = "deleteRecButton";
    deleteRecButton.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
    deleteRecButton.title = "Cancel Recording";
    deleteRecButton.style.background = "none";
    deleteRecButton.style.border = "none";
    deleteRecButton.style.color = "#f0f0f0";
    deleteRecButton.style.fontSize = "1em";
    deleteRecButton.style.cursor = "pointer";
    deleteRecButton.style.padding = "0 8px";
    deleteRecButton.style.transition = "all 0.3s ease";
    deleteRecButton.style.webkitTapHighlightColor = "transparent"; // Remove tap highlight on iOS

    stopRecButton = document.createElement("button");
    stopRecButton.id = "stopRecButton";
    stopRecButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
    stopRecButton.title = "Send Recording";
    stopRecButton.style.background = "white";
    stopRecButton.style.border = "none";
    stopRecButton.style.borderRadius = "50%";
    stopRecButton.style.width = "30px";
    stopRecButton.style.height = "30px";
    stopRecButton.style.display = "flex";
    stopRecButton.style.alignItems = "center";
    stopRecButton.style.justifyContent = "center";
    stopRecButton.style.cursor = "pointer";
    stopRecButton.style.color = "#4b9b94";
    stopRecButton.style.webkitTapHighlightColor = "transparent"; // Keep only this iOS compatibility improvement

    // Create waveform canvas
    waveformCanvas = document.createElement("canvas");
    waveformCanvas.id = "waveformCanvas";
    waveformCanvas.style.width = "100%";
    waveformCanvas.style.height = "25px";
    waveformCanvas.style.flexGrow = "1";
    waveformCanvas.style.margin = "0";
    waveformCanvas.style.background = "transparent";
    waveformCanvas.style.transition = "all 0.3s ease";
    waveformCanvas.style.position = "relative";
    waveformCanvas.style.zIndex = "1";

    // Build the structure
    controlsContainer.appendChild(deleteRecButton);
    controlsContainer.appendChild(waveformCanvas);
    controlsContainer.appendChild(stopRecButton);
    waveformContainer.appendChild(controlsContainer);

    // Add event listeners for the buttons
    deleteRecButton.addEventListener("click", handleDeleteRecording);
    deleteRecButton.addEventListener("touchend", function (e) {
      e.preventDefault(); // Prevent default touch behavior
      handleDeleteRecording();
    });

    stopRecButton.addEventListener("click", handleStopRecording);
    stopRecButton.addEventListener("touchend", function (e) {
      e.preventDefault(); // Prevent default touch behavior
      handleStopRecording();
    });

    // Create a separate container for the timer
    const timerContainer = document.createElement("div");
    timerContainer.style.width = "100%";
    style.display = "flex";
    timerContainer.style.justifyContent = "center";
    timerContainer.style.marginTop = "5px";
    timerContainer.appendChild(timerElement);

    // Get the parent container once
    const micButtonContainer = micButton.parentElement;
    if (micButtonContainer && micButtonContainer.parentNode) {
      // Insert both containers
      micButtonContainer.parentNode.insertBefore(
        waveformContainer,
        micButtonContainer.nextSibling
      );
      micButtonContainer.parentNode.insertBefore(
        timerContainer,
        waveformContainer.nextSibling
      );
    } else {
      document.body.appendChild(waveformContainer);
      document.body.appendChild(timerContainer);
    }

    // Add hover effects
    waveformContainer.addEventListener("mouseenter", () => {
      waveformContainer.style.background =
        "linear-gradient(135deg, #2c7873 0%, #4b9b94 100%)";
      waveformContainer.style.boxShadow = "0 4px 12px rgba(75, 155, 148, 0.3)";
    });

    waveformContainer.addEventListener("mouseleave", () => {
      waveformContainer.style.background =
        "linear-gradient(135deg, #4b9b94 0%, #2c7873 100%)";
      waveformContainer.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.1)";
    });
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
  canvasCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);

  // Draw bars
  const barCount = 20;
  const barWidth = 3;
  const barSpacing = 3;
  const totalBarAreaWidth = barCount * (barWidth + barSpacing) - barSpacing;
  const startX = (waveformCanvas.width - totalBarAreaWidth) / 2;
  const maxBarHeight = waveformCanvas.height * 0.8;

  canvasCtx.fillStyle = "#ffffff";

  for (let i = 0; i < barCount; i++) {
    const dataIndex = Math.floor((i * dataArray.length) / barCount);
    const value = dataArray[dataIndex];
    const barHeight = Math.max(3, (value / 255) * maxBarHeight);
    const x = startX + i * (barWidth + barSpacing);
    const y = (waveformCanvas.height - barHeight) / 2;

    // Draw rounded bars
    canvasCtx.beginPath();
    canvasCtx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
    canvasCtx.fill();
  }

  // Update the timer
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
  console.log("Stop button clicked/touched.");
  if (mediaRecorder && mediaRecorder.state === "recording") {
    console.log("Calling mediaRecorder.stop() via button.");
    stopRecButton.disabled = true; // Prevent double clicks
    deleteRecButton.disabled = true;

    // Add visual feedback
    stopRecButton.style.transform = "scale(0.95)";
    setTimeout(() => {
      stopRecButton.style.transform = "scale(1)";
    }, 100);

    try {
      mediaRecorder.stop();
    } catch (error) {
      console.error("Error stopping MediaRecorder:", error);
      // Fallback handling
      if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      }
      resetUI();
    }
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
  micButton.innerHTML = '<i class="fas fa-microphone mic-icon"></i>';
  micButton.style.color = "#fff";
  micButton.style.backgroundColor = "";
  micButton.style.display = "inline-block";
  micButton.style.opacity = "1";
  micButton.classList.remove("recording");
  micButton.style.animation = "pulse 2s infinite, glow 2s infinite alternate";
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

  // Reset the score for the current sentence
  if (sentenceScores[currentSentenceIndex] !== undefined) {
    totalPronunciationScore -= sentenceScores[currentSentenceIndex];
    sentenceScores[currentSentenceIndex] = 0;
    updateSimpleProgress();
  }

  // Remove current sentence from completed sentences when retrying
  completedSentences.delete(currentSentenceIndex);

  // Update progress to previous state
  updateSimpleProgress();

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
  if (lessons.length === 0) return;
  const currentLesson = lessons[currentLessonIndex];

  // Update the sentence
  sentenceElement.textContent = currentLesson.sentences[currentSentenceIndex];
  updateSentenceCounter();

  // Reset translation state
  isTranslated = false;
  currentTranslation = null;
  translationContainer.style.display = "none";
  translateButton.innerHTML =
    '<i class="fas fa-language"></i> <span>Translate to Arabic</span>';

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

  // Update progress
  updateSimpleProgress();
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

  // Change circle color based on score and play appropriate sound
  if (score >= 80) {
    progressCircle.style.stroke = "#0aa989"; // Green for high scores
    playSoundEffect("success");
  } else if (score >= 50) {
    progressCircle.style.stroke = "#ffa500"; // Orange for medium scores
    playSoundEffect("progress");
  } else {
    progressCircle.style.stroke = "#ff0000"; // Red for low scores
    playSoundEffect("failure");
  }
}

// Initialize audio context when the user first interacts with the page
function setupSoundInitialization() {
  const initializeOnInteraction = () => {
    initializeAudioContext();
    // Remove the event listeners after first interaction
    document.removeEventListener("click", initializeOnInteraction);
    document.removeEventListener("touchstart", initializeOnInteraction);
  };

  document.addEventListener("click", initializeOnInteraction);
  document.addEventListener("touchstart", initializeOnInteraction);
}

// Call setup when the page loads
window.addEventListener("DOMContentLoaded", setupSoundInitialization);

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
  let potentialMatches = [];

  for (let i = 0; i < sentenceWords.length; i++) {
    if (matchedSentenceIndices[i]) continue;

    for (let j = 0; j < transcriptWords.length; j++) {
      if (matchedTranscriptIndices[j]) continue;

      const similarity = calculateSimilarity(
        transcriptWords[j],
        sentenceWords[i]
      );
      if (similarity > 0) {
        potentialMatches.push({
          sentenceIndex: i,
          transcriptIndex: j,
          similarity: similarity,
          transcriptWord: transcriptWords[j],
          expectedWord: sentenceWords[i],
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
      if (match.similarity >= 0.85) {
        matchedSentenceIndices[match.sentenceIndex] = true;
        matchedTranscriptIndices[match.transcriptIndex] = true;
        correctWords += match.similarity;
      }
    }
  }

  // Generate the highlighted text for the original sentence
  let originalSentenceText = "";
  for (let i = 0; i < sentenceWords.length; i++) {
    const expectedWord = sentenceWords[i];
    originalSentenceText += `<span style="color: #333333;">${expectedWord}</span> `;
  }

  // Generate the highlighted text for the spoken sentence
  let spokenSentenceText = "";
  for (let j = 0; j < transcriptWords.length; j++) {
    if (!matchedTranscriptIndices[j]) {
      // This is an extra word
      spokenSentenceText += `<span style="color: red;">${transcriptWords[j]}</span> `;
    } else {
      // Find the corresponding word in the original sentence
      let found = false;
      for (let i = 0; i < sentenceWords.length; i++) {
        if (
          matchedSentenceIndices[i] &&
          calculateSimilarity(transcriptWords[j], sentenceWords[i]) >= 0.85
        ) {
          spokenSentenceText += `<span style="color: green;">${transcriptWords[j]}</span> `;
          found = true;
          break;
        }
      }
      if (!found) {
        spokenSentenceText += `<span style="color: red;">${transcriptWords[j]}</span> `;
      }
    }
  }

  // Display both sentences
  recognizedTextDiv.innerHTML = `
    <div style="margin-bottom: 10px;">
      <strong>Original:</strong><br>
      ${originalSentenceText.trim()}
    </div>
    <div>
      <strong>You said:</strong><br>
      ${spokenSentenceText.trim()}
    </div>
  `;

  // Show missing words
  if (missingWords.length > 0) {
    missingWordDiv.textContent = `Missing: ${missingWords.join(", ")}`;
  } else {
    missingWordDiv.textContent = "";
  }

  // Calculate pronunciation score with fractional correctness
  const pronunciationScore = (correctWords / sentenceWords.length) * 100;

  // Play sound effect based on score
  if (pronunciationScore >= 80) {
    playSoundEffect("success");
  } else if (pronunciationScore >= 50) {
    playSoundEffect("progress");
  } else {
    playSoundEffect("failure");
  }

  // Only add to completed sentences if score is good enough
  if (pronunciationScore >= 50) {
    completedSentences.add(currentSentenceIndex);
  }

  // Update the sentence score in our tracking array
  sentenceScores[currentSentenceIndex] = pronunciationScore;

  // Recalculate total score based on all sentence scores
  totalPronunciationScore = sentenceScores.reduce(
    (sum, score) => sum + score,
    0
  );

  // Update the "Continue" button color based on the score
  if (pronunciationScore < 50) {
    nextButton.style.background =
      "linear-gradient(135deg, #ff4444 0%, #cc0000 100%)";
  } else {
    nextButton.style.background =
      "linear-gradient(135deg, #4b9b94 0%, #2c7873 100%)";
  }

  // Update progress bar immediately after score calculation
  updateSimpleProgress();

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
    updateListenButtonIcon();
  };

  currentUtterance.onerror = function () {
    isSpeaking = false;
    updateListenButtonIcon();
  };

  speechSynthesis.speak(currentUtterance);
}

// Modified playRecordedAudio function with iOS compatibility
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

  // Initialize AudioContext if not already initialized
  initializeAudioContext();

  const audioURL = URL.createObjectURL(recordedAudioBlob);
  currentAudio = new Audio(audioURL);

  // Add iOS-specific error handling
  currentAudio.addEventListener("error", function (e) {
    console.error("Audio playback error:", e);
    alert("Error playing audio. Please try again.");
    isPlaying = false;
    updateBookmarkIcons();
  });

  // Update button immediately
  isPlaying = true;
  updateBookmarkIcons();

  // Use Promise-based play for better error handling
  const playPromise = currentAudio.play();

  if (playPromise !== undefined) {
    playPromise
      .then((_) => {
        // Playback started successfully
        console.log("Playback started successfully");
      })
      .catch((error) => {
        console.error("Playback failed:", error);
        isPlaying = false;
        updateBookmarkIcons();
        alert("Could not play audio. Please try again.");
      });
  }

  currentAudio.onended = function () {
    isPlaying = false;
    updateBookmarkIcons();
  };
}

function updateListenButtonIcon() {
  // Always keep the button circular, gradient, and with white icon
  [listenButton, listen2Button].forEach((btn) => {
    btn.style.background = "linear-gradient(135deg, #4b9b94 0%, #2c7873 100%)";
    btn.style.borderRadius = "50%";
    btn.style.padding = "8px";
    btn.style.display = "flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.boxShadow = "0 4px 12px rgba(75, 155, 148, 0.3)";
    btn.style.border = "none";
  });
  if (isSpeaking) {
    // Use the pause SVG (same as ear icon's pause)
    const pauseSVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 512' width='24' height='24'><path fill='white' d='M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z'/></svg>`;
    listenButton.innerHTML = pauseSVG;
    listen2Button.innerHTML = pauseSVG;
    listenButton.title = "Stop playback";
    listen2Button.title = "Stop playback";
  } else {
    // Use the speaker SVG for idle
    const soundSVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 512' width='24' height='24'><path fill='white' d='M533.6 32.5C598.5 85.3 640 165.8 640 256s-41.5 170.8-106.4 223.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C557.5 398.2 592 331.2 592 256s-34.5-142.2-88.7-186.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM473.1 107c43.2 35.2 70.9 88.9 70.9 149s-27.7 113.8-70.9 149c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C475.3 341.3 496 301.1 496 256s-20.7-85.3-53.2-111.8c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zm-60.5 74.5C434.1 199.1 448 225.9 448 256s-13.9 56.9-35.4 74.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C393.1 284.4 400 271 400 256s-6.9-28.4-17.7-37.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM301.1 34.8C312.6 40 320 51.4 320 64V448c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352H64c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64h67.8L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3z'/></svg>`;
    listenButton.innerHTML = soundSVG;
    listen2Button.innerHTML = soundSVG;
    listenButton.title = "Listen to example";
    listen2Button.title = "Listen to example";
  }
}

// Ensure updateListenButtonIcon is called after speech ends
if (window.speechSynthesis) {
  speechSynthesis.onend = function () {
    isSpeaking = false;
    updateListenButtonIcon();
  };
  speechSynthesis.onerror = function () {
    isSpeaking = false;
    updateListenButtonIcon();
  };
}

// Function to update bookmark icons
function updateBookmarkIcons() {
  [bookmarkIcon, bookmarkIcon2].forEach((btn) => {
    btn.style.background = "linear-gradient(135deg, #4b9b94 0%, #2c7873 100%)";
    btn.style.borderRadius = "50%";
    btn.style.padding = "8px";
    btn.style.display = "flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.boxShadow = "0 4px 12px rgba(75, 155, 148, 0.3)";
    btn.style.border = "none";
  });
  if (isPlaying) {
    // Use the same pause SVG as the listen button
    const pauseSVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 512' width='24' height='24'><path fill='white' d='M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z'/></svg>`;
    bookmarkIcon.innerHTML = pauseSVG;
    bookmarkIcon2.innerHTML = pauseSVG;
    bookmarkIcon.title = "Stop playback";
    bookmarkIcon2.title = "Stop playback";
  } else {
    // Use the ear SVG for idle, ensure fill='white' is set directly
    const earSVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' width='24' height='24'><path fill='white' d='M398.3 3.4c-15.8-7.9-35-1.5-42.9 14.3c-7.9 15.8-1.5 34.9 14.2 42.9l.4 .2c.4 .2 1.1 .6 2.1 1.2c2 1.2 5 3 8.7 5.6c7.5 5.2 17.6 13.2 27.7 24.2C428.5 113.4 448 146 448 192c0 17.7 14.3 32 32 32s32-14.3 32-32c0-66-28.5-113.4-56.5-143.7C441.6 33.2 427.7 22.2 417.3 15c-5.3-3.7-9.7-6.4-13-8.3c-1.6-1-3-1.7-4-2.2c-.5-.3-.9-.5-1.2-.7l-.4-.2-.2-.1c0 0 0 0-.1 0c0 0 0 0 0 0L384 32 398.3 3.4zM128.7 227.5c6.2-56 53.7-99.5 111.3-99.5c61.9 0 112 50.1 112 112c0 29.3-11.2 55.9-29.6 75.9c-17 18.4-34.4 45.1-34.4 78l0 6.1c0 26.5-21.5 48-48 48c-17.7 0-32 14.3-32 32s14.3 32 32 32c61.9 0 112-50.1 112-112l0-6.1c0-9.8 5.4-21.7 17.4-34.7C398.3 327.9 416 286 416 240c0-97.2-78.8-176-176-176C149.4 64 74.8 132.5 65.1 220.5c-1.9 17.6 10.7 33.4 28.3 35.3s33.4-10.7 35.3-28.3zM32 512a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM192 352a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3l64 64c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-64-64c-12.5-12.5-32.8-12.5-45.3 0zM208 240c0-17.7 14.3-32 32-32s32 14.3 32 32c0 13.3 10.7 24 24 24s24-10.7 24-24c0-44.2-35.8-80-80-80s-80 35.8-80 80c0 13.3 10.7 24 24 24s24-10.7 24-24z'/></svg>`;
    bookmarkIcon.innerHTML = earSVG;
    bookmarkIcon2.innerHTML = earSVG;
    bookmarkIcon.title = "Play recorded audio";
    bookmarkIcon2.title = "Play recorded audio";
  }
}

// Event listeners
listenButton.addEventListener("click", function () {
  if (isSpeaking) {
    // If already speaking, stop the speech
    speechSynthesis.cancel();
    isSpeaking = false;
    updateListenButtonIcon();
  } else {
    // Start speaking
    speakSentence();
  }
});

listen2Button.addEventListener("click", function () {
  if (isSpeaking) {
    speechSynthesis.cancel();
    isSpeaking = false;
    updateListenButtonIcon();
  } else {
    speakSentence();
  }
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
    transform: scale(0.9);
    transition: transform 0.1s;
  }
  #listenButton, #listen2Button,
  .bookmark-icon, #bookmark-icon2 {
    transition: transform 0.2s, opacity 0.2s;
    cursor: pointer;
  }
`;
document.head.appendChild(style);

// Force the ear icon SVG path to always be white
const forceEarIconWhiteStyle = document.createElement("style");
forceEarIconWhiteStyle.textContent = `
  .bookmark-icon svg path,
  #bookmark-icon2 svg path {
    fill: white !important;
    stroke: white !important;
  }
`;
document.head.appendChild(forceEarIconWhiteStyle);

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

    // Update the modal content with percentage of completed sentences
    const completionPercentage =
      (completedSentences.size / currentLesson.sentences.length) * 100;
    overallScoreDiv.textContent = `${Math.round(completionPercentage)}%`;

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

  // Calculate progress based on number of completed sentences
  const progress = (completedSentences.size / totalSentences) * 100;

  const simpleProgressFill = document.querySelector(".simple-progress-fill");
  const simpleProgressBar = document.querySelector(".simple-progress-bar");
  const simpleProgressPercentage = document.querySelector(
    ".simple-progress-percentage"
  );

  if (simpleProgressFill && simpleProgressBar) {
    // Get current width
    const startWidth = parseFloat(simpleProgressFill.style.width) || 0;
    const targetWidth = progress;

    // Update tooltip position
    simpleProgressBar.style.setProperty(
      "--progress-position",
      `${targetWidth}%`
    );
    simpleProgressBar.setAttribute("data-progress", `${Math.round(progress)}%`);

    // Animate the width change
    const startTime = performance.now();
    const duration = 800; // Slightly longer duration for smoother animation

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use cubic-bezier easing for smoother animation
      const easedProgress =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentWidth =
        startWidth + (targetWidth - startWidth) * easedProgress;
      simpleProgressFill.style.width = `${currentWidth}%`;

      // Update tooltip position during animation
      simpleProgressBar.style.setProperty(
        "--progress-position",
        `${currentWidth}%`
      );

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }

  if (simpleProgressPercentage) {
    // Animate the percentage text
    const startPercentage = parseInt(simpleProgressPercentage.textContent) || 0;
    const targetPercentage = Math.round(progress);

    const startTime = performance.now();
    const duration = 800; // Match the fill animation duration

    function animatePercentage(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use cubic-bezier easing
      const easedProgress =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentValue = Math.round(
        startPercentage + (targetPercentage - startPercentage) * easedProgress
      );
      simpleProgressPercentage.textContent = `${currentValue}%`;

      // Add a subtle scale effect during animation
      const scale = 1 + easedProgress * 0.1;
      simpleProgressPercentage.style.transform = `scale(${scale})`;

      if (progress < 1) {
        requestAnimationFrame(animatePercentage);
      } else {
        // Reset transform after animation
        simpleProgressPercentage.style.transform = "scale(1)";
      }
    }

    requestAnimationFrame(animatePercentage);
  }
}

// Start audio recording with automatic stop
async function startAudioRecording() {
  console.log("startAudioRecording called");
  // Ensure AudioContext is ready (important for iOS/Safari)
  initializeAudioContext();
  await resumeAudioContext();

  if (!audioContext) {
    alert("AudioContext could not be initialized. Cannot record.");
    return;
  }

  try {
    console.log("Requesting microphone access...");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("Microphone access granted.");
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    console.log("MediaRecorder created.");

    // Set recording flag, start time, toggle buttons
    isRecording = true;
    recordingStartTime = Date.now();
    toggleListenButtons(true);
    toggleBookmarkButtons(true);
    isRecordingCancelled = false; // Ensure flag is reset

    // Setup and start waveform visualization (this now shows the container)
    setupWaveformVisualization(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && !isRecordingCancelled) {
        // Don't collect if cancelled
        audioChunks.push(event.data);
      }
    };

    // Assign the NORMAL onstop handler HERE
    mediaRecorder.onstop = async () => {
      console.log("mediaRecorder.onstop triggered.");

      // ***** Check Cancellation Flag *****
      if (isRecordingCancelled) {
        console.log("onstop: Recording was cancelled, skipping processing.");
        // UI reset should have already happened in handleDeleteRecording
        isRecordingCancelled = false; // Reset flag just in case
        return;
      }

      // Stop the waveform visual (should be quick)
      stopWaveformVisualization();

      // --- Normal stop processing ---
      if (audioChunks.length === 0) {
        console.warn(
          "No audio chunks recorded. Recording might have been too short or silent."
        );
        resetUI();
        recognizedTextDiv.textContent = "(Recording too short or silent)";
        retryButton.style.display = "inline-block";
        retryButton.disabled = false;
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      recordedAudioBlob = new Blob(audioChunks, { type: "audio/mp4" });
      console.log(
        "Recorded audio blob created, size:",
        recordedAudioBlob?.size
      );
      audioChunks = []; // Clear chunks

      // UI Updates after stopping normally
      micButton.innerHTML = '<i class="fas fa-microphone mic-icon"></i>';
      micButton.style.backgroundColor = "";
      micButton.disabled = false;
      micButton.style.color = "#fff";
      micButton.style.display = "inline-block";
      micButton.style.opacity = "1";
      micButton.classList.remove("recording");
      micButton.style.animation =
        "pulse 2s infinite, glow 2s infinite alternate";

      retryButton.style.display = "inline-block";
      retryButton.disabled = false;
      document.getElementById("recordingIndicator").style.display = "none";

      // Set recording flag false AFTER UI updates
      isRecording = false;
      recordingStartTime = null;
      toggleListenButtons(false);
      toggleBookmarkButtons(false);
      console.log("UI updated after normal recording stop.");

      // Stop tracks
      console.log("Stopping media stream tracks normally...");
      stream.getTracks().forEach((track) => track.stop());
      console.log("Media stream tracks stopped normally.");

      // Upload for transcription
      if (recordedAudioBlob && recordedAudioBlob.size > 100) {
        console.log("Uploading audio for transcription...");
        recognizedTextDiv.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Transcribing...';
        pronunciationScoreDiv.textContent = "...";
        micButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        micButton.style.color = "#fff";
        micButton.style.backgroundColor = "#4b9b94";
        micButton.style.animation = "glow 2s infinite alternate";
        const transcription = await uploadAudioToAssemblyAI(recordedAudioBlob);
        if (transcription !== null) {
          console.log("Transcription received:", transcription);
          const pronunciationScore = calculatePronunciationScore(
            transcription,
            lessons[currentLessonIndex].sentences[currentSentenceIndex]
          );
          pronunciationScoreDiv.textContent = `${pronunciationScore}%`;
          updateProgressCircle(pronunciationScore);
          totalPronunciationScore += pronunciationScore; // Add score to total
          console.log("Score calculated and totals updated.");

          // Update progress bar immediately after score calculation
          updateSimpleProgress();

          // Restore mic icon after transcription is complete
          micButton.innerHTML = '<i class="fas fa-microphone mic-icon"></i>';
          micButton.style.color = "#fff";
          micButton.style.backgroundColor = "";
          micButton.style.display = "inline-block";
          micButton.style.opacity = "1";
          micButton.classList.remove("recording");
          micButton.style.animation =
            "pulse 2s infinite, glow 2s infinite alternate";

          openDialog();
          console.log("Dialog opened.");
        } else {
          console.log(
            "Transcription was null, likely an error during processing."
          );
          recognizedTextDiv.textContent = "(Transcription failed)";
          micButton.innerHTML = '<i class="fas fa-microphone mic-icon"></i>';
          micButton.style.color = "#fff";
          micButton.style.backgroundColor = "";
          micButton.style.display = "inline-block";
          micButton.style.opacity = "1";
          micButton.classList.remove("recording");
          micButton.style.animation =
            "pulse 2s infinite, glow 2s infinite alternate";
        }
      } else {
        console.warn(
          "Recorded audio blob is empty or very small, skipping transcription."
        );
        recognizedTextDiv.textContent = "(Recording too short or silent)";
        retryButton.style.display = "inline-block";
        retryButton.disabled = false;
      }
    };

    mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event.error);
      alert(`Recording error: ${event.error.name} - ${event.error.message}`);
      // Reset UI on error
      resetUI(); // resetUI already calls stopWaveformVisualization
      if (stream) {
        stream.getTracks().forEach((track) => track.stop()); // Stop stream on error
      }
    };

    // Start recording
    mediaRecorder.start(100);
    micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    micButton.style.color = "#ff0000";
    micButton.disabled = true;
    document.getElementById("recordingIndicator").style.display =
      "inline-block";
    console.log("UI updated for recording start.");

    // Set timeout to automatically stop recording after RECORDING_DURATION
    clearTimeout(recordingTimeout); // Clear any previous timeout
    recordingTimeout = setTimeout(() => {
      console.log("Recording duration timeout reached.");
      if (mediaRecorder && mediaRecorder.state === "recording") {
        console.log("Stopping recorder due to timeout...");
        mediaRecorder.stop();
      }
    }, RECORDING_DURATION);
    console.log(`Recording timeout set for ${RECORDING_DURATION}ms`);
  } catch (error) {
    console.error("Error in startAudioRecording:", error);
    alert(
      `Could not start recording: ${error.message}. Please check microphone permissions.`
    );

    // Ensure recording flag is reset and buttons are re-enabled in case of error
    isRecording = false;
    recordingStartTime = null;
    toggleListenButtons(false);
    toggleBookmarkButtons(false);
    // Make sure waveform is stopped and hidden on error
    stopWaveformVisualization();
  }
}

// Upload audio to AssemblyAI and get transcription
async function uploadAudioToAssemblyAI(audioBlob) {
  try {
    // Step 1: Upload the audio file to AssemblyAI
    const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        authorization: ASSEMBLYAI_API_KEY,
        "content-type": "application/octet-stream",
      },
      body: audioBlob,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload audio: ${uploadResponse.statusText}`);
    }

    const uploadData = await uploadResponse.json();
    const audioUrl = uploadData.upload_url;

    // Step 2: Submit the transcription request
    const transcriptionResponse = await fetch(
      "https://api.assemblyai.com/v2/transcript",
      {
        method: "POST",
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          audio_url: audioUrl,
        }),
      }
    );

    if (!transcriptionResponse.ok) {
      throw new Error(
        `Failed to submit transcription request: ${transcriptionResponse.statusText}`
      );
    }

    const transcriptionData = await transcriptionResponse.json();
    const transcriptId = transcriptionData.id;

    // Step 3: Poll for the transcription result
    let transcriptionResult;
    while (true) {
      const statusResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: {
            authorization: ASSEMBLYAI_API_KEY,
          },
        }
      );

      if (!statusResponse.ok) {
        throw new Error(
          `Failed to get transcription status: ${statusResponse.statusText}`
        );
      }

      const statusData = await statusResponse.json();
      if (statusData.status === "completed") {
        transcriptionResult = statusData.text;
        break;
      } else if (statusData.status === "error") {
        throw new Error("Transcription failed");
      }

      // Wait for 1 second before polling again
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return transcriptionResult;
  } catch (error) {
    console.error("Error in AssemblyAI transcription:", error);
    alert("Failed to transcribe audio. Please try again.");
    return null;
  }
}

// Apply listen button design to ear icon buttons (bookmarkIcon, bookmarkIcon2) on page load
window.addEventListener("DOMContentLoaded", function () {
  [bookmarkIcon, bookmarkIcon2].forEach((btn) => {
    btn.style.background = "linear-gradient(135deg, #4b9b94 0%, #2c7873 100%)";
    btn.style.borderRadius = "50%";
    btn.style.padding = "8px";
    btn.style.display = "flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.boxShadow = "0 4px 12px rgba(75, 155, 148, 0.3)";
    btn.style.border = "none";
  });
});

function showDialog({ score = 0, feedback = "", missingWords = "" }) {
  // Remove any existing dialog
  const oldDialog = document.querySelector(".dialog-container");
  if (oldDialog) oldDialog.remove();

  // Clone the template
  const template = document.getElementById("dialog-template");
  const dialogClone = template.content.cloneNode(true);

  // Update dynamic content
  const scoreText = dialogClone.getElementById("pronunciationScore");
  const progressCircle = dialogClone.getElementById("progress");
  const dialogSentenceText = dialogClone.getElementById("dialogSentenceText");
  const missingWordDiv = dialogClone.getElementById("missingWordDiv");
  const nextButton = dialogClone.getElementById("nextButton");

  // Set score
  scoreText.textContent = `${score}%`;
  // Animate progress
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  progressCircle.style.strokeDashoffset = offset;

  // Set feedback
  if (feedback) dialogSentenceText.innerHTML = feedback;
  if (missingWords) missingWordDiv.textContent = missingWords;

  // Set continue button color based on score
  if (score < 50) {
    nextButton.style.background =
      "linear-gradient(135deg, #ff4444 0%, #cc0000 100%)";
  } else {
    nextButton.style.background =
      "linear-gradient(135deg, #4b9b94 0%, #2c7873 100%)";
  }

  // Add event for close button
  dialogClone.querySelector(".close-icon").onclick = function () {
    document.querySelector(".dialog-container").remove();
  };

  // Add event for retry button
  dialogClone.getElementById("retryButton").onclick = function (e) {
    e.preventDefault();
    document.querySelector(".dialog-container").remove();
    // Start a new recording; after scoring, showDialog will be called with the new score
    startAudioRecording();
  };

  // Add event for next button
  dialogClone.getElementById("nextButton").onclick = function (e) {
    e.preventDefault();
    document.querySelector(".dialog-container").remove();
    // Add your continue logic here
  };

  // Append to body (or your preferred parent)
  document.body.appendChild(dialogClone);
}

// Function to translate text using MyMemory API (free, CORS-friendly)
async function translateText(text) {
  try {
    // Add timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        text
      )}&langpair=en|ar`,
      {
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Translation failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.responseData || !data.responseData.translatedText) {
      throw new Error("Invalid translation response");
    }

    return data.responseData.translatedText;
  } catch (error) {
    console.error("Translation error:", error);
    if (error.name === "AbortError") {
      console.error("Translation request timed out");
      return null;
    }
    return null;
  }
}

// Function to toggle translation
async function toggleTranslation() {
  const currentSentence = sentenceElement.textContent;

  if (!isTranslated) {
    try {
      // Show loading state
      translateButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Translating...';
      translateButton.disabled = true;

      // Get translation
      const translation = await translateText(currentSentence);

      if (translation) {
        currentTranslation = translation;
        translationText.textContent = translation;
        translationContainer.style.display = "block";
        translateButton.innerHTML =
          '<i class="fas fa-language"></i> <span>Show Original</span>';
        isTranslated = true;
      } else {
        throw new Error("Translation failed");
      }
    } catch (error) {
      console.error("Translation error:", error);
      alert("Failed to translate. Please try again.");
      translateButton.innerHTML =
        '<i class="fas fa-language"></i> <span>Translate to Arabic</span>';
    } finally {
      translateButton.disabled = false;
    }
  } else {
    // Toggle back to original
    translationContainer.style.display = "none";
    translateButton.innerHTML =
      '<i class="fas fa-language"></i> <span>Translate to Arabic</span>';
    isTranslated = false;
  }
}

// Add event listener for translation button
translateButton.addEventListener("click", toggleTranslation);
