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
const ASSEMBLYAI_API_KEY = "bdb00961a07c4184889a80206c52b6f2";

// Create a backdrop for the dialog
const dialogBackdrop = document.createElement("div");
dialogBackdrop.classList.add("dialog-backdrop");
document.body.appendChild(dialogBackdrop);

// Hide the dialog backdrop initially
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
retryButton.style.display = "none";

// AudioContext for sound effects and waveform
let audioContext;

// Waveform specific variables
let analyser;
let dataArray;
let canvasCtx;
let animationId;
let waveformCanvas;
let recordingStartTime;
let waveformContainer;
let stopRecButton;
let deleteRecButton;
let isRecordingCancelled = false;

// Icon wrapper functionality
let iconWrappers = document.querySelectorAll(".icon-wrapper");
let originalIcons = {};

// Store original icons
iconWrappers.forEach((wrapper) => {
  const icon = wrapper.querySelector("i");
  if (icon) {
    originalIcons[wrapper.id] = icon.className;
  }
});

// Function to handle icon wrapper clicks
function handleIconWrapperClick(event) {
  const wrapper = event.currentTarget;
  const icon = wrapper.querySelector("i");

  // Check if currently showing pause icon
  if (icon.classList.contains("fa-pause")) {
    // Restore original icon
    if (originalIcons[wrapper.id]) {
      icon.className = originalIcons[wrapper.id];
    }

    // Special case for listen buttons - stop speech
    if (wrapper.id === "listenButton" || wrapper.id === "listen2Button") {
      speechSynthesis.cancel();
    }
  } else {
    // Change to pause icon
    icon.className = "fas fa-pause";

    // Add active class for visual feedback
    wrapper.classList.add("active");
    setTimeout(() => wrapper.classList.remove("active"), 200);

    // Special case for listen buttons - start speech
    if (wrapper.id === "listenButton" || wrapper.id === "listen2Button") {
      speakSentence();
    }
  }
}

// Add click event listeners to all icon wrappers
iconWrappers.forEach((wrapper) => {
  wrapper.addEventListener("click", handleIconWrapperClick);
});

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

  if (!waveformContainer) {
    waveformContainer = document.createElement("div");
    waveformContainer.id = "waveformContainer";
    waveformContainer.style.display = "flex";
    waveformContainer.style.alignItems = "center";
    waveformContainer.style.justifyContent = "space-between";
    waveformContainer.style.width = "100%";
    waveformContainer.style.marginTop = "10px";
    waveformContainer.style.padding = "5px";
    waveformContainer.style.backgroundColor = "#f0f0f0";
    waveformContainer.style.borderRadius = "4px";
    waveformContainer.style.display = "none";

    deleteRecButton = document.createElement("button");
    deleteRecButton.id = "deleteRecButton";
    deleteRecButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteRecButton.title = "Cancel Recording";
    deleteRecButton.style.background = "none";
    deleteRecButton.style.border = "none";
    deleteRecButton.style.color = "#dc3545";
    deleteRecButton.style.fontSize = "1.2em";
    deleteRecButton.style.cursor = "pointer";
    deleteRecButton.style.padding = "0 10px";
    deleteRecButton.onclick = handleDeleteRecording;
    waveformContainer.appendChild(deleteRecButton);

    waveformCanvas = document.createElement("canvas");
    waveformCanvas.id = "waveformCanvas";
    waveformCanvas.width = 200;
    waveformCanvas.height = 50;
    waveformCanvas.style.borderRadius = "4px";
    waveformCanvas.style.backgroundColor = "#f0f0f0";
    waveformCanvas.style.flexGrow = "1";
    waveformContainer.appendChild(waveformCanvas);

    stopRecButton = document.createElement("button");
    stopRecButton.id = "stopRecButton";
    stopRecButton.innerHTML =
      '<i class="fas fa-paper-plane" style="font-size: 20px;"></i>';
    stopRecButton.title = "Send Recording";
    stopRecButton.style.color = "#0aa989";
    stopRecButton.style.background = "none";
    stopRecButton.style.border = "none";
    stopRecButton.style.fontSize = "1.2em";
    stopRecButton.style.cursor = "pointer";
    stopRecButton.style.padding = "0 10px";
    stopRecButton.style.transition = "transform 0.2s ease";
    stopRecButton.onmouseover = function () {
      this.style.transform = "scale(1.1)";
    };
    stopRecButton.onmouseout = function () {
      this.style.transform = "scale(1)";
    };
    stopRecButton.onclick = handleStopRecording;
    waveformContainer.appendChild(stopRecButton);

    const micButtonContainer = micButton.parentElement;
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
      document.body.appendChild(waveformContainer);
    }
  }

  canvasCtx = waveformCanvas.getContext("2d");

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 128;
  analyser.smoothingTimeConstant = 0.8;

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  isRecordingCancelled = false;

  waveformContainer.style.display = "flex";
  stopRecButton.disabled = false;
  deleteRecButton.disabled = false;
  drawWhatsAppWaveform();
  console.log("Waveform drawing started.");
}

// Function to draw WhatsApp-style waveform
function drawWhatsAppWaveform() {
  if (!isRecording || !analyser || !canvasCtx || !dataArray) return;

  animationId = requestAnimationFrame(drawWhatsAppWaveform);

  analyser.getByteFrequencyData(dataArray);

  canvasCtx.fillStyle = "#f0f0f0";
  canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

  const barCount = 20;
  const barWidth = 4;
  const barSpacing = 2;
  const totalBarAreaWidth = barCount * (barWidth + barSpacing) - barSpacing;
  const startX = (waveformCanvas.width - totalBarAreaWidth) / 2;
  const maxBarHeight = waveformCanvas.height * 0.8;

  canvasCtx.fillStyle = "#0aa989";

  for (let i = 0; i < barCount; i++) {
    const dataIndex = Math.floor((i * dataArray.length) / barCount);
    const value = dataArray[dataIndex];
    const barHeight = Math.max(2, (value / 255) * maxBarHeight);
    const x = startX + i * (barWidth + barSpacing);
    const y = (waveformCanvas.height - barHeight) / 2;
    canvasCtx.fillRect(x, y, barWidth, barHeight);
  }

  if (recordingStartTime) {
    const recordingTime = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(recordingTime / 60);
    const seconds = recordingTime % 60;
    const timeText = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

    canvasCtx.fillStyle = "#333";
    canvasCtx.font = "bold 12px Arial";
    canvasCtx.textAlign = "right";
    canvasCtx.textBaseline = "top";
    canvasCtx.fillText(timeText, waveformCanvas.width - 5, 5);
  }
}

function handleStopRecording() {
  console.log("Stop button clicked.");
  if (mediaRecorder && mediaRecorder.state === "recording") {
    console.log("Calling mediaRecorder.stop() via button.");
    stopRecButton.disabled = true;
    deleteRecButton.disabled = true;
    mediaRecorder.stop();
  }
}

function handleDeleteRecording() {
  console.log("Delete button clicked.");
  isRecordingCancelled = true;

  if (mediaRecorder && mediaRecorder.state === "recording") {
    console.log("Stopping MediaRecorder immediately for cancellation.");
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
  }

  stopWaveformVisualization();
  if (mediaRecorder && mediaRecorder.stream) {
    console.log("Stopping media stream tracks for cancellation.");
    mediaRecorder.stream.getTracks().forEach((track) => track.stop());
  }

  console.log("Calling resetUI for cancellation.");
  resetUI();

  recognizedTextDiv.textContent = "(Recording cancelled)";
}

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

  if (waveformContainer) {
    waveformContainer.style.display = "none";
  }
  if (waveformCanvas && canvasCtx) {
    canvasCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
  }
  dataArray = null;
}

function resetUI() {
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

  stopWaveformVisualization();

  isRecording = false;
  isRecordingCancelled = false;
  mediaRecorder = null;
  recordingStartTime = null;
  speechDetected = false;
  toggleListenButtons(false);
  toggleBookmarkButtons(false);

  clearTimeout(noSpeechTimeout);
  clearTimeout(recordingTimeout);
  console.log("UI Reset completed.");
}

function updateSentence() {
  if (lessons.length === 0) return;
  const currentLesson = lessons[currentLessonIndex];

  sentenceElement.textContent = currentLesson.sentences[currentSentenceIndex];

  recognizedTextDiv.textContent = "";
  pronunciationScoreDiv.textContent = "0%";
  micButton.style.display = "inline-block";
  retryButton.style.display = "none";
  retryButton.disabled = true;
  missingWordDiv.textContent = "";
  closeDialog();
  updateProgressCircle(0);
  nextButton.style.backgroundColor = "";

  listenButton.disabled = false;
  listen2Button.disabled = false;

  toggleBookmarkButtons(false);
}

function normalizeText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, "");
}

function isExactMatch(word1, word2) {
  return word1 === word2;
}

function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  const dp = Array(m + 1)
    .fill()
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function calculateSimilarity(word1, word2) {
  word1 = word1.toLowerCase();
  word2 = word2.toLowerCase();

  if (word1 === word2) return 1;

  const lengthDiff = Math.abs(word1.length - word2.length);
  if (lengthDiff > Math.min(word1.length, word2.length)) {
    return 0.1;
  }

  const distance = levenshteinDistance(word1, word2);
  const maxDistance = Math.max(word1.length, word2.length);
  let similarity = 1 - distance / maxDistance;

  if (lengthDiff > 0) {
    similarity *= 1 - (lengthDiff / maxDistance) * 0.5;
  }

  if (Math.min(word1.length, word2.length) <= 3 && distance > 0) {
    similarity *= 0.7;
  }

  if ((word1.startsWith(word2) || word2.startsWith(word1)) && lengthDiff > 2) {
    similarity *= 0.8;
  }

  return similarity;
}

function updateProgressCircle(score) {
  const circumference = 251.2;
  const offset = circumference - (circumference * score) / 100;
  progressCircle.style.strokeDashoffset = offset;

  if (score >= 80) {
    progressCircle.style.stroke = "#0aa989";
    playSoundEffect(800, 200);
  } else if (score >= 50) {
    progressCircle.style.stroke = "#ffa500";
    playSoundEffect(500, 200);
  } else {
    progressCircle.style.stroke = "#ff0000";
    playSoundEffect(300, 200);
  }
}

function playSoundEffect(frequency, duration) {
  if (!audioContext) {
    console.error(
      "AudioContext not initialized. Call initializeAudioContext() first."
    );
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.frequency.value = frequency;
  oscillator.type = "sine";

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

  console.log("Recognized Words:", transcriptWords);
  console.log("Expected Words:", sentenceWords);

  let matchedTranscriptIndices = new Array(transcriptWords.length).fill(false);
  let matchedSentenceIndices = new Array(sentenceWords.length).fill(false);

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
        });
      }
    }
  }

  potentialMatches.sort((a, b) => b.similarity - a.similarity);

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

  for (let i = 0; i < sentenceWords.length; i++) {
    const expectedWord = sentenceWords[i];

    if (matchedSentenceIndices[i]) {
      highlightedText += `<span style="color: green;">${expectedWord}</span> `;
      console.log(`Correct: "${expectedWord}"`);
    } else {
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
        highlightedText += `<span style="color: grey;">${expectedWord}</span> `;
        missingWords.push(expectedWord);
        console.log(`Missing: "${expectedWord}"`);
      }
    }
  }

  for (let j = 0; j < transcriptWords.length; j++) {
    if (!matchedTranscriptIndices[j]) {
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

  recognizedTextDiv.innerHTML = highlightedText.trim();

  if (missingWords.length > 0) {
    missingWordDiv.textContent = `Missing: ${missingWords.join(", ")}`;
  } else {
    missingWordDiv.textContent = "";
  }

  const pronunciationScore = (correctWords / sentenceWords.length) * 100;

  if (pronunciationScore < 50) {
    nextButton.style.backgroundColor = "#ff0000";
  } else {
    nextButton.style.backgroundColor = "#0aa989";
  }

  return Math.round(pronunciationScore);
}

// Modified speakSentence function
function speakSentence() {
  if (isRecording) {
    console.log("Cannot listen while recording");
    alert(
      "Cannot listen to example while recording. Please finish recording first."
    );
    return;
  }

  if (lessons.length === 0) return;
  const currentLesson = lessons[currentLessonIndex];
  const sentence = currentLesson.sentences[currentSentenceIndex];
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = "en-US";

  utterance.onend = function () {
    // Restore original icon when speech ends
    iconWrappers.forEach((wrapper) => {
      if (wrapper.id === "listenButton" || wrapper.id === "listen2Button") {
        const icon = wrapper.querySelector("i");
        if (icon && originalIcons[wrapper.id]) {
          icon.className = originalIcons[wrapper.id];
        }
      }
    });
  };

  speechSynthesis.speak(utterance);
}

function toggleListenButtons(disabled) {
  listenButton.disabled = disabled;
  listen2Button.disabled = disabled;

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

function toggleBookmarkButtons(disabled) {
  bookmarkIcon.disabled = disabled;
  bookmarkIcon2.disabled = disabled;

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

const RECORDING_DURATION = 5000;
let recordingTimeout;

async function startAudioRecording() {
  console.log("startAudioRecording called");
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

    isRecording = true;
    recordingStartTime = Date.now();
    toggleListenButtons(true);
    toggleBookmarkButtons(true);
    isRecordingCancelled = false;

    setupWaveformVisualization(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && !isRecordingCancelled) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log("mediaRecorder.onstop triggered.");

      if (isRecordingCancelled) {
        console.log("onstop: Recording was cancelled, skipping processing.");
        isRecordingCancelled = false;
        return;
      }

      stopWaveformVisualization();

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

      recordedAudioBlob = new Blob(audioChunks, { type: "audio/wav" });
      console.log(
        "Recorded audio blob created, size:",
        recordedAudioBlob?.size
      );
      audioChunks = [];

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

      isRecording = false;
      recordingStartTime = null;
      toggleListenButtons(false);
      toggleBookmarkButtons(false);
      console.log("UI updated after normal recording stop.");

      console.log("Stopping media stream tracks normally...");
      stream.getTracks().forEach((track) => track.stop());
      console.log("Media stream tracks stopped normally.");

      if (recordedAudioBlob && recordedAudioBlob.size > 100) {
        console.log("Uploading audio for transcription...");
        recognizedTextDiv.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Transcribing...';
        pronunciationScoreDiv.textContent = "...";
        micButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        micButton.style.color = "#fff";
        micButton.style.backgroundColor = "#0aa989";
        micButton.style.animation = "glow 2s infinite alternate";
        const transcription = await uploadAudioToAssemblyAI(recordedAudioBlob);
        if (transcription !== null) {
          console.log("Transcription received:", transcription);
          const currentLesson = lessons[currentLessonIndex];
          const pronunciationScore = calculatePronunciationScore(
            transcription,
            currentLesson.sentences[currentSentenceIndex]
          );
          pronunciationScoreDiv.textContent = `${pronunciationScore}%`;
          updateProgressCircle(pronunciationScore);
          totalSentencesSpoken++;
          totalPronunciationScore += pronunciationScore;
          console.log("Score calculated and totals updated.");

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
      resetUI();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };

    mediaRecorder.start(100);
    micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    micButton.style.color = "#ff0000";
    micButton.disabled = true;
    document.getElementById("recordingIndicator").style.display =
      "inline-block";
    console.log("UI updated for recording start.");

    clearTimeout(recordingTimeout);
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

    isRecording = false;
    recordingStartTime = null;
    toggleListenButtons(false);
    toggleBookmarkButtons(false);
    stopWaveformVisualization();
  }
}

async function uploadAudioToAssemblyAI(audioBlob) {
  try {
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

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return transcriptionResult;
  } catch (error) {
    console.error("Error in AssemblyAI transcription:", error);
    alert("Failed to transcribe audio. Please try again.");
    return null;
  }
}

function playRecordedAudio() {
  if (!recordedAudioBlob) {
    alert("No recorded audio available.");
    return;
  }

  if (isRecording) {
    console.log("Cannot play audio while recording");
    alert("Cannot play audio while recording. Please finish recording first.");
    return;
  }

  const audioURL = URL.createObjectURL(recordedAudioBlob);
  const audio = new Audio(audioURL);
  audio.play();
}

// Updated event listeners for icon wrappers
iconWrappers.forEach((wrapper) => {
  wrapper.addEventListener("click", function () {
    // Add active class for visual feedback
    this.classList.add("active");
    setTimeout(() => this.classList.remove("active"), 200);

    // Handle specific button functionality
    if (this.id === "listenButton" || this.id === "listen2Button") {
      speakSentence();
    } else if (this.id === "bookmarkIcon" || this.id === "bookmarkIcon2") {
      playRecordedAudio();
    }
  });
});

// Load lessons from the JSON file
async function loadLessons() {
  try {
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

    if (!data || !data.lessons) {
      throw new Error("Invalid JSON structure: 'lessons' array not found");
    }

    lessons = data.lessons;
    console.log("Lessons loaded successfully:", lessons);

    const quizId = getQuizIdFromURL();
    console.log("Quiz ID from URL:", quizId);

    currentLessonIndex = lessons.findIndex(
      (lesson) => lesson.quizId === quizId
    );

    if (currentLessonIndex === -1) {
      console.error("Lesson not found for quizId:", quizId);
      return;
    }

    updateSentence();
  } catch (error) {
    console.error("Error loading lessons:", error);
  }
}

function getQuizIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("quizId");
}

// Load lessons when the page loads
loadLessons();

// Event listeners for buttons
micButton.addEventListener("click", async () => {
  initializeAudioContext();
  await resumeAudioContext();

  micButton.style.display = "none";
  retryButton.style.display = "inline-block";
  retryButton.disabled = false;
  startAudioRecording();
});

retryButton.addEventListener("click", () => {
  if (recordingTimeout) {
    clearTimeout(recordingTimeout);
  }

  closeDialog();
  resetUI();

  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
});

nextButton.addEventListener("click", () => {
  const currentLesson = lessons[currentLessonIndex];
  if (currentSentenceIndex < currentLesson.sentences.length - 1) {
    currentSentenceIndex++;
    updateSentence();

    isRecording = false;
    toggleListenButtons(false);
    toggleBookmarkButtons(false);

    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
  } else {
    const congratulationModal = new bootstrap.Modal(
      document.getElementById("congratulationModal")
    );

    sentencesSpokenDiv.textContent = totalSentencesSpoken;
    overallScoreDiv.textContent = `${Math.round(
      totalPronunciationScore / totalSentencesSpoken
    )}%`;

    congratulationModal.show();
  }
});

continueButton.addEventListener("click", () => {
  const congratulationModal = bootstrap.Modal.getInstance(
    document.getElementById("congratulationModal")
  );
  congratulationModal.hide();

  const iconsContainer = document.querySelector(".icons-container");
  if (iconsContainer) {
    micButton.innerHTML = '<i class="fas fa-microphone mic-icon"></i>';
    micButton.style.color = "#fff";
    micButton.style.backgroundColor = "";
    micButton.style.display = "inline-block";
    micButton.disabled = false;
    micButton.style.opacity = "1";

    listenButton.disabled = false;
    listenButton.style.opacity = "1";

    document.getElementById("recordingIndicator").style.display = "none";

    micButton.classList.remove("recording");
    micButton.style.animation = "pulse 2s infinite, glow 2s infinite alternate";
  }
});

// Add CSS for click feedback
const style = document.createElement("style");
style.textContent = `
  .icon-wrapper.active {
    transform: scale(0.9);
    transition: transform 0.1s;
  }
  .icon-wrapper {
    transition: transform 0.2s, opacity 0.2s;
    cursor: pointer;
  }
`;
document.head.appendChild(style);
