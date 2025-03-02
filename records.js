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

// Event listener for the close icon
document.querySelector(".close-icon").addEventListener("click", closeDialog);

// Event listener for the backdrop to close the dialog when clicked
dialogBackdrop.addEventListener("click", closeDialog);

let lessons = []; // This will store the loaded lessons
let currentLessonIndex = 0; // Track the current lesson
let currentSentenceIndex = 0; // Track the current sentence in the lesson
let totalSentencesSpoken = 0; // Track total sentences spoken across all lessons
let totalPronunciationScore = 0; // Track total pronunciation score across all lessons
let SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition; // Check for vendor prefixes
let mediaRecorder;
let audioChunks = [];
let recordedAudioBlob; // Store the recorded audio blob
retryButton.style.display = "none"; // Hide retry button initially

// Declare audioContext globally
let audioContext;

// Function to initialize the AudioContext after a user gesture
function initializeAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Function to update the displayed sentence and reset UI
function updateSentence() {
  if (lessons.length === 0) return; // Ensure lessons are loaded
  const currentLesson = lessons[currentLessonIndex];

  // Update the sentence
  sentenceElement.textContent = currentLesson.sentences[currentSentenceIndex];

  // Reset UI
  recognizedTextDiv.textContent = "";
  pronunciationScoreDiv.textContent = "0%";
  micButton.style.display = "inline-block";
  retryButton.style.display = "none"; // Hide the Retry button
  retryButton.disabled = true;
  missingWordDiv.textContent = ""; // Clear missing word message
  closeDialog(); // Close the dialog container
  updateProgressCircle(0); // Reset progress circle
  nextButton.style.backgroundColor = ""; // Reset button color
}

// Function to normalize text (remove punctuation and convert to lowercase)
function normalizeText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, "");
}

// Function to check if two words are similar (basic fuzzy matching)
function isSimilar(word1, word2) {
  return word1.includes(word2) || word2.includes(word1);
}

// Function to update the progress circle based on the pronunciation score
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

// Function to play sound effects using the Web Audio API
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
  oscillator.type = "sine"; // Type of waveform (sine, square, sawtooth, triangle)

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

// Function to calculate pronunciation score
function calculatePronunciationScore(transcript, expectedSentence) {
  const transcriptWords = normalizeText(transcript).split(/\s+/);
  const sentenceWords = normalizeText(expectedSentence).split(/\s+/);

  let correctWords = 0;
  let highlightedText = "";

  let transcriptIndex = 0;
  let sentenceIndex = 0;

  let missingWord = "";

  // Compare words one by one
  while (
    transcriptIndex < transcriptWords.length &&
    sentenceIndex < sentenceWords.length
  ) {
    if (
      isSimilar(transcriptWords[transcriptIndex], sentenceWords[sentenceIndex])
    ) {
      highlightedText += `<span style="color: green;">${transcriptWords[transcriptIndex]}</span> `;
      correctWords++;
      transcriptIndex++;
      sentenceIndex++;
    } else {
      if (
        isSimilar(
          transcriptWords[transcriptIndex],
          sentenceWords[sentenceIndex + 1]
        )
      ) {
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
    nextButton.style.backgroundColor = "#ff0000"; // Red color for low scores
  } else {
    nextButton.style.backgroundColor = "#0aa989"; // Reset to default color
  }

  return Math.round(pronunciationScore);
}

// Function to speak the sentence using the Web Speech API
function speakSentence() {
  if (lessons.length === 0) return; // Ensure lessons are loaded
  const currentLesson = lessons[currentLessonIndex];
  const sentence = currentLesson.sentences[currentSentenceIndex];
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = "en-US";
  speechSynthesis.speak(utterance);
}

// Function to start audio recording
async function startAudioRecording() {
  audioChunks = [];
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };
  mediaRecorder.onstop = () => {
    recordedAudioBlob = new Blob(audioChunks, { type: "audio/wav" });
    micButton.innerHTML = '<i class="fas fa-microphone"></i>'; // Reset mic button icon
    micButton.style.backgroundColor = ""; // Reset mic button background color
    micButton.disabled = false; // Re-enable the mic button
    retryButton.style.display = "inline-block"; // Show retry button
    retryButton.disabled = false; // Enable retry button
    document.getElementById("recordingIndicator").style.display = "none"; // Hide recording indicator
  };
  mediaRecorder.start();
  micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>'; // Change mic button icon
  micButton.style.color = "#ff0000"; // Change mic button background color to red
  micButton.style.color = "#fff";
  micButton.disabled = true; // Disable the mic button while recording
  document.getElementById("recordingIndicator").style.display = "inline-block"; // Show recording indicator
}

// Function to play the recorded audio
function playRecordedAudio() {
  if (!recordedAudioBlob) {
    alert("No recorded audio available.");
    return;
  }

  const audioURL = URL.createObjectURL(recordedAudioBlob);
  const audio = new Audio(audioURL);
  audio.play();
}

// Add event listeners
listenButton.addEventListener("click", speakSentence);
listen2Button.addEventListener("click", speakSentence);

// Bookmark icon click event listener
bookmarkIcon.addEventListener("click", () => {
  playRecordedAudio(); // Play the recorded audio when the bookmark icon is clicked
});
bookmarkIcon2.addEventListener("click", () => {
  playRecordedAudio(); // Play the recorded audio when the bookmark icon is clicked
});

// Function to load lessons from the GitHub API
async function loadLessons() {
  try {
    const GITHUB_TOKEN = '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'; // Replace with your GitHub PAT
    const url = 'https://api.github.com/repos/zyadafifi/lessons/contents/lessons.json';

    const response = await fetch(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3.raw', // Fetch raw file content
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json(); // Parse the JSON
    lessons = data.lessons;
    console.log("Lessons loaded successfully:", lessons);

    // Get the lesson ID from the URL or another source
    const lessonId = getLessonIdFromURL(); // Implement this function
    currentLessonIndex = lessons.findIndex(lesson => lesson.videoId === lessonId);

    if (currentLessonIndex === -1) {
      console.error("Lesson not found!");
      return;
    }

    updateSentence(); // Update the UI with the first sentence of the selected lesson
  } catch (error) {
    console.error("Error loading lessons:", error);
  }
}

// Function to get the lesson ID from the URL
function getLessonIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("lessonId"); // Example: ?lessonId=3dd9a5d4-a8a1-4cf0-a7e1-8f8d46f7a438
}

// Load lessons when the page loads
loadLessons();

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  micButton.addEventListener("click", () => {
    // Initialize the AudioContext on the first click
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
    console.log("Recognized Transcript:", transcript); // Log the transcript for debugging

    const currentLesson = lessons[currentLessonIndex];
    const pronunciationScore = calculatePronunciationScore(
      transcript,
      currentLesson.sentences[currentSentenceIndex]
    );
    pronunciationScoreDiv.textContent = `${pronunciationScore}%`;
    updateProgressCircle(pronunciationScore); // Update progress circle

    // Update total sentences spoken and overall score
    totalSentencesSpoken++;
    totalPronunciationScore += pronunciationScore;

    // Show the dialog container after processing
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
    // Reset the UI for retry
    recognizedTextDiv.textContent = "";
    pronunciationScoreDiv.textContent = "0%";
    retryButton.style.display = "none";
    retryButton.disabled = true;
    // Stop ongoing recording and recognition
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
    recognition.stop();

    // Restart the recording session and recognition
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

      // Update the modal content with the total sentences spoken and overall score
      sentencesSpokenDiv.textContent = totalSentencesSpoken;
      overallScoreDiv.textContent = `${Math.round(totalPronunciationScore / totalSentencesSpoken)}%`;

      congratulationModal.show(); // Show the congratulation modal
    }
  });

  // Continue button logic (now acts as a close button for the congratulation dialog)
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