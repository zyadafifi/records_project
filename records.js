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

// Create a backdrop for the dialog
const dialogBackdrop = document.createElement("div");
dialogBackdrop.classList.add("dialog-backdrop");
document.body.appendChild(dialogBackdrop);

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
let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; // Speech recognition API
let mediaRecorder;
let audioChunks = [];
let recordedAudioBlob; // Stores the recorded audio blob
retryButton.style.display = "none"; // Hide retry button initially

// AudioContext for sound effects
let audioContext;

// Initialize AudioContext
function initializeAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
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
}

// Normalize text (remove punctuation and convert to lowercase)
function normalizeText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, "");
}

// Check if two words are similar (basic fuzzy matching)
function isSimilar(word1, word2) {
  return word1.includes(word2) || word2.includes(word1);
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
    console.error("AudioContext not initialized. Call initializeAudioContext() first.");
    return;
  }

  // Resume the AudioContext if it's suspended
  if (audioContext.state === "suspended") {
    audioContext.resume().then(() => {
      console.log("AudioContext resumed successfully.");
    });
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.frequency.value = frequency; // Frequency in Hz
  oscillator.type = "sine"; // Type of waveform

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  gainNode.gain.setValueAtTime(1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration / 1000);
  oscillator.stop(audioContext.currentTime + duration / 1000);
}

// Calculate pronunciation score
function calculatePronunciationScore(transcript, expectedSentence) {
  const transcriptWords = normalizeText(transcript).split(/\s+/);
  const sentenceWords = normalizeText(expectedSentence).split(/\s+/);

  let correctWords = 0;
  let highlightedText = "";
  let missingWord = "";

  // Compare words one by one
  let transcriptIndex = 0;
  let sentenceIndex = 0;

  while (transcriptIndex < transcriptWords.length && sentenceIndex < sentenceWords.length) {
    if (isSimilar(transcriptWords[transcriptIndex], sentenceWords[sentenceIndex])) {
      highlightedText += `<span style="color: green;">${transcriptWords[transcriptIndex]}</span> `;
      correctWords++;
      transcriptIndex++;
      sentenceIndex++;
    } else {
      if (isSimilar(transcriptWords[transcriptIndex], sentenceWords[sentenceIndex + 1])) {
        highlightedText += `<span style="text-decoration: underline; color: gray;">${sentenceWords[sentenceIndex]}</span> `;
        sentenceIndex++;
      } else {
        highlightedText += `<span style="color: red;">${transcriptWords[transcriptIndex]}</span> `;
        transcriptIndex++;
      }
    }
  }

  // Handle missed words
  while (sentenceIndex < sentenceWords.length) {
    highlightedText += `<span style="text-decoration: underline; color: gray;">${sentenceWords[sentenceIndex]}</span> `;
    if (sentenceIndex === Math.floor(sentenceWords.length / 2)) {
      missingWord = sentenceWords[sentenceIndex];
    }
    sentenceIndex++;
  }

  // Handle extra words
  while (transcriptIndex < transcriptWords.length) {
    highlightedText += `<span style="color: red;">${transcriptWords[transcriptIndex]}</span> `;
    transcriptIndex++;
  }

  recognizedTextDiv.innerHTML = highlightedText.trim();
  const pronunciationScore = (correctWords / sentenceWords.length) * 100;

  if (missingWord) {
    missingWordDiv.textContent = `"${missingWord}"`;
  } else {
    missingWordDiv.textContent = "";
  }

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
  if (lessons.length === 0) return; // Ensure lessons are loaded
  const currentLesson = lessons[currentLessonIndex];
  const sentence = currentLesson.sentences[currentSentenceIndex];
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = "en-US";
  speechSynthesis.speak(utterance);
}

// Start audio recording
async function startAudioRecording() {
  audioChunks = [];
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };
  mediaRecorder.onstop = () => {
    recordedAudioBlob = new Blob(audioChunks, { type: "audio/wav" });
    micButton.innerHTML = '<i class="fas fa-microphone"></i>';
    micButton.style.backgroundColor = "";
    micButton.disabled = false;
    retryButton.style.display = "inline-block";
    retryButton.disabled = false;
    document.getElementById("recordingIndicator").style.display = "none";
  };
  mediaRecorder.start();
  micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
  micButton.style.color = "#ff0000";
  micButton.style.color = "#fff";
  micButton.disabled = true;
  document.getElementById("recordingIndicator").style.display = "inline-block";
}

// Play the recorded audio
function playRecordedAudio() {
  if (!recordedAudioBlob) {
    alert("No recorded audio available.");
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

// Load lessons from the GitHub API
async function loadLessons() {
  try {
    const url = 'https://api.github.com/repos/zyadafifi/lessons/contents/lessons.json';

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3.raw', // Fetch raw file content
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json(); // Parse the JSON
    lessons = data.lessons;
    console.log("Lessons loaded successfully:", lessons);

    // Get the lesson ID from the URL
    const lessonId = getLessonIdFromURL();
    currentLessonIndex = lessons.findIndex(lesson => lesson.videoId === lessonId);

    if (currentLessonIndex === -1) {
      console.error("Lesson not found!");
      return;
    }

    updateSentence(); // Update the UI with the first sentence
  } catch (error) {
    console.error("Error loading lessons:", error);
  }
}

// Get the lesson ID from the URL
function getLessonIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("lessonId");
}

// Load lessons when the page loads
loadLessons();

// Speech recognition logic
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  micButton.addEventListener("click", () => {
    if (!audioContext) {
      initializeAudioContext();
    }

    micButton.style.display = "none";
    retryButton.style.display = "inline-block";
    retryButton.disabled = false;
    startAudioRecording();
    recognition.start();
  });

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    console.log("Recognized Transcript:", transcript);

    const currentLesson = lessons[currentLessonIndex];
    const pronunciationScore = calculatePronunciationScore(
      transcript,
      currentLesson.sentences[currentSentenceIndex]
    );
    pronunciationScoreDiv.textContent = `${pronunciationScore}%`;
    updateProgressCircle(pronunciationScore);

    // Update total sentences spoken and overall score
    totalSentencesSpoken++;
    totalPronunciationScore += pronunciationScore;

    // Show the dialog container
    openDialog();
  };

  recognition.onspeechend = () => {
    recognition.stop();
    retryButton.style.display = "inline-block";
    retryButton.disabled = false;
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
  };

  recognition.onerror = (event) => {
    console.error("Speech Recognition Error:", event.error);
    recognizedTextDiv.textContent = "Speech Recognition Error";
    retryButton.style.display = "inline-block";
    retryButton.disabled = false;
  };

  retryButton.addEventListener("click", () => {
    recognizedTextDiv.textContent = "";
    pronunciationScoreDiv.textContent = "0%";
    retryButton.style.display = "none";
    retryButton.disabled = true;
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
    recognition.stop();
    startAudioRecording();
    recognition.start();
  });

  nextButton.addEventListener("click", () => {
    const currentLesson = lessons[currentLessonIndex];
    if (currentSentenceIndex < currentLesson.sentences.length - 1) {
      currentSentenceIndex++;
      updateSentence();
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
      overallScoreDiv.textContent = `${Math.round(totalPronunciationScore / totalSentencesSpoken)}%`;

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
} else {
  recognizedTextDiv.textContent = "Speech Recognition not supported in this browser.";
  micButton.disabled = true;
  retryButton.disabled = true;
}