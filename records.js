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
let audioContext;
let hasMicrophonePermission = false; // Flag to track microphone permission status

// Hide retry button initially
retryButton.style.display = "none";

// Function to check if the device is iOS
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

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
    // iOS requires user interaction to initialize AudioContext
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass({
      // iOS specific options
      sampleRate: isIOS() ? 44100 : undefined,
      latencyHint: isIOS() ? "interactive" : "balanced",
    });
    console.log("AudioContext initialized.");
  }
}

// Function to resume AudioContext
async function resumeAudioContext() {
  if (audioContext && audioContext.state === "suspended") {
    try {
      await audioContext.resume();
      console.log("AudioContext resumed.");
    } catch (err) {
      console.error("Error resuming AudioContext:", err);
    }
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
  document.getElementById("recordingIndicator").style.display = "none";

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

  // Set specific voice options for iOS
  utterance.lang = "en-US";
  utterance.rate = 0.9; // Slightly slower for clarity
  utterance.pitch = 1.0;

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

// Request permission for microphone access
async function requestMicrophonePermission() {
  try {
    // Request permission to access the microphone
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Stop the stream immediately - we just needed the permission
    stream.getTracks().forEach((track) => track.stop());

    hasMicrophonePermission = true;
    console.log("Microphone permission granted");
    return true;
  } catch (error) {
    console.error("Error requesting microphone permission:", error);

    // iOS-specific error handling
    if (isIOS()) {
      alert(
        "Please allow microphone access in your device settings to use this feature. On iOS, you may need to: \n1. Go to Settings > Privacy > Microphone \n2. Enable access for your browser"
      );
    } else {
      alert("Please allow microphone access to use this feature.");
    }

    hasMicrophonePermission = false;
    return false;
  }
}

// Start audio recording with error handling
async function startAudioRecording() {
  try {
    // For iOS, we need to ensure we have permission first
    if (!hasMicrophonePermission) {
      const permissionGranted = await requestMicrophonePermission();
      if (!permissionGranted) return;
    }

    // iOS-specific audio constraints
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // iOS-specific options
        sampleRate: isIOS() ? 44100 : 48000,
        sampleSize: isIOS() ? 16 : 24,
      },
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    audioChunks = [];

    // iOS-specific recorder options
    const options = {
      mimeType: "audio/webm;codecs=opus",
    };

    try {
      mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      // Fallback for iOS which may not support webm
      console.log("WebM not supported, falling back to default format");
      mediaRecorder = new MediaRecorder(stream);
    }

    // Set recording flag to true and disable listen/bookmark buttons
    isRecording = true;
    speechDetected = false; // Reset speech detection flag
    toggleListenButtons(true);
    toggleBookmarkButtons(true);

    // Set a timeout to check if speech is detected
    clearTimeout(noSpeechTimeout);
    noSpeechTimeout = setTimeout(() => {
      // Only trigger if still recording and no speech detected
      if (isRecording && !speechDetected) {
        console.log("No speech detected timeout triggered");
        if (mediaRecorder && mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
        alert("No speech detected. Please try again and speak clearly.");
      }
    }, NO_SPEECH_TIMEOUT_MS);

    // Add audio analyzer to detect speech
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Function to detect speech
    const detectSpeech = () => {
      if (!isRecording) return;

      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;

      // If average is above threshold, speech is detected
      if (average > 20) {
        speechDetected = true;
        console.log("Speech detected");
      }

      if (isRecording) {
        requestAnimationFrame(detectSpeech);
      }
    };

    // Start speech detection
    detectSpeech();

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      // Create blob from the audio chunks
      let audioType = "audio/webm";

      // For iOS, we might need to use different MIME types
      if (isIOS()) {
        // Try to determine the actual MIME type of the recording
        const blobType = audioChunks[0]?.type;
        if (blobType) {
          audioType = blobType;
        } else {
          // Fallback to a common format
          audioType = "audio/mp4";
        }
      }

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

      // Clear the timeout when recording stops
      clearTimeout(noSpeechTimeout);

      // Stop all tracks in the MediaStream to release the microphone
      stream.getTracks().forEach((track) => track.stop());

      // Upload the recorded audio to AssemblyAI for transcription
      const transcription = await uploadAudioToAssemblyAI(recordedAudioBlob);
      if (transcription) {
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

        // Show the dialog container
        openDialog();
      }
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

    // iOS-specific error handling
    if (isIOS()) {
      if (error.name === "NotAllowedError") {
        alert(
          "Microphone access was denied. Please allow microphone access in your iOS device settings to use this feature. Go to Settings > Privacy > Microphone and enable access for your browser."
        );
      } else {
        alert(
          `Error accessing microphone: ${error.message}. On iOS, you may need to use Safari browser for best compatibility.`
        );
      }
    } else {
      alert(`Error accessing microphone: ${error.message}`);
    }

    // Ensure recording flag is reset and buttons are re-enabled in case of error
    isRecording = false;
    toggleListenButtons(false);
    toggleBookmarkButtons(false);
    clearTimeout(noSpeechTimeout);
  }
}

// Upload audio to AssemblyAI and get transcription
async function uploadAudioToAssemblyAI(audioBlob) {
  try {
    // For iOS, we might need to convert the audio format
    let blobToUpload = audioBlob;

    // Display upload status
    recognizedTextDiv.innerHTML =
      '<span style="color: blue;">Uploading and transcribing audio...</span>';

    // Step 1: Upload the audio file to AssemblyAI
    const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        authorization: ASSEMBLYAI_API_KEY,
        "content-type": "application/octet-stream",
      },
      body: blobToUpload,
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
          language_code: "en", // Specify language for better accuracy
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
    let attempts = 0;
    const maxAttempts = 30; // Maximum number of polling attempts

    while (attempts < maxAttempts) {
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
        throw new Error(`Transcription failed: ${statusData.error}`);
      }

      // Wait for 1 second before polling again
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;

      // Update the status message
      recognizedTextDiv.innerHTML = `<span style="color: blue;">Transcribing audio... (${attempts}/${maxAttempts})</span>`;
    }

    if (!transcriptionResult) {
      throw new Error("Transcription timed out. Please try again.");
    }

    return transcriptionResult;
  } catch (error) {
    console.error("Error in AssemblyAI transcription:", error);
    alert(`Failed to transcribe audio: ${error.message}. Please try again.`);
    recognizedTextDiv.innerHTML =
      '<span style="color: red;">Transcription failed. Please try again.</span>';
    return null;
  }
}
// Play the recorded audio
function playRecordedAudio() {
  // Check if recording is in progress - if so, don't allow playback
  if (isRecording) {
    console.log("Cannot play audio while recording");
    alert(
      "Cannot play recorded audio while recording. Please finish recording first."
    );
    return;
  }

  // Check if we have recorded audio to play
  if (recordedAudioBlob) {
    const audioURL = URL.createObjectURL(recordedAudioBlob);
    const audioElement = new Audio(audioURL);

    // iOS requires user interaction to play audio
    if (isIOS()) {
      // Resume AudioContext if suspended
      resumeAudioContext().then(() => {
        audioElement.play().catch((error) => {
          console.error("Error playing audio:", error);
          alert(
            "Failed to play audio. On iOS, please ensure your device is not muted."
          );
        });
      });
    } else {
      audioElement.play().catch((error) => {
        console.error("Error playing audio:", error);
      });
    }
  } else {
    alert("No audio recorded yet. Please record first.");
  }
}

// Load lessons from a JSON file
async function loadLessons() {
  try {
    const response = await fetch("lessons.json");
    if (!response.ok) {
      throw new Error(`Failed to load lessons: ${response.statusText}`);
    }
    lessons = await response.json();
    console.log("Lessons loaded:", lessons);
    updateSentence();
  } catch (error) {
    console.error("Error loading lessons:", error);
    alert("Failed to load lessons. Please refresh and try again.");
  }
}

// Initialize the application
function initializeApp() {
  // Load lessons
  loadLessons();

  // Add event listeners
  micButton.addEventListener("click", async () => {
    // Initialize audio context first (important for iOS)
    initializeAudioContext();
    await resumeAudioContext();
    startAudioRecording();
  });

  retryButton.addEventListener("click", () => {
    resetUI();
  });

  nextButton.addEventListener("click", () => {
    // Move to the next sentence
    const currentLesson = lessons[currentLessonIndex];
    if (currentSentenceIndex < currentLesson.sentences.length - 1) {
      currentSentenceIndex++;
      updateSentence();
    } else {
      // End of lesson
      sentencesSpokenDiv.textContent = totalSentencesSpoken;
      const overallScore = Math.round(
        totalPronunciationScore / totalSentencesSpoken
      );
      overallScoreDiv.textContent = `${overallScore}%`;

      // Update UI to show lesson completion
      document.querySelector(".lesson-complete").style.display = "block";
    }
  });

  continueButton.addEventListener("click", () => {
    // Move to the next lesson or restart
    if (currentLessonIndex < lessons.length - 1) {
      currentLessonIndex++;
      currentSentenceIndex = 0;
    } else {
      // All lessons completed, restart from the first one
      currentLessonIndex = 0;
      currentSentenceIndex = 0;
    }

    // Reset statistics
    totalSentencesSpoken = 0;
    totalPronunciationScore = 0;

    // Hide lesson complete screen
    document.querySelector(".lesson-complete").style.display = "none";

    // Update UI for new lesson
    updateSentence();
  });

  // Listen button event listeners
  listenButton.addEventListener("click", () => {
    // iOS requires user interaction to initialize audio context
    initializeAudioContext();
    resumeAudioContext().then(() => {
      speakSentence();
    });
  });

  listen2Button.addEventListener("click", () => {
    // iOS requires user interaction to initialize audio context
    initializeAudioContext();
    resumeAudioContext().then(() => {
      speakSentence();
    });
  });

  // Bookmark button event listeners
  bookmarkIcon.addEventListener("click", playRecordedAudio);
  bookmarkIcon2.addEventListener("click", playRecordedAudio);

  // iOS-specific initialization
  if (isIOS()) {
    setupIOSSpecificBehaviors();
  }

  // Initially request microphone permission
  requestMicrophonePermission();
}

// iOS-specific behaviors
function setupIOSSpecificBehaviors() {
  // iOS Safari requires user interaction to play audio/initialize AudioContext
  document.body.addEventListener(
    "touchstart",
    function () {
      if (audioContext && audioContext.state === "suspended") {
        audioContext.resume();
      }
    },
    { once: true }
  );

  // Add iOS-specific styling
  const style = document.createElement("style");
  style.textContent = `
    /* iOS-specific button styles with larger touch targets */
    button {
      min-height: 44px;
      min-width: 44px;
      padding: 12px;
    }
    
    /* Fix iOS Safari 100vh issue */
    .dialog-container {
      height: -webkit-fill-available;
      max-height: 90vh;
    }
    
    /* Improve tap target sizes for iOS */
    .bookmark-icon, #bookmark-icon2 {
      padding: 10px;
    }
  `;
  document.head.appendChild(style);

  // Add iOS detection class to body
  document.body.classList.add("ios-device");
}

// Fix audio recording issues specific to iOS Safari
function createiOSMediaRecorderPolyfill(stream) {
  // If MediaRecorder is not supported or has issues on iOS
  if (
    isIOS() &&
    (typeof MediaRecorder === "undefined" ||
      !MediaRecorder.isTypeSupported("audio/webm"))
  ) {
    console.log("Using iOS audio recording polyfill");

    // Create audio context and source
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    // Connect nodes
    source.connect(processor);
    processor.connect(audioContext.destination);

    // Audio data buffer
    const audioChunks = [];

    // Create polyfill object with MediaRecorder-like interface
    const polyfill = {
      start: function () {
        this.state = "recording";

        // Process audio data
        processor.onaudioprocess = (e) => {
          if (this.state === "recording") {
            const buffer = e.inputBuffer.getChannelData(0);
            // Convert float32 to int16
            const pcmData = new Int16Array(buffer.length);
            for (let i = 0; i < buffer.length; i++) {
              pcmData[i] = buffer[i] * 0x7fff;
            }
            audioChunks.push(pcmData.buffer);
          }
        };
      },

      stop: function () {
        this.state = "inactive";
        processor.onaudioprocess = null;
        source.disconnect();
        processor.disconnect();

        // Create a blob with the audio data
        const blob = new Blob(audioChunks, { type: "audio/wav" });

        // Trigger data available event
        if (this.ondataavailable) {
          this.ondataavailable({ data: blob });
        }

        // Trigger stop event
        if (this.onstop) {
          this.onstop();
        }
      },

      state: "inactive",
      ondataavailable: null,
      onstop: null,
    };

    return polyfill;
  }

  // Otherwise use native MediaRecorder
  return new MediaRecorder(stream);
}

// Helper function for iOS audio format conversion
async function convertAudioForAssemblyAI(audioBlob) {
  // If on iOS and the blob isn't the right format, convert it
  if (isIOS() && audioBlob.type !== "audio/webm") {
    console.log(
      `Converting audio from ${audioBlob.type} for AssemblyAI compatibility`
    );

    // If you want to implement a conversion, you would do it here
    // This is complex and might require a dedicated library
    // For now, we'll just use the blob as-is and let AssemblyAI handle it

    return audioBlob;
  }

  return audioBlob;
}

// Handle page visibility changes (important for iOS)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    // If recording is in progress when the app goes to background, stop it
    if (isRecording && mediaRecorder && mediaRecorder.state === "recording") {
      console.log("Page hidden while recording, stopping recorder");
      mediaRecorder.stop();
    }

    // If speech synthesis is speaking, cancel it
    if (window.speechSynthesis && speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
  }
});

// Handle iOS orientation change
window.addEventListener("orientationchange", () => {
  // Small delay to let the UI settle
  setTimeout(() => {
    // Adjust UI for new orientation if needed
    adjustUIForOrientation();
  }, 300);
});

function adjustUIForOrientation() {
  // iOS-specific adjustments when orientation changes
  if (isIOS()) {
    // Fix potential iOS height issues after orientation change
    document.documentElement.style.height = "100%";
    document.body.style.height = "100%";

    // Force redraw of dialog if open
    if (dialogContainer.style.display === "block") {
      dialogContainer.style.display = "none";
      // Force reflow
      void dialogContainer.offsetWidth;
      dialogContainer.style.display = "block";
    }
  }
}

// iOS WebAudio unlock function - call on first user interaction
function unlockAudioForIOS() {
  if (!isIOS()) return;

  // Create temporary audio context and buffer
  const tempContext = new (window.AudioContext || window.webkitAudioContext)();
  const tempBuffer = tempContext.createBuffer(1, 1, 22050);
  const tempSource = tempContext.createBufferSource();

  tempSource.buffer = tempBuffer;
  tempSource.connect(tempContext.destination);

  // Play and immediately disconnect
  tempSource.start(0);
  tempContext.close();

  console.log("iOS audio unlocked");
}

// Add iOS audio unlock to various user interaction events
function setupIOSAudioUnlock() {
  const unlockEvents = ["touchstart", "touchend", "mousedown", "keydown"];

  const unlock = function () {
    unlockAudioForIOS();

    // Remove event listeners once unlocked
    unlockEvents.forEach((event) => {
      document.body.removeEventListener(event, unlock);
    });
  };

  // Add event listeners
  unlockEvents.forEach((event) => {
    document.body.addEventListener(event, unlock, false);
  });
}

// Start the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Check if running on iOS
  if (isIOS()) {
    console.log("Running on iOS device");
    setupIOSAudioUnlock();
  }

  initializeApp();
});

// Service worker registration for PWA support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log("ServiceWorker registration successful");
      })
      .catch((error) => {
        console.error("ServiceWorker registration failed:", error);
      });
  });
}
