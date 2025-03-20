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
const NO_SPEECH_TIMEOUT_MS = 5000; // 5 seconds timeout to detect speech
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

// AudioContext for sound effects
let audioContext;

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
    await audioContext.resume();
    console.log("AudioContext resumed.");
  }
}

// Update the displayed sentence and reset UI
function updateSentence() {
  if (lessons.length === 0) return; // Ensure lessons are loaded
  const currentLesson = lessons[currentLessonIndex];
  sentenceElement.textContent = currentLesson.sentences[currentSentenceIndex];
  resetUI();
}

// Function to reset UI without changing the sentence
function resetUI() {
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
  isRecording = false;
  speechDetected = false;
  clearTimeout(noSpeechTimeout);
  document.getElementById("recordingIndicator").style.display = "none";
}

// Normalize text (remove punctuation and convert to lowercase)
function normalizeText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, "");
}

// Calculate Levenshtein distance between two strings
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
function calculateSimilarity(word1, word2) {
  word1 = word1.toLowerCase();
  word2 = word2.toLowerCase();
  if (word1 === word2) return 1;
  const lengthDiff = Math.abs(word1.length - word2.length);
  if (lengthDiff > Math.min(word1.length, word2.length)) return 0.1;
  const distance = levenshteinDistance(word1, word2);
  const maxDistance = Math.max(word1.length, word2.length);
  let similarity = 1 - distance / maxDistance;
  if (lengthDiff > 0) similarity *= 1 - (lengthDiff / maxDistance) * 0.5;
  if (Math.min(word1.length, word2.length) <= 3 && distance > 0)
    similarity *= 0.7;
  if ((word1.startsWith(word2) || word2.startsWith(word1)) && lengthDiff > 2)
    similarity *= 0.8;
  return similarity;
}

// Update the progress circle based on the pronunciation score
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

// Play sound effects using the Web Audio API
function playSoundEffect(frequency, duration) {
  if (!audioContext) {
    console.error("AudioContext not initialized.");
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
  let matchedTranscriptIndices = new Array(transcriptWords.length).fill(false);
  let matchedSentenceIndices = new Array(sentenceWords.length).fill(false);

  // First pass: find exact matches
  for (let i = 0; i < sentenceWords.length; i++) {
    for (let j = 0; j < transcriptWords.length; j++) {
      if (
        !matchedTranscriptIndices[j] &&
        !matchedSentenceIndices[i] &&
        transcriptWords[j] === sentenceWords[i]
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
          similarity,
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

  // Generate the highlighted text based on the matching results
  for (let i = 0; i < sentenceWords.length; i++) {
    const expectedWord = sentenceWords[i];
    if (matchedSentenceIndices[i]) {
      highlightedText += `<span style="color: green;">${expectedWord}</span> `;
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
        incorrectWords.push({ expected: expectedWord, got: mostSimilarWord });
        matchedTranscriptIndices[mostSimilarIndex] = true;
      } else {
        highlightedText += `<span style="color: grey;">${expectedWord}</span> `;
        missingWords.push(expectedWord);
      }
    }
  }

  // Check for extra words that were spoken but not matched
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
      } else {
        highlightedText += `<span style="color: red;">[Extra: ${transcriptWords[j]}]</span> `;
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

// Upload audio to AssemblyAI and get transcription
async function uploadAudioToAssemblyAI(audioBlob) {
  try {
    // Show loading indicator
    document.getElementById("loadingIndicator").style.display = "inline-block";

    // Step 1: Upload the audio file to AssemblyAI
    const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        authorization: ASSEMBLYAI_API_KEY,
        "content-type": "application/octet-stream",
      },
      body: audioBlob,
    });
    if (!uploadResponse.ok)
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
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
        body: JSON.stringify({ audio_url: audioUrl }),
      }
    );
    if (!transcriptionResponse.ok)
      throw new Error(
        `Transcription request failed: ${transcriptionResponse.statusText}`
      );
    const transcriptionData = await transcriptionResponse.json();
    const transcriptId = transcriptionData.id;

    // Step 3: Poll for the transcription result with reduced interval
    let transcriptionResult;
    while (true) {
      const statusResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: { authorization: ASSEMBLYAI_API_KEY },
        }
      );
      if (!statusResponse.ok)
        throw new Error(
          `Failed to get transcription status: ${statusResponse.statusText}`
        );
      const statusData = await statusResponse.json();
      if (statusData.status === "completed") {
        transcriptionResult = statusData.text;
        break;
      } else if (statusData.status === "error") {
        throw new Error(`Transcription failed: ${statusData.error}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500)); // Reduced polling interval
    }

    // Hide loading indicator
    document.getElementById("loadingIndicator").style.display = "none";
    return transcriptionResult;
  } catch (error) {
    console.error("Error in AssemblyAI transcription:", error);
    alert(`Failed to transcribe audio. Details: ${error.message}`);
    document.getElementById("loadingIndicator").style.display = "none";
    return null;
  }
}

// Start audio recording with error handling
async function startAudioRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    isRecording = true;
    speechDetected = false;
    toggleListenButtons(true);
    toggleBookmarkButtons(true);

    clearTimeout(noSpeechTimeout);
    noSpeechTimeout = setTimeout(() => {
      if (isRecording && !speechDetected) {
        console.log("No speech detected timeout triggered");
        if (mediaRecorder && mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
        alert("No speech detected. Please try again and speak clearly.");
      }
    }, NO_SPEECH_TIMEOUT_MS);

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
    mediaRecorder.onstop = async () => {
      recordedAudioBlob = new Blob(audioChunks, { type: "audio/wav" });
      micButton.innerHTML = '<i class="fas fa-microphone"></i>';
      micButton.style.backgroundColor = "";
      micButton.disabled = false;
      retryButton.style.display = "inline-block";
      retryButton.disabled = false;
      document.getElementById("recordingIndicator").style.display = "none";
      isRecording = false;
      toggleListenButtons(false);
      toggleBookmarkButtons(false);
      clearTimeout(noSpeechTimeout);
      stream.getTracks().forEach((track) => track.stop());

      const transcription = await uploadAudioToAssemblyAI(recordedAudioBlob);
      if (transcription) {
        const currentLesson = lessons[currentLessonIndex];
        const pronunciationScore = calculatePronunciationScore(
          transcription,
          currentLesson.sentences[currentSentenceIndex]
        );
        pronunciationScoreDiv.textContent = `${pronunciationScore}%`;
        updateProgressCircle(pronunciationScore);
        totalSentencesSpoken++;
        totalPronunciationScore += pronunciationScore;
        openDialog();
      }
    };
    mediaRecorder.start();
    micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    micButton.style.color = "#ff0000";
    micButton.disabled = true;
    document.getElementById("recordingIndicator").style.display =
      "inline-block";
  } catch (error) {
    console.error("Error accessing microphone:", error);
    alert("Please allow microphone access to use this feature.");
    isRecording = false;
    toggleListenButtons(false);
    toggleBookmarkButtons(false);
    clearTimeout(noSpeechTimeout);
  }
}

// Load lessons from the JSON file
async function loadLessons() {
  try {
    const url =
      "https://raw.githubusercontent.com/zyadafifi/lessons/main/lessons.json";
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error(`Failed to fetch lessons: ${response.statusText}`);
    const data = await response.json();
    lessons = data.lessons;
    const quizId = getQuizIdFromURL();
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

// Get the quiz ID from the URL
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
  closeDialog();
  resetUI();
  clearTimeout(noSpeechTimeout);
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
});
