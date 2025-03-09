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
let SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition; // Speech recognition API
let mediaRecorder;
let audioChunks = [];
let recordedAudioBlob; // Stores the recorded audio blob
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

// Check if two words are exactly the same
function isExactMatch(word1, word2) {
  return word1 === word2;
}

// Helper function to calculate similarity between two words
// Returns a value between 0 (no similarity) and 1 (identical)
function calculateSimilarity(word1, word2) {
  // Convert to lowercase
  word1 = word1.toLowerCase();
  word2 = word2.toLowerCase();

  // If one word contains the other, they're very similar
  if (word1.includes(word2) || word2.includes(word1)) {
    return 0.9;
  }

  // Count matching characters
  const minLength = Math.min(word1.length, word2.length);
  let matchingChars = 0;

  for (let i = 0; i < minLength; i++) {
    if (word1[i] === word2[i]) {
      matchingChars++;
    }
  }

  // Calculate similarity ratio based on the longer word's length
  const maxLength = Math.max(word1.length, word2.length);
  return matchingChars / maxLength;
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

  // Generate the highlighted text based on the matching results
  for (let i = 0; i < sentenceWords.length; i++) {
    const expectedWord = sentenceWords[i];

    if (matchedSentenceIndices[i]) {
      // Word was matched correctly
      highlightedText += `<span style="color: green;">${expectedWord}</span> `;
      console.log(`Correct: "${expectedWord}"`);
    } else {
      // Check if the word exists in the transcript but in wrong position
      let found = false;
      for (let j = 0; j < transcriptWords.length; j++) {
        if (
          !matchedTranscriptIndices[j] &&
          transcriptWords[j].includes(expectedWord)
        ) {
          highlightedText += `<span style="color: red;">${expectedWord}</span> `;
          incorrectWords.push({
            expected: expectedWord,
            got: transcriptWords[j],
          });
          console.log(
            `Incorrect position: Expected "${expectedWord}" at different position`
          );
          matchedTranscriptIndices[j] = true;
          found = true;
          break;
        }
      }

      if (!found) {
        // Word was completely missed
        highlightedText += `<span style="color: grey;">${expectedWord}</span> `;
        missingWords.push(expectedWord);
        console.log(`Missing: "${expectedWord}"`);
      }
    }
  }

  // Check for extra words that were spoken but not in the expected sentence
  // Compare them against the expected words to classify as incorrect vs. truly extra
  for (let j = 0; j < transcriptWords.length; j++) {
    if (!matchedTranscriptIndices[j]) {
      // Check if this word is similar to any expected word
      let foundSimilar = false;
      let mostSimilarWord = "";
      let highestSimilarity = 0;

      // Simple similarity check - could be replaced with more sophisticated algorithm
      for (let i = 0; i < sentenceWords.length; i++) {
        // Check if the words share at least 60% of their characters
        // This is a simple similarity metric that can be improved
        const similarity = calculateSimilarity(
          transcriptWords[j],
          sentenceWords[i]
        );

        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          mostSimilarWord = sentenceWords[i];
        }

        if (similarity > 0.6) {
          // 60% similarity threshold
          foundSimilar = true;
          break;
        }
      }

      if (foundSimilar) {
        // Word is likely an incorrect attempt at an expected word
        highlightedText += `<span style="color: red;">[Incorrect: ${transcriptWords[j]}]</span> `;
        console.log(
          `Incorrect: "${transcriptWords[j]}" (similar to expected words)`
        );
      } else {
        // Word is truly extra (no similarity to any expected word)
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

  // Calculate pronunciation score
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
  if (lessons.length === 0) return; // Ensure lessons are loaded
  const currentLesson = lessons[currentLessonIndex];
  const sentence = currentLesson.sentences[currentSentenceIndex];
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = "en-US";
  speechSynthesis.speak(utterance);
}

// Start audio recording with error handling
async function startAudioRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
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
    document.getElementById("recordingIndicator").style.display =
      "inline-block";
  } catch (error) {
    console.error("Error accessing microphone:", error);
    alert("Please allow microphone access to use this feature.");
  }
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

// Speech recognition logic with error handling
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  micButton.addEventListener("click", async () => {
    // Initialize and resume AudioContext on user gesture
    initializeAudioContext();
    await resumeAudioContext();

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
    recognizedTextDiv.textContent = "Speech Recognition Error: " + event.error;

    // Provide user feedback
    if (event.error === "not-allowed") {
      alert("Please allow microphone access to use speech recognition.");
    } else if (event.error === "no-speech") {
      alert("No speech detected. Please try again.");
    } else if (event.error === "network") {
      alert("Network error. Please check your internet connection.");
    } else {
      alert("Speech recognition is not supported or failed. Please try again.");
    }
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
} else {
  recognizedTextDiv.textContent =
    "Speech Recognition not supported in this browser.";
  micButton.disabled = true;
  retryButton.disabled = true;
}
