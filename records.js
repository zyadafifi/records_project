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

// Event listeners for closing the dialog
document.querySelector(".close-icon").addEventListener("click", closeDialog);
dialogBackdrop.addEventListener("click", closeDialog);

// Global variables
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
  // Create canvas element if it doesn't exist
  if (!waveformCanvas) {
    waveformCanvas = document.createElement("canvas");
    waveformCanvas.id = "waveformCanvas";
    waveformCanvas.width = 300;
    waveformCanvas.height = 60;
    waveformCanvas.style.width = "100%";
    waveformCanvas.style.height = "60px";
    waveformCanvas.style.marginTop = "10px";
    waveformCanvas.style.borderRadius = "4px";
    waveformCanvas.style.backgroundColor = "#f0f0f0";
    waveformCanvas.style.display = "none"; // Initially hidden

    // Insert canvas after the recording indicator or another suitable element
    const micButtonContainer = micButton.parentElement;
    if (micButtonContainer) {
      // Insert after the container holding the mic button
      micButtonContainer.parentNode.insertBefore(
        waveformCanvas,
        micButtonContainer.nextSibling
      );
      console.log("Waveform canvas added to DOM.");
    } else {
      console.error(
        "Could not find suitable parent to insert waveform canvas."
      );
      // Fallback: append to body, might not look ideal
      document.body.appendChild(waveformCanvas);
    }
  }

  // Get canvas context
  canvasCtx = waveformCanvas.getContext("2d");

  // Create analyzer
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 128; // Reduced for performance, suitable for bar visualization
  analyser.smoothingTimeConstant = 0.8; // Smoother transitions for bars

  // Connect stream to analyzer
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  // Create data array for analyzer
  const bufferLength = analyser.frequencyBinCount; // == fftSize / 2
  dataArray = new Uint8Array(bufferLength);

  // Start drawing
  waveformCanvas.style.display = "block"; // Make canvas visible
  drawWhatsAppWaveform();
  console.log("Waveform drawing started.");
}

// Function to draw WhatsApp-style waveform
function drawWhatsAppWaveform() {
  if (!isRecording || !analyser || !canvasCtx || !dataArray) return; // Exit if not recording or not setup

  // Schedule next frame
  animationId = requestAnimationFrame(drawWhatsAppWaveform);

  // Get frequency data from analyzer
  analyser.getByteFrequencyData(dataArray);

  // Clear canvas
  canvasCtx.fillStyle = "#f0f0f0"; // Background color
  canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

  // --- Draw Bars ---
  const barCount = 30; // Number of bars
  const barWidth = 4; // Width of each bar
  const barSpacing = 2; // Space between bars
  const totalBarAreaWidth = barCount * (barWidth + barSpacing) - barSpacing; // Total width occupied by bars+spaces
  const startX = (waveformCanvas.width - totalBarAreaWidth) / 2; // Center the bars
  const maxBarHeight = waveformCanvas.height * 0.8; // Max height relative to canvas height

  canvasCtx.fillStyle = "#0aa989"; // Bar color

  for (let i = 0; i < barCount; i++) {
    // Map the data index logarithmically or linearly to spread across bars
    // Using linear mapping here for simplicity
    const dataIndex = Math.floor((i * dataArray.length) / barCount);
    const value = dataArray[dataIndex]; // Value from 0 to 255

    // Scale bar height (ensure minimum height for visual presence)
    const barHeight = Math.max(2, (value / 255) * maxBarHeight);

    // Calculate position
    const x = startX + i * (barWidth + barSpacing);
    const y = (waveformCanvas.height - barHeight) / 2; // Center vertically

    // Draw bar with rounded top/bottom (approximated with fillRect + arcs or just rounded rect if supported)
    // Using fillRect for broader compatibility
    canvasCtx.fillRect(x, y, barWidth, barHeight);

    // Optional: Add rounded caps using arcs (might impact performance slightly)
    // canvasCtx.beginPath();
    // canvasCtx.arc(x + barWidth / 2, y, barWidth / 2, Math.PI, 0);
    // canvasCtx.arc(x + barWidth / 2, y + barHeight, barWidth / 2, 0, Math.PI);
    // canvasCtx.fill();
  }

  // --- Draw Timer ---
  if (recordingStartTime) {
    const recordingTime = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(recordingTime / 60);
    const seconds = recordingTime % 60;
    const timeText = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

    canvasCtx.fillStyle = "#333"; // Timer text color
    canvasCtx.font = "12px Arial";
    canvasCtx.textAlign = "right";
    canvasCtx.fillText(timeText, waveformCanvas.width - 10, 15); // Position top-right
  }
}

// Function to stop waveform visualization and clean up
function stopWaveformVisualization() {
  console.log("Stopping waveform visualization.");
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  // Disconnect the analyser to free up resources
  // Note: The source node (MediaStreamSource) disconnects automatically when tracks are stopped.
  if (analyser) {
    analyser.disconnect();
    analyser = null;
  }

  // Clear and hide the canvas
  if (waveformCanvas && canvasCtx) {
    canvasCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    waveformCanvas.style.display = "none";
  }
  dataArray = null; // Release data array reference
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

  // Stop and hide waveform visualization if it exists
  if (isRecording) {
    stopWaveformVisualization();
  }
  if (waveformCanvas) {
    waveformCanvas.style.display = "none";
  }

  // Reset recording state and re-enable buttons
  isRecording = false;
  speechDetected = false; // Reset speech detection flag
  toggleListenButtons(false);
  toggleBookmarkButtons(false);

  // Clear the timeout
  clearTimeout(noSpeechTimeout);
  clearTimeout(recordingTimeout); // Also clear recording timeout
  console.log("UI Reset.");
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
    return; // Exit the function without speaking
  }

  if (lessons.length === 0) return; // Ensure lessons are loaded
  const currentLesson = lessons[currentLessonIndex];
  const sentence = currentLesson.sentences[currentSentenceIndex];
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = "en-US";
  speechSynthesis.speak(utterance);
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

// Constants for recording
const RECORDING_DURATION = 5000; // 5 seconds recording time
let recordingTimeout;

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

    // Set recording flag to true and disable listen/bookmark buttons
    isRecording = true;
    recordingStartTime = Date.now(); // Record start time for timer
    toggleListenButtons(true);
    toggleBookmarkButtons(true);

    // Setup and start waveform visualization
    console.log("Setting up waveform visualization...");
    setupWaveformVisualization(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        // console.log("Audio chunk received, size:", event.data.size);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log("mediaRecorder.onstop triggered.");
      // Stop the waveform first
      stopWaveformVisualization();

      // --- Important: Check if audioChunks has data BEFORE creating Blob ---
      if (audioChunks.length === 0) {
        console.warn(
          "No audio chunks recorded. Recording might have been too short or silent."
        );
        // Reset UI and provide feedback without attempting transcription
        resetUI(); // Call resetUI to handle button states etc.
        recognizedTextDiv.textContent = "(Recording too short or silent)";
        retryButton.style.display = "inline-block";
        retryButton.disabled = false;
        // Stop tracks if they haven't been stopped already
        stream.getTracks().forEach((track) => track.stop());
        return; // Exit onstop handler
      }

      recordedAudioBlob = new Blob(audioChunks, { type: "audio/wav" }); // Use audio/wav or audio/webm;codecs=opus depending on needs
      console.log(
        "Recorded audio blob created, size:",
        recordedAudioBlob?.size
      );
      audioChunks = []; // Clear chunks after creating blob

      // --- UI Updates after stopping ---
      micButton.innerHTML = '<i class="fas fa-microphone"></i>';
      micButton.style.backgroundColor = "";
      micButton.disabled = false;
      retryButton.style.display = "inline-block";
      retryButton.disabled = false;
      document.getElementById("recordingIndicator").style.display = "none";

      // Set recording flag to false AFTER UI updates related to stopping
      isRecording = false;
      recordingStartTime = null; // Reset timer start time
      toggleListenButtons(false);
      toggleBookmarkButtons(false);
      console.log("UI updated after recording stop.");

      // Stop all tracks in the MediaStream to release the microphone
      console.log("Stopping media stream tracks...");
      stream.getTracks().forEach((track) => track.stop());
      console.log("Media stream tracks stopped.");

      // Upload the recorded audio to AssemblyAI for transcription
      if (recordedAudioBlob && recordedAudioBlob.size > 100) {
        // Check if blob has some data
        console.log("Uploading audio for transcription...");
        // Add loading indicator before transcription
        recognizedTextDiv.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Transcribing...';
        pronunciationScoreDiv.textContent = "...";

        const transcription = await uploadAudioToAssemblyAI(recordedAudioBlob);

        if (transcription !== null) {
          // Check transcription wasn't null (error occurred)
          console.log("Transcription received:", transcription);
          const currentLesson = lessons[currentLessonIndex];
          const pronunciationScore = calculatePronunciationScore(
            transcription,
            currentLesson.sentences[currentSentenceIndex]
          );
          pronunciationScoreDiv.textContent = `${pronunciationScore}%`;
          updateProgressCircle(pronunciationScore);

          // Update total sentences spoken and overall score
          totalSentencesSpoken++;
          totalPronunciationScore += pronunciationScore;
          console.log("Score calculated and totals updated.");

          // Show the dialog container
          openDialog();
          console.log("Dialog opened.");
        } else {
          console.log(
            "Transcription was null, likely an error during processing."
          );
          recognizedTextDiv.textContent = "(Transcription failed)";
        }
      } else {
        console.warn(
          "Recorded audio blob is empty or very small, skipping transcription."
        );
        // Provide feedback to the user that recording was likely too short or silent
        recognizedTextDiv.textContent = "(Recording too short or silent)";
        // Ensure retry is available even if blob was small
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
    mediaRecorder.start(100); // Trigger ondataavailable roughly every 100ms
    console.log("MediaRecorder started.");
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
