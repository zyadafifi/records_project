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
let audioContext;
let analyser;
let dataArray;
let canvasCtx;
let animationId;
let waveformCanvas;
let recordingStartTime;

// AudioContext for sound effects
// let audioContext;

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

// Function to create and setup waveform visualization
function setupWaveformVisualization(stream) {
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

    // Insert canvas after the recording indicator
    const recordingIndicator = document.getElementById("recordingIndicator");
    if (recordingIndicator && recordingIndicator.parentNode) {
      recordingIndicator.parentNode.insertBefore(
        waveformCanvas,
        recordingIndicator.nextSibling
      );
    } else {
      // Fallback if recording indicator not found
      document.querySelector(".dialog-container").appendChild(waveformCanvas);
    }
  }

  // Get canvas context
  canvasCtx = waveformCanvas.getContext("2d");

  // Create analyzer
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 128; // Reduced for better performance
  analyser.smoothingTimeConstant = 0.8; // Smoother transitions

  // Connect stream to analyzer
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  // Create data array for analyzer
  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  // Start drawing
  drawWhatsAppWaveform();
}

// Function to draw WhatsApp-style waveform
function drawWhatsAppWaveform() {
  if (!isRecording) return;

  animationId = requestAnimationFrame(drawWhatsAppWaveform);

  // Get data from analyzer
  analyser.getByteFrequencyData(dataArray);

  // Clear canvas
  canvasCtx.fillStyle = "#f0f0f0";
  canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

  // Calculate bar width and spacing
  const barCount = 30; // Number of bars to display
  const barWidth = 4;
  const barSpacing = 2;
  const totalBarWidth = barCount * (barWidth + barSpacing);
  const startX = (waveformCanvas.width - totalBarWidth) / 2;

  // Draw bars
  for (let i = 0; i < barCount; i++) {
    // Map the data to a reasonable height range
    const dataIndex = Math.floor((i * dataArray.length) / barCount);
    const value = dataArray[dataIndex];
    const barHeight = Math.max(4, (value / 255) * waveformCanvas.height * 0.8);

    // Calculate position
    const x = startX + i * (barWidth + barSpacing);
    const y = (waveformCanvas.height - barHeight) / 2;

    // Draw bar with gradient
    const gradient = canvasCtx.createLinearGradient(0, y, 0, y + barHeight);
    gradient.addColorStop(0, "#0aa989");
    gradient.addColorStop(1, "#0aa989");

    canvasCtx.fillStyle = gradient;
    canvasCtx.fillRect(x, y, barWidth, barHeight);

    // Add rounded corners
    canvasCtx.fillStyle = "#0aa989";
    canvasCtx.beginPath();
    canvasCtx.arc(x + barWidth / 2, y, barWidth / 2, Math.PI, 0, false);
    canvasCtx.arc(
      x + barWidth / 2,
      y + barHeight,
      barWidth / 2,
      0,
      Math.PI,
      false
    );
    canvasCtx.fill();
  }

  // Add recording time indicator
  const recordingTime = Math.floor((Date.now() - recordingStartTime) / 1000);
  const minutes = Math.floor(recordingTime / 60);
  const seconds = recordingTime % 60;
  const timeText = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  canvasCtx.fillStyle = "#333";
  canvasCtx.font = "12px Arial";
  canvasCtx.textAlign = "right";
  canvasCtx.fillText(timeText, waveformCanvas.width - 10, 15);
}

// Start audio recording with automatic stop
async function startAudioRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    // Set recording flag to true and disable listen/bookmark buttons
    isRecording = true;
    toggleListenButtons(true);
    toggleBookmarkButtons(true);

    // Record start time for timer
    recordingStartTime = Date.now();

    // Setup waveform visualization
    setupWaveformVisualization(stream);
    if (waveformCanvas) {
      waveformCanvas.style.display = "block";
    }

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

      // Stop waveform visualization
      stopWaveformVisualization();

      // Set recording flag to false and re-enable listen/bookmark buttons
      isRecording = false;
      toggleListenButtons(false);
      toggleBookmarkButtons(false);

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

    // Start recording
    mediaRecorder.start();
    micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    micButton.style.color = "#ff0000";
    micButton.disabled = true;
    document.getElementById("recordingIndicator").style.display =
      "inline-block";

    // Set timeout to automatically stop recording after RECORDING_DURATION
    recordingTimeout = setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    }, RECORDING_DURATION);
  } catch (error) {
    console.error("Error accessing microphone:", error);
    alert("Please allow microphone access to use this feature.");

    // Ensure recording flag is reset and buttons are re-enabled in case of error
    isRecording = false;
    toggleListenButtons(false);
    toggleBookmarkButtons(false);
  }
}

// Upload audio to AssemblyAI and get transcription
async function uploadAudioToAssemblyAI(audioBlob) {
  try {
    // Show processing indication
    recognizedTextDiv.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Processing...';

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

    // Step 2: Submit the transcription request with optimized settings
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
          language_detection: false, // Disable language detection for speed
          punctuate: false, // Disable punctuation for speed
          format_text: false, // Disable text formatting for speed
          disfluencies: false, // Disable disfluency detection
          language_code: "en", // Set language explicitly for speed
          speech_threshold: 0.2, // Lower threshold to detect speech faster
          speed_boost: true, // Enable speed boost for faster processing
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

    // Step 3: Poll for the transcription result with shorter intervals
    let transcriptionResult;
    let attempts = 0;
    const MAX_ATTEMPTS = 20;
    while (attempts < MAX_ATTEMPTS) {
      attempts++;
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

      // Wait for 500ms before polling again (reduced from 1000ms)
      await new Promise((resolve) => setTimeout(resolve, 500));
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

// Update the displayed sentence and reset UI
function updateSentence() {
  if (lessons.length === 0) return; // Ensure lessons are loaded
  const currentLesson = lessons[currentLessonIndex];

  // Update the sentence
  sentenceElement.textContent = currentLesson.sentences[currentSentenceIndex];
  console.log(
    "Updated sentence:",
    currentLesson.sentences[currentSentenceIndex]
  );
  console.log("Current lesson:", currentLesson.lessonNumber);

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

  // Make sure the sentence is visible
  sentenceElement.style.display = "block";
  sentenceElement.style.visibility = "visible";
  sentenceElement.style.opacity = "1";
}

// Load lessons from the JSON file
async function loadLessons() {
  try {
    // Use local data.json file
    const response = await fetch("data.json", {
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
      // Default to first lesson if not found
      currentLessonIndex = 0;
    }

    // Update the UI with the first sentence
    updateSentence();

    // Make sure the sentence is visible after loading
    if (sentenceElement) {
      sentenceElement.style.display = "block";
      sentenceElement.style.visibility = "visible";
      sentenceElement.style.opacity = "1";
      console.log(
        "Sentence element after loading:",
        sentenceElement.textContent
      );
    }
  } catch (error) {
    console.error("Error loading lessons:", error);
    // Show error message to user
    sentenceElement.textContent = "Error loading lessons. Please try again.";
    sentenceElement.style.display = "block";
  }
}

// Get the quiz ID from the URL
function getQuizIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const quizId = urlParams.get("quizId");
  console.log("Quiz ID from URL:", quizId);
  return quizId;
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
