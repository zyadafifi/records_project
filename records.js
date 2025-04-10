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

// UI Functions
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
  recordingIndicator.style.display = "none";
  isRecording = false;
  speechDetected = false;
  toggleListenButtons(false);
  toggleBookmarkButtons(false);
  clearTimeout(noSpeechTimeout);
}

// Text Processing
function normalizeText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, "");
}

function isExactMatch(word1, word2) {
  return word1 === word2;
}

function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

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
  if (lengthDiff > Math.min(word1.length, word2.length)) return 0.1;

  const distance = levenshteinDistance(word1, word2);
  const maxDistance = Math.max(word1.length, word2.length);
  let similarity = 1 - distance / maxDistance;

  if (lengthDiff > 0) similarity *= 1 - (lengthDiff / maxDistance) * 0.5;
  if (Math.min(word1.length, word2.length) <= 3 && distance > 0) similarity *= 0.7;
  if ((word1.startsWith(word2) || word2.startsWith(word1)) && lengthDiff > 2) similarity *= 0.8;

  return similarity;
}

// Audio Functions
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
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.frequency.value = frequency;
  oscillator.type = "sine";
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  gainNode.gain.setValueAtTime(1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration / 1000);
  oscillator.stop(audioContext.currentTime + duration / 1000);
}

// Speech Recognition
async function transcribeAudioWithGoogle(audioBlob) {
  try {
    const base64Audio = await blobToBase64(audioBlob);
    const base64Data = base64Audio.split(",")[1];

    const requestBody = {
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
        model: "default",
      },
      audio: {
        content: base64Data,
      },
    };

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
      console.error("API Error Details:", errorDetails);
      throw new Error(`Speech-to-Text API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("API Response:", data);

    if (data.results?.[0]?.alternatives?.[0]) {
      return data.results[0].alternatives[0].transcript;
    }
    throw new Error("No transcription results returned");
  } catch (error) {
    console.error("Error with Speech-to-Text API:", error);
    alert("Failed to transcribe audio. Please try again.");
    return null;
  }
}

// Recording Functions
async function startAudioRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
        channelCount: 1
      } 
    });
    
    audioChunks = [];
    const options = { mimeType: 'audio/webm;codecs=opus' };
    mediaRecorder = new MediaRecorder(stream, options);

    isRecording = true;
    speechDetected = false;
    toggleListenButtons(true);
    toggleBookmarkButtons(true);

    clearTimeout(noSpeechTimeout);
    noSpeechTimeout = setTimeout(() => {
      if (isRecording && !speechDetected) {
        console.log("No speech detected timeout triggered");
        if (mediaRecorder?.state === "recording") mediaRecorder.stop();
      }
    }, NO_SPEECH_TIMEOUT_MS);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        speechDetected = true;
      }
    };

    mediaRecorder.onstop = async () => {
      try {
        recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
        micButton.innerHTML = '<i class="fas fa-microphone"></i>';
        micButton.style.backgroundColor = "";
        micButton.disabled = false;
        retryButton.style.display = "inline-block";
        retryButton.disabled = false;
        recordingIndicator.style.display = "none";

        isRecording = false;
        toggleListenButtons(false);
        toggleBookmarkButtons(false);
        clearTimeout(noSpeechTimeout);
        stream.getTracks().forEach((track) => track.stop());

        const transcription = await transcribeAudioWithGoogle(recordedAudioBlob);
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
      } catch (error) {
        console.error("Error in recording stop handler:", error);
        alert("Error processing recording. Please try again.");
      }
    };

    mediaRecorder.start(100);
    micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    micButton.style.color = "#ff0000";
    micButton.disabled = true;
    recordingIndicator.style.display = "inline-block";
  } catch (error) {
    console.error("Error accessing microphone:", error);
    alert("Please allow microphone access to use this feature.");
    isRecording = false;
    toggleListenButtons(false);
    toggleBookmarkButtons(false);
    clearTimeout(noSpeechTimeout);
  }
}

// Helper Functions
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function toggleListenButtons(disabled) {
  listenButton.disabled = disabled;
  listen2Button.disabled = disabled;
  listenButton.style.opacity = disabled ? "0.5" : "1";
  listen2Button.style.opacity = disabled ? "0.5" : "1";
  listenButton.title = disabled ? "Cannot listen while recording" : "Listen to example";
  listen2Button.title = disabled ? "Cannot listen while recording" : "Listen to example";
}

function toggleBookmarkButtons(disabled) {
  bookmarkIcon.disabled = disabled;
  bookmarkIcon2.disabled = disabled;
  bookmarkIcon.style.opacity = disabled ? "0.5" : "1";
  bookmarkIcon2.style.opacity = disabled ? "0.5" : "1";
  bookmarkIcon.title = disabled ? "Cannot play audio while recording" : "Play recorded audio";
  bookmarkIcon2.title = disabled ? "Cannot play audio while recording" : "Play recorded audio";
}

// Event Listeners
document.querySelector(".close-icon").addEventListener("click", closeDialog);
dialogBackdrop.addEventListener("click", closeDialog);

listenButton.addEventListener("click", speakSentence);
listen2Button.addEventListener("click", speakSentence);
bookmarkIcon.addEventListener("click", playRecordedAudio);
bookmarkIcon2.addEventListener("click", playRecordedAudio);

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
  if (mediaRecorder?.state === "recording") mediaRecorder.stop();
});

nextButton.addEventListener("click", () => {
  const currentLesson = lessons[currentLessonIndex];
  if (currentSentenceIndex < currentLesson.sentences.length - 1) {
    currentSentenceIndex++;
    updateSentence();
    isRecording = false;
    toggleListenButtons(false);
    toggleBookmarkButtons(false);
    if (mediaRecorder?.state === "recording") mediaRecorder.stop();
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

// Initialization
async function loadLessons() {
  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/zyadafifi/lessons/main/lessons.json",
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) throw new Error(`Failed to fetch lessons: ${response.statusText}`);

    const data = await response.json();
    if (!data?.lessons) throw new Error("Invalid JSON structure: 'lessons' array not found");

    lessons = data.lessons;
    const quizId = new URLSearchParams(window.location.search).get("quizId");
    currentLessonIndex = lessons.findIndex(lesson => lesson.quizId === quizId);
    if (currentLessonIndex === -1) return console.error("Lesson not found for quizId:", quizId);
    updateSentence();
  } catch (error) {
    console.error("Error loading lessons:", error);
  }
}

loadLessons();