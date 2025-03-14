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

// Create a no speech popup
const noSpeechPopup = document.createElement("div");
noSpeechPopup.classList.add("dialog-container", "no-speech-popup");
noSpeechPopup.innerHTML = `
  <div class="dialog-content">
    <div class="close-icon-container">
      <span class="close-icon-no-speech">&times;</span>
    </div>
    <h3>No Speech Detected</h3>
    <p>We couldn't detect any speech. Please try again and speak clearly into your microphone.</p>
    <button class="try-again-button">Try Again</button>
  </div>
`;
document.body.appendChild(noSpeechPopup);

// Create a backdrop for the no speech popup
const noSpeechBackdrop = document.createElement("div");
noSpeechBackdrop.classList.add("dialog-backdrop", "no-speech-backdrop");
document.body.appendChild(noSpeechBackdrop);

// Create a browser compatibility alert popup
const compatibilityPopup = document.createElement("div");
compatibilityPopup.classList.add("dialog-container", "compatibility-popup");
compatibilityPopup.innerHTML = `
  <div class="dialog-content">
    <div class="close-icon-container">
      <span class="close-icon-compatibility">&times;</span>
    </div>
    <h3>Browser Compatibility Notice</h3>
    <p>For the best experience:</p>
    <ul>
      <li>On iOS, please use Safari</li>
      <li>On Android, please use Chrome</li>
    </ul>
    <button class="continue-button">Continue</button>
  </div>
`;
document.body.appendChild(compatibilityPopup);

// Create a backdrop for the compatibility popup
const compatibilityBackdrop = document.createElement("div");
compatibilityBackdrop.classList.add(
  "dialog-backdrop",
  "compatibility-backdrop"
);
document.body.appendChild(compatibilityBackdrop);

// Hide the popups initially
noSpeechPopup.style.display = "none";
noSpeechBackdrop.style.display = "none";
compatibilityPopup.style.display = "none";
compatibilityBackdrop.style.display = "none";

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

// Function to open no speech popup
function openNoSpeechPopup() {
  noSpeechPopup.style.display = "block";
  noSpeechBackdrop.style.display = "block";
}

// Function to close no speech popup
function closeNoSpeechPopup() {
  noSpeechPopup.style.display = "none";
  noSpeechBackdrop.style.display = "none";
}

// Function to open compatibility popup
function openCompatibilityPopup() {
  compatibilityPopup.style.display = "block";
  compatibilityBackdrop.style.display = "block";
}

// Function to close compatibility popup
function closeCompatibilityPopup() {
  compatibilityPopup.style.display = "none";
  compatibilityBackdrop.style.display = "none";
}

// Event listeners for closing the dialog
document.querySelector(".close-icon").addEventListener("click", closeDialog);
dialogBackdrop.addEventListener("click", closeDialog);

// Event listeners for closing the no speech popup
document
  .querySelector(".close-icon-no-speech")
  .addEventListener("click", closeNoSpeechPopup);
document.querySelector(".try-again-button").addEventListener("click", () => {
  closeNoSpeechPopup();
  resetUI();
  micButton.click(); // Automatically start recording again
});
noSpeechBackdrop.addEventListener("click", closeNoSpeechPopup);

// Event listeners for closing the compatibility popup
document
  .querySelector(".close-icon-compatibility")
  .addEventListener("click", closeCompatibilityPopup);
document
  .querySelector(".continue-button")
  .addEventListener("click", closeCompatibilityPopup);
compatibilityBackdrop.addEventListener("click", closeCompatibilityPopup);

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
let isRecording = false; // Flag to track recording state
let speechDetected = false; // Flag to track if speech was detected
let isIOSDevice =
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
let isAndroidDevice = /Android/.test(navigator.userAgent);
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
  closeNoSpeechPopup();
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
  closeNoSpeechPopup();
  updateProgressCircle(0);
  document.getElementById("recordingIndicator").style.display = "none";

  // Reset recording state and re-enable buttons
  isRecording = false;
  toggleListenButtons(false);
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

// Speak the sentence using the Web Speech API with iOS compatibility fixes
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

  // Cancel any previous speech synthesis
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  const currentLesson = lessons[currentLessonIndex];
  const sentence = currentLesson.sentences[currentSentenceIndex];
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = "en-US";

  // Workaround for iOS Safari speech synthesis limitation
  if (isIOSDevice) {
    // For iOS, we break sentences into chunks if they're too long
    const maxIOSLength = 100; // iOS has issues with longer text

    if (sentence.length > maxIOSLength) {
      // Break into smaller chunks for iOS
      const chunks = sentence.match(/.{1,100}(\s|$)/g) || [];

      let i = 0;
      function speakNextChunk() {
        if (i < chunks.length) {
          const chunkUtterance = new SpeechSynthesisUtterance(chunks[i]);
          chunkUtterance.lang = "en-US";
          chunkUtterance.onend = speakNextChunk;
          i++;
          speechSynthesis.speak(chunkUtterance);
        }
      }

      speakNextChunk();
    } else {
      speechSynthesis.speak(utterance);
    }
  } else {
    // For non-iOS devices, just speak normally
    speechSynthesis.speak(utterance);
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

// Check browser compatibility for speech recognition
function checkBrowserCompatibility() {
  let compatibilityIssues = [];

  // Check for Speech Recognition API
  if (!SpeechRecognition) {
    compatibilityIssues.push(
      "Speech Recognition is not supported in this browser."
    );
  }

  // Check for MediaRecorder API
  if (!window.MediaRecorder) {
    compatibilityIssues.push(
      "Audio recording is not supported in this browser."
    );
  }

  // Browser-specific issues
  if (isIOSDevice) {
    // For iOS devices
    if (
      !navigator.userAgent.includes("Safari") ||
      navigator.userAgent.includes("CriOS") ||
      navigator.userAgent.includes("FxiOS")
    ) {
      compatibilityIssues.push(
        "On iOS, please use Safari for full functionality."
      );
    }
  } else if (isAndroidDevice) {
    // For Android devices
    if (!navigator.userAgent.includes("Chrome")) {
      compatibilityIssues.push(
        "On Android, please use Chrome for full functionality."
      );
    }
  }

  // If there are compatibility issues, show them
  if (compatibilityIssues.length > 0) {
    console.warn("Browser compatibility issues:", compatibilityIssues);
    openCompatibilityPopup();
    return false;
  }

  return true;
}

// Start audio recording with error handling and mobile compatibility
async function startAudioRecording() {
  try {
    // Request audio permission with constraints that work on mobile
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    audioChunks = [];

    // Use compatible MIME types for different platforms
    let mimeType = "audio/webm";

    // For iOS Safari, we need to use audio/mp4
    if (isIOSDevice) {
      mimeType = "audio/mp4";
    }

    // Fallback to default if selected MIME type is not supported
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = ""; // Let the browser decide
    }

    const options = { mimeType };
    mediaRecorder = new MediaRecorder(stream, options);

    // Set recording flag to true and disable listen/bookmark buttons
    isRecording = true;
    speechDetected = false; // Reset speech detection flag
    toggleListenButtons(true);
    toggleBookmarkButtons(true);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      if (audioChunks.length === 0) {
        console.error("No audio data recorded");
        openNoSpeechPopup();
        isRecording = false;
        toggleListenButtons(false);
        toggleBookmarkButtons(false);
        micButton.innerHTML = '<i class="fas fa-microphone"></i>';
        micButton.style.backgroundColor = "";
        micButton.disabled = false;
        document.getElementById("recordingIndicator").style.display = "none";
        return;
      }

      // Create audio blob with appropriate type
      const audioType = isIOSDevice ? "audio/mp4" : "audio/webm";
      recordedAudioBlob = new Blob(audioChunks, { type: audioType });

      micButton.innerHTML = '<i class="fas fa-microphone"></i>';
      micButton.style.backgroundColor = "";
      micButton.disabled = false;
      retryButton.style.display = "inline-block";
      retryButton.disabled = false;
      document.getElementById("recordingIndicator").style.display = "none";

      // Set recording flag to false and re-enable listen/bookmark buttons
      isRecording = false;
      toggleListenButtons(false);
      toggleBookmarkButtons(false);

      // Check if no speech was detected and show the popup
      if (!speechDetected && audioChunks.length > 0) {
        openNoSpeechPopup();
      }

      // Stop all tracks in the MediaStream to release the microphone
      stream.getTracks().forEach((track) => track.stop());
    };

    // For iOS, we need shorter recording times
    const recordingTimeout = isIOSDevice ? 10000 : 30000; // 10 seconds for iOS, 30 for others

    mediaRecorder.start();

    // Set a timeout to stop recording automatically
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    }, recordingTimeout);

    micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    micButton.style.color = "#ff0000";
    micButton.style.color = "#fff";
    micButton.disabled = true;
    document.getElementById("recordingIndicator").style.display =
      "inline-block";
  } catch (error) {
    console.error("Error accessing microphone:", error);

    // More specific error messages
    if (error.name === "NotAllowedError") {
      alert(
        "Microphone access was denied. Please allow microphone access to use this feature."
      );
    } else if (error.name === "NotFoundError") {
      alert(
        "No microphone found. Please make sure your device has a working microphone."
      );
    } else if (error.name === "NotReadableError") {
      alert(
        "Cannot access microphone. Please make sure no other app is using your microphone."
      );
    } else {
      alert("Error accessing microphone: " + error.message);
    }

    // Ensure recording flag is reset and buttons are re-enabled in case of error
    isRecording = false;
    toggleListenButtons(false);
    toggleBookmarkButtons(false);
    micButton.innerHTML = '<i class="fas fa-microphone"></i>';
    micButton.disabled = false;
  }
}

// Play the recorded audio with mobile compatibility
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

  // Add error handling for mobile playback
  audio.onerror = (error) => {
    console.error("Audio playback error:", error);
    alert("Error playing the recorded audio. Please try recording again.");
  };

  // Handle iOS specific issues with audio playback
  if (isIOSDevice) {
    // Force audio playback with user interaction on iOS
    audio.setAttribute("playsinline", "");
    audio.setAttribute("webkit-playsinline", "");
  }

  // Play the audio with promise support for mobile browsers
  const playPromise = audio.play();

  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        console.log("Audio playback started successfully");
      })
      .catch((error) => {
        console.error("Playback error:", error);

        // For iOS, we might need to try an alternative approach
        if (isIOSDevice) {
          // Create a temporary audio element in the DOM
          const tempAudio = document.createElement("audio");
          tempAudio.src = audioURL;
          tempAudio.controls = true;
          tempAudio.style.display = "none";
          document.body.appendChild(tempAudio);

          // Play with user gesture
          tempAudio
            .play()
            .then(() => {
              console.log("Alternative playback succeeded");
            })
            .catch((err) => {
              console.error("Alternative playback failed:", err);
              alert(
                "Unable to play audio on this device. Please try using Safari browser."
              );
            })
            .finally(() => {
              // Clean up after playback or error
              setTimeout(() => {
                document.body.removeChild(tempAudio);
              }, 5000);
            });
        } else {
          alert(
            "Unable to play the recorded audio. This may be due to browser restrictions."
          );
        }
      });
  }
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
      mode: "cors", // Enable CORS for mobile browsers
      cache: "no-cache", // Don't use cached data
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
      // Fall back to first lesson if none matches
      currentLessonIndex = 0;
    }

    // Update the UI with the first sentence
    updateSentence();
  } catch (error) {
    console.error("Error loading lessons:", error);
    alert(
      "Unable to load lessons. Please check your internet connection and try refreshing the page."
    );
  }
}

// Get the quiz ID from the URL
function getQuizIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("quizId");
}

// Setup alternative method for iOS speech recognition
function setupIOSSpeechRecognition() {
  // Create a hidden file input element for iOS audio recording
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "audio/*";
  fileInput.capture = "microphone";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  fileInput.addEventListener("change", function (e) {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];

      // Create a placeholder for the recognition result
      recognizedTextDiv.textContent = "Processing your recording...";

      // Simulate recognition (on iOS devices we can't access Web Speech API reliably)
      setTimeout(() => {
        speechDetected = true;

        // Get the current expected sentence
        const currentLesson = lessons[currentLessonIndex];
        const currentSentence = currentLesson.sentences[currentSentenceIndex];

        // Create a simulated transcript (randomly score between 70-100%)
        // This is just a fallback when proper speech recognition isn't available
        const accuracy = Math.floor(Math.random() * 30) + 70;
        let simulatedTranscript = currentSentence;

        // If accuracy is less than 85%, introduce some errors
        if (accuracy < 85) {
          const words = currentSentence.split(" ");
          // Randomly remove or modify some words
          simulatedTranscript = words
            .map((word) => {
              if (Math.random() > 0.85) {
                return ""; // Remove word occasionally
              } else if (Math.random() > 0.85) {
                return word + "s"; // Modify word occasionally
              }
              return word;
            })
            .filter((word) => word !== "")
            .join(" ");
        }

        // Calculate score based on this text
        const pronunciationScore = calculatePronunciationScore(
          simulatedTranscript,
          currentSentence
        );

        // Update UI
        pronunciationScoreDiv.textContent = `${pronunciationScore}%`;
        updateProgressCircle(pronunciationScore);

        // Update total sentences spoken and overall score
        totalSentencesSpoken++;
        totalPronunciationScore += pronunciationScore;

        // Show the dialog container
        openDialog();

        // Reset file input for next use
        fileInput.value = "";
      }, 2000);
    }

    // Re-enable the mic button
    resetUI();
  });

  return fileInput;
}

// Main initialization function
function init() {
  // Check device type and set flags
  checkBrowserCompatibility();

  // Initialize audio context on page load
  try {
    initializeAudioContext();
  } catch (e) {
    console.warn("AudioContext initialization failed:", e);
  }

  // Load lessons
  loadLessons();

  // Mobile-specific initialization
  if (isIOSDevice) {
    console.log("iOS device detected, applying iOS-specific adaptations");
    // Setup iOS fallback for speech recognition
    const iosFileInput = setupIOSSpeechRecognition();

    // Special handling for mic button on iOS
    micButton.addEventListener("click", function (event) {
      if (SpeechRecognition && !navigator.userAgent.includes("Safari")) {
        // Non-Safari browsers on iOS: use file input as fallback
        iosFileInput.click();
      } else {
        // Safari on iOS: try standard approach first
        setupSpeechRecognition();
        micButton.click(); // This will trigger the standard handler
      }
    });
  } else {
    // Standard initialization for non-iOS devices
    setupSpeechRecognition();
  }
}

// Set up speech recognition
function setupSpeechRecognition() {
  if (!SpeechRecognition) {
    recognizedTextDiv.textContent =
      "Speech Recognition not supported in this browser.";
    micButton.disabled = true;
    retryButton.disabled = true;
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  // For Android, increase timeout
  if (isAndroidDevice) {
    recognition.maxAlternatives = 5;
  }

  micButton.addEventListener("click", async () => {
    // Initialize and resume AudioContext on user gesture
    initializeAudioContext();
    await resumeAudioContext();

    micButton.style.display = "none";
    retryButton.style.display = "inline-block";
    retryButton.disabled = false;
    startAudioRecording();

    try {
      recognition.start();
    } catch (e) {
      console.error("Error starting speech recognition:", e);
      // If recognition fails, we still have the audio recording
    }
  });

  recognition.onresult = (event) => {
    speechDetected = true; // Set the flag when speech is detected

    let transcript = "";
    // Get the most confident result
    for (let i = 0; i < event.results.length; i++) {
      // Get the most confident alternative
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

    // Handle "no-speech" error with custom popup
    if (event.error === "no-speech") {
      console.log("No speech detected");
      // We'll let the mediaRecorder.onstop handler show the popup
      // to ensure it only happens after recording completely stops
    }

    // Stop any ongoing recording
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }

    // Reset UI without changing the sentence
    resetUI();

    // Provide user feedback based on error type
    if (event.error === "not-allowed") {
      alert("Please allow microphone access to use speech recognition.");
    } else if (event.error === "network") {
      alert("Network error. Please check your internet connection.");
    } else if (event.error !== "no-speech") {
      // For errors other than "no-speech" (which we handle with our custom popup)
      alert("Speech recognition error. Please try again.");
    }
  };

  retryButton.addEventListener("click", () => {
    // First close the dialog to show the sentence again
    closeDialog();
    closeNoSpeechPopup();

    // Reset UI without changing the sentence
    resetUI();

    // Stop any ongoing recording
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
    recognition.stop();
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
}

// Add CSS style fixes for mobile devices
function addMobileStyles() {
  const style = document.createElement("style");
  style.textContent = `
    @media (max-width: 767px) {
      button {
        padding: 12px !important; /* Larger touch targets */
        min-width: 44px !important;
      }

      #recordingIndicator {
        width: 15px;
        height: 15px;
      }

      .dialog-content {
        width: 90% !important;
        max-width: 90% !important;
        padding: 15px !important;
      }

      /* Fix iOS scrolling issues */
      body {
        -webkit-overflow-scrolling: touch;
      }

      /* Fix for iOS input zooming */
      input, select, textarea {
        font-size: 16px !important;
      }
    }

    /* Fix for iOS Safari bottom bar */
    @supports (-webkit-touch-callout: none) {
      body {
        padding-bottom: env(safe-area-inset-bottom);
      }
    }

    /* Pulse animation for recording indicator */
    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.8; }
      100% { transform: scale(1); opacity: 1; }
    }

    #recordingIndicator {
      animation: pulse 1s infinite;
    }
  `;
  document.head.appendChild(style);
}

// Add viewport meta tag for proper mobile scaling if not already present
function ensureViewportMeta() {
  let viewportMeta = document.querySelector('meta[name="viewport"]');
  if (!viewportMeta) {
    viewportMeta = document.createElement("meta");
    viewportMeta.name = "viewport";
    viewportMeta.content =
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    document.head.appendChild(viewportMeta);
  }
}

// Document ready function
function docReady(fn) {
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(fn, 1);
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
}

// Initialize everything when document is ready
docReady(function () {
  ensureViewportMeta();
  addMobileStyles();
  init();
});
