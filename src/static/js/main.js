import { MultimodalLiveClient } from "./core/websocket-client.js";
import { AudioStreamer } from "./audio/audio-streamer.js";
import { AudioRecorder } from "./audio/audio-recorder.js";
import { CONFIG } from "./config/config.js";
import { Logger } from "./utils/logger.js";
import { VideoManager } from "./video/video-manager.js";
import { ScreenRecorder } from "./video/screen-recorder.js";
import { languages } from "./language-selector.js";

/**
 * @fileoverview Main entry point for the application.
 * Initializes and manages the UI, audio, video, and WebSocket interactions.
 */

// DOM Elements
const logsContainer = document.getElementById("logs-container");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const micButton = document.getElementById("mic-button");
const micIcon = document.getElementById("mic-icon");
const audioVisualizer = document.getElementById("audio-visualizer");
const connectButton = document.getElementById("connect-button");
const cameraButton = document.getElementById("camera-button");
const cameraIcon = document.getElementById("camera-icon");
const stopVideoButton = document.getElementById("stop-video");
const screenButton = document.getElementById("screen-button");
const screenIcon = document.getElementById("screen-icon");
const screenContainer = document.getElementById("screen-container");
const screenPreview = document.getElementById("screen-preview");
const inputAudioVisualizer = document.getElementById("input-audio-visualizer");
const apiKeyInput = document.getElementById("api-key");
const voiceSelect = document.getElementById("voice-select");
const languageSelect = document.getElementById("language-select");
const fpsSlider = document.getElementById("fps-slider");
const fpsValue = document.getElementById("fps-value");
const resizeWidthSlider = document.getElementById("resize-width-slider");
const resizeWidthValue = document.getElementById("resize-width-value");
const qualitySlider = document.getElementById("quality-slider");
const qualityValue = document.getElementById("quality-value");
const configToggle = document.getElementById("config-toggle");
const configContainer = document.getElementById("config-container");
const systemInstructionInput = document.getElementById("system-instruction");
systemInstructionInput.value = CONFIG.SYSTEM_INSTRUCTION.TEXT;
const applyConfigButton = document.getElementById("apply-config");
const resetConfigButton = document.getElementById("reset-config");
const responseTypeSelect = document.getElementById("response-type-select");
const sampleRateSlider = document.getElementById("sample-rate-slider");
const sampleRateValue = document.getElementById("sample-rate-value");

// Load saved values from localStorage
const savedApiKey = localStorage.getItem("gemini_api_key");
const savedVoice = localStorage.getItem("gemini_voice");
const savedLanguage = localStorage.getItem("gemini_language");
const savedFPS = localStorage.getItem("video_fps");
const savedResizeWidth = localStorage.getItem("video_resize_width");
const savedQuality = localStorage.getItem("video_quality");
const savedSystemInstruction = localStorage.getItem("system_instruction");
const savedSampleRate = localStorage.getItem("sample_rate");

if (savedApiKey) {
	apiKeyInput.value = savedApiKey;
}
if (savedVoice) {
	voiceSelect.value = savedVoice;
}

languages.forEach((lang) => {
	const option = document.createElement("option");
	option.value = lang.code;
	option.textContent = lang.name;
	languageSelect.appendChild(option);
});

if (savedLanguage) {
	languageSelect.value = savedLanguage;
}

if (savedFPS) {
	fpsSlider.value = savedFPS;
	fpsValue.textContent = `${savedFPS} FPS`;
} else {
	fpsValue.textContent = `${fpsSlider.value} FPS`;
}

if (savedResizeWidth) {
	resizeWidthSlider.value = savedResizeWidth;
	resizeWidthValue.textContent = `${savedResizeWidth}px`;
} else {
	resizeWidthValue.textContent = `${resizeWidthSlider.value}px`;
}

if (savedQuality) {
	qualitySlider.value = savedQuality;
	qualityValue.textContent = savedQuality;
} else {
	qualityValue.textContent = qualitySlider.value;
}
if (savedSystemInstruction) {
	systemInstructionInput.value = savedSystemInstruction;
	CONFIG.SYSTEM_INSTRUCTION.TEXT = savedSystemInstruction;
}

if (savedSampleRate) {
	sampleRateSlider.value = savedSampleRate;
	sampleRateValue.textContent = `${savedSampleRate} Hz`;
	CONFIG.AUDIO.OUTPUT_SAMPLE_RATE = parseInt(savedSampleRate);
}

// Handle sample rate slider
sampleRateSlider.addEventListener("input", (e) => {
	const value = e.target.value;
	sampleRateValue.textContent = `${value} Hz`;
	CONFIG.AUDIO.OUTPUT_SAMPLE_RATE = parseInt(value);
	localStorage.setItem("sample_rate", value);

	// Update existing audio streamer if it exists
	if (audioStreamer) {
		audioStreamer.setSampleRate(parseInt(value));
	}
});

// Handle configuration panel toggle
configToggle.addEventListener("click", () => {
	configContainer.classList.toggle("active");
	configToggle.classList.toggle("active");
});

// Handle apply config button with disconnect/reconnect
applyConfigButton.addEventListener("click", async () => {
	const config = buildConfiguration();

	// Save all settings to localStorage
	localStorage.setItem("video_fps", config.fps);
	localStorage.setItem("video_resize_width", config.resizeWidth);
	localStorage.setItem("video_quality", config.quality);
	localStorage.setItem("sample_rate", config.sampleRate);
	localStorage.setItem("gemini_voice", config.voice);
	localStorage.setItem("system_instruction", config.systemInstruction);
	localStorage.setItem("gemini_language", config.language);

	// Update CONFIG object
	CONFIG.AUDIO.OUTPUT_SAMPLE_RATE = config.sampleRate;
	CONFIG.SYSTEM_INSTRUCTION.TEXT = config.systemInstruction;

	// Show applying status
	const originalText = applyConfigButton.textContent;
	applyConfigButton.textContent = "Applying...";
	applyConfigButton.disabled = true;

	try {
		// If connected, disconnect and reconnect to apply changes
		if (isConnected) {
			logMessage("Disconnecting to apply new settings...", "system");

			// Disconnect client
			await client.disconnect();
			isConnected = false;
			connectButton.textContent = "Connect";
			connectButton.classList.remove("connected");

			// Wait a moment before reconnecting
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Reconnect with new settings
			logMessage("Reconnecting with new settings...", "system");
			await connectToWebsocket();
		}

		// Update existing instances with new settings
		if (audioStreamer) {
			audioStreamer.setSampleRate(config.sampleRate);
		}
		if (videoManager) {
			videoManager.setFPS(config.fps);
			videoManager.setResizeWidth(config.resizeWidth);
			videoManager.setQuality(config.quality);
		}
		if (screenRecorder) {
			screenRecorder.setFPS(config.fps);
			screenRecorder.setResizeWidth(config.resizeWidth);
			screenRecorder.setQuality(config.quality);
		}

		logMessage("Settings applied successfully", "system");
	} catch (error) {
		logMessage(`Error applying settings: ${error.message}`, "system");
	} finally {
		// Restore button state
		applyConfigButton.textContent = originalText;
		applyConfigButton.disabled = false;

		// Close config panel
		configContainer.classList.remove("active");
		configToggle.classList.remove("active");
	}
});

// State variables
let isRecording = false;
let audioStreamer = null;
let audioCtx = null;
let isConnected = false;
let audioRecorder = null;
let isVideoActive = false;
let videoManager = null;
let isScreenSharing = false;
let screenRecorder = null;
let isUsingTool = false;

// Multimodal Client
const client = new MultimodalLiveClient();

/**
 * Logs a message to the UI.
 * @param {string} message - The message to log.
 * @param {string} [type='system'] - The type of the message (system, user, ai).
 */
function logMessage(message, type = "system") {
	const logEntry = document.createElement("div");
	logEntry.classList.add("log-entry", type);

	const timestamp = document.createElement("span");
	timestamp.classList.add("timestamp");
	timestamp.textContent = new Date().toLocaleTimeString();
	logEntry.appendChild(timestamp);

	const emoji = document.createElement("span");
	emoji.classList.add("emoji");
	switch (type) {
		case "system":
			emoji.textContent = "⚙️";
			break;
		case "user":
			emoji.textContent = "🫵";
			break;
		case "ai":
			emoji.textContent = "🤖";
			break;
	}
	logEntry.appendChild(emoji);

	const messageText = document.createElement("span");
	messageText.textContent = message;
	logEntry.appendChild(messageText);

	logsContainer.appendChild(logEntry);
	logsContainer.scrollTop = logsContainer.scrollHeight;
}

/**
 * Updates the microphone icon based on the recording state.
 */
function updateMicIcon() {
	micIcon.textContent = isRecording ? "mic_off" : "mic";
	micButton.style.backgroundColor = isRecording ? "#ea4335" : "#4285f4";
}

/**
 * Updates the audio visualizer based on the audio volume.
 * @param {number} volume - The audio volume (0.0 to 1.0).
 * @param {boolean} [isInput=false] - Whether the visualizer is for input audio.
 */
function updateAudioVisualizer(volume, isInput = false) {
	const visualizer = isInput ? inputAudioVisualizer : audioVisualizer;
	const audioBar =
		visualizer.querySelector(".audio-bar") || document.createElement("div");

	if (!visualizer.contains(audioBar)) {
		audioBar.classList.add("audio-bar");
		visualizer.appendChild(audioBar);
	}

	audioBar.style.width = `${volume * 100}%`;
	if (volume > 0) {
		audioBar.classList.add("active");
	} else {
		audioBar.classList.remove("active");
	}
}

/**
 * Initializes the audio context and streamer if not already initialized.
 * @returns {Promise<AudioStreamer>} The audio streamer instance.
 */
async function ensureAudioInitialized() {
	if (!audioCtx) {
		audioCtx = new AudioContext();
	}
	if (!audioStreamer) {
		audioStreamer = new AudioStreamer(
			audioCtx,
			CONFIG.AUDIO.OUTPUT_SAMPLE_RATE
		);
		await audioStreamer.addWorklet(
			"vumeter-out",
			"js/audio/worklets/vol-meter.js",
			(ev) => {
				updateAudioVisualizer(ev.data.volume);
			}
		);
	}
	return audioStreamer;
}

/**
 * Handles the microphone toggle. Starts or stops audio recording.
 * @returns {Promise<void>}
 */
async function handleMicToggle() {
	if (!isRecording) {
		try {
			await ensureAudioInitialized();
			audioRecorder = new AudioRecorder();

			const inputAnalyser = audioCtx.createAnalyser();
			inputAnalyser.fftSize = 256;
			const inputDataArray = new Uint8Array(inputAnalyser.frequencyBinCount);

			await audioRecorder.start((base64Data) => {
				if (isUsingTool) {
					client.sendRealtimeInput([
						{
							mimeType: "audio/pcm;rate=16000",
							data: base64Data,
							interrupt: true, // Model isn't interruptable when using tools, so we do it manually
						},
					]);
				} else {
					client.sendRealtimeInput([
						{
							mimeType: "audio/pcm;rate=16000",
							data: base64Data,
						},
					]);
				}

				inputAnalyser.getByteFrequencyData(inputDataArray);
				const inputVolume = Math.max(...inputDataArray) / 255;
				updateAudioVisualizer(inputVolume, true);
			});

			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const source = audioCtx.createMediaStreamSource(stream);
			source.connect(inputAnalyser);

			await audioStreamer.resume();
			isRecording = true;
			Logger.info("Microphone started");
			logMessage("Microphone started", "system");
			updateMicIcon();
		} catch (error) {
			Logger.error("Microphone error:", error);
			logMessage(`Error: ${error.message}`, "system");
			isRecording = false;
			updateMicIcon();
		}
	} else {
		if (audioRecorder && isRecording) {
			audioRecorder.stop();
		}
		isRecording = false;
		logMessage("Microphone stopped", "system");
		updateMicIcon();
		updateAudioVisualizer(0, true);
	}
}

/**
 * Resumes the audio context if it's suspended.
 * @returns {Promise<void>}
 */
async function resumeAudioContext() {
	if (audioCtx && audioCtx.state === "suspended") {
		await audioCtx.resume();
	}
}

/**
 * Connects to the WebSocket server.
 * @returns {Promise<void>}
 */
async function connectToWebsocket() {
	if (!apiKeyInput.value) {
		logMessage("Please input API Key", "system");
		return;
	}

	// Save values to localStorage
	localStorage.setItem("gemini_api_key", apiKeyInput.value);
	localStorage.setItem("gemini_voice", voiceSelect.value);
	localStorage.setItem("gemini_language", languageSelect.value);
	localStorage.setItem("system_instruction", systemInstructionInput.value);

	const config = {
		model: CONFIG.API.MODEL_NAME,
		generationConfig: {
			responseModalities: responseTypeSelect.value,
			speechConfig: {
				languageCode: languageSelect.value,
				voiceConfig: {
					prebuiltVoiceConfig: {
						voiceName: voiceSelect.value, // You can change voice in the config.js file
					},
				},
			},
		},
		systemInstruction: {
			parts: [
				{
					text: systemInstructionInput.value, // You can change system instruction in the config.js file
				},
			],
		},
	};

	try {
		await client.connect(config, apiKeyInput.value);
		isConnected = true;
		await resumeAudioContext();
		connectButton.textContent = "Disconnect";
		connectButton.classList.add("connected");
		messageInput.disabled = false;
		sendButton.disabled = false;
		micButton.disabled = false;
		cameraButton.disabled = false;
		screenButton.disabled = false;
		logMessage("Connected to Gemini Multimodal Live API", "system");
	} catch (error) {
		const errorMessage = error.message || "Unknown error";
		Logger.error("Connection error:", error);
		logMessage(`Connection error: ${errorMessage}`, "system");
		isConnected = false;
		connectButton.textContent = "Connect";
		connectButton.classList.remove("connected");
		messageInput.disabled = true;
		sendButton.disabled = true;
		micButton.disabled = true;
		cameraButton.disabled = true;
		screenButton.disabled = true;
	}
}

/**
 * Disconnects from the WebSocket server.
 */
function disconnectFromWebsocket() {
	client.disconnect();
	isConnected = false;
	if (audioStreamer) {
		audioStreamer.stop();
		if (audioRecorder) {
			audioRecorder.stop();
			audioRecorder = null;
		}
		isRecording = false;
		updateMicIcon();
	}
	connectButton.textContent = "Connect";
	connectButton.classList.remove("connected");
	messageInput.disabled = true;
	sendButton.disabled = true;
	micButton.disabled = true;
	cameraButton.disabled = true;
	screenButton.disabled = true;
	logMessage("Disconnected from server", "system");

	if (videoManager) {
		stopVideo();
	}

	if (screenRecorder) {
		stopScreenSharing();
	}
}

/**
 * Handles sending a text message.
 */
function handleSendMessage() {
	const message = messageInput.value.trim();
	if (message) {
		logMessage(message, "user");
		client.send({ text: message });
		messageInput.value = "";
	}
}

// Event Listeners
client.on("open", () => {
	logMessage("WebSocket connection opened", "system");
});

client.on("log", (log) => {
	logMessage(`${log.type}: ${JSON.stringify(log.message)}`, "system");
});

client.on("close", (event) => {
	logMessage(`WebSocket connection closed (code ${event.code})`, "system");
});

client.on("audio", async (data) => {
	try {
		await resumeAudioContext();
		const streamer = await ensureAudioInitialized();
		streamer.addPCM16(new Uint8Array(data));
	} catch (error) {
		logMessage(`Error processing audio: ${error.message}`, "system");
	}
});

client.on("content", (data) => {
	if (data.modelTurn) {
		if (data.modelTurn.parts.some((part) => part.functionCall)) {
			isUsingTool = true;
			Logger.info("Model is using a tool");
		} else if (data.modelTurn.parts.some((part) => part.functionResponse)) {
			isUsingTool = false;
			Logger.info("Tool usage completed");
		}

		const text = data.modelTurn.parts.map((part) => part.text).join("");
		if (text) {
			logMessage(text, "ai");
		}
	}
});

client.on("interrupted", () => {
	audioStreamer?.stop();
	isUsingTool = false;
	Logger.info("Model interrupted");
	logMessage("Model interrupted", "system");
});

client.on("setupcomplete", () => {
	logMessage("Setup complete", "system");
});

client.on("turncomplete", () => {
	isUsingTool = false;
	logMessage("Turn complete", "system");
});

client.on("error", (error) => {
	if (error instanceof ApplicationError) {
		Logger.error(`Application error: ${error.message}`, error);
	} else {
		Logger.error("Unexpected error", error);
	}
	logMessage(`Error: ${error.message}`, "system");
});

client.on("message", (message) => {
	if (message.error) {
		Logger.error("Server error:", message.error);
		logMessage(`Server error: ${message.error}`, "system");
	}
});

sendButton.addEventListener("click", handleSendMessage);
messageInput.addEventListener("keypress", (event) => {
	if (event.key === "Enter") {
		handleSendMessage();
	}
});

micButton.addEventListener("click", handleMicToggle);

connectButton.addEventListener("click", () => {
	if (isConnected) {
		disconnectFromWebsocket();
	} else {
		connectToWebsocket();
	}
});

messageInput.disabled = true;
sendButton.disabled = true;
micButton.disabled = true;
connectButton.textContent = "Connect";

/**
 * Handles the video toggle. Starts or stops video streaming.
 * @returns {Promise<void>}
 */
async function handleVideoToggle() {
	Logger.info("Video toggle clicked, current state:", {
		isVideoActive,
		isConnected,
	});

	localStorage.setItem("video_fps", fpsSlider.value);

	if (!isVideoActive) {
		try {
			Logger.info("Attempting to start video");
			if (!videoManager) {
				videoManager = new VideoManager();
			}

			await videoManager.start(
				parseInt(fpsSlider.value),
				parseInt(resizeWidthSlider.value),
				parseFloat(qualitySlider.value),
				(frameData) => {
					if (isConnected) {
						client.sendRealtimeInput([frameData]);
					}
				}
			);

			isVideoActive = true;
			cameraIcon.textContent = "videocam_off";
			cameraButton.classList.add("active");
			Logger.info("Camera started successfully");
			logMessage("Camera started", "system");
		} catch (error) {
			Logger.error("Camera error:", error);
			logMessage(`Error: ${error.message}`, "system");
			isVideoActive = false;
			videoManager = null;
			cameraIcon.textContent = "videocam";
			cameraButton.classList.remove("active");
		}
	} else {
		Logger.info("Stopping video");
		stopVideo();
	}
}

/**
 * Stops the video streaming.
 */
function stopVideo() {
	if (videoManager) {
		videoManager.stop();
		videoManager = null;
	}
	isVideoActive = false;
	cameraIcon.textContent = "videocam";
	cameraButton.classList.remove("active");
	logMessage("Camera stopped", "system");
}

cameraButton.addEventListener("click", handleVideoToggle);
stopVideoButton.addEventListener("click", stopVideo);

cameraButton.disabled = true;

/**
 * Handles the screen share toggle. Starts or stops screen sharing.
 * @returns {Promise<void>}
 */
async function handleScreenShare() {
	if (!isScreenSharing) {
		try {
			screenContainer.style.display = "block";

			screenRecorder = new ScreenRecorder({
				fps: parseInt(fpsSlider.value),
				resizeWidth: parseInt(resizeWidthSlider.value),
				quality: parseFloat(qualitySlider.value),
			});
			await screenRecorder.start(screenPreview, (frameData) => {
				if (isConnected) {
					client.sendRealtimeInput([
						{
							mimeType: "image/jpeg",
							data: frameData,
						},
					]);
				}
			});

			isScreenSharing = true;
			screenIcon.textContent = "stop_screen_share";
			screenButton.classList.add("active");
			Logger.info("Screen sharing started");
			logMessage("Screen sharing started", "system");
		} catch (error) {
			Logger.error("Screen sharing error:", error);
			logMessage(`Error: ${error.message}`, "system");
			isScreenSharing = false;
			screenIcon.textContent = "screen_share";
			screenButton.classList.remove("active");
			screenContainer.style.display = "none";
		}
	} else {
		stopScreenSharing();
	}
}

/**
 * Stops the screen sharing.
 */
function stopScreenSharing() {
	if (screenRecorder) {
		screenRecorder.stop();
		screenRecorder = null;
	}
	isScreenSharing = false;
	screenIcon.textContent = "screen_share";
	screenButton.classList.remove("active");
	screenContainer.style.display = "none";
	logMessage("Screen sharing stopped", "system");
}

screenButton.addEventListener("click", handleScreenShare);
screenButton.disabled = true;

// Handle FPS slider
fpsSlider.addEventListener("input", (e) => {
	const value = e.target.value;
	fpsValue.textContent = `${value} FPS`;
	localStorage.setItem("video_fps", value);

	// Update existing video instances if they exist
	if (videoManager) {
		videoManager.setFPS(parseInt(value));
	}
	if (screenRecorder) {
		screenRecorder.setFPS(parseInt(value));
	}
});

// Handle resize width slider
resizeWidthSlider.addEventListener("input", (e) => {
	const value = e.target.value;
	resizeWidthValue.textContent = `${value}px`;
	localStorage.setItem("video_resize_width", value);

	// Update existing video instances if they exist
	if (videoManager) {
		videoManager.setResizeWidth(parseInt(value));
	}
	if (screenRecorder) {
		screenRecorder.setResizeWidth(parseInt(value));
	}
});

// Handle quality slider
qualitySlider.addEventListener("input", (e) => {
	const value = e.target.value;
	qualityValue.textContent = value;
	localStorage.setItem("video_quality", value);

	// Update existing video instances if they exist
	if (videoManager) {
		videoManager.setQuality(parseFloat(value));
	}
	if (screenRecorder) {
		screenRecorder.setQuality(parseFloat(value));
	}
});

/**
 * Reset all configuration settings to default values
 */
function resetToDefaults() {
	// Default values
	const defaults = {
		fps: 1,
		resizeWidth: 640,
		quality: 0.3,
		sampleRate: 16000,
		voice: "Aoede",
		responseType: "audio",
		systemInstruction: CONFIG.SYSTEM_INSTRUCTION.TEXT,
	};

	// Update UI elements
	fpsSlider.value = defaults.fps;
	fpsValue.textContent = `${defaults.fps} FPS`;

	resizeWidthSlider.value = defaults.resizeWidth;
	resizeWidthValue.textContent = `${defaults.resizeWidth}px`;

	qualitySlider.value = defaults.quality;
	qualityValue.textContent = defaults.quality;

	sampleRateSlider.value = defaults.sampleRate;
	sampleRateValue.textContent = `${defaults.sampleRate} Hz`;

	voiceSelect.value = defaults.voice;
	responseTypeSelect.value = defaults.responseType;
	systemInstructionInput.value = defaults.systemInstruction;

	// Clear localStorage
	localStorage.removeItem("video_fps");
	localStorage.removeItem("video_resize_width");
	localStorage.removeItem("video_quality");
	localStorage.removeItem("sample_rate");
	localStorage.removeItem("gemini_voice");
	localStorage.removeItem("system_instruction");

	// Update CONFIG object
	CONFIG.AUDIO.OUTPUT_SAMPLE_RATE = defaults.sampleRate;
	CONFIG.SYSTEM_INSTRUCTION.TEXT = defaults.systemInstruction;

	// Update existing instances
	if (audioStreamer) {
		audioStreamer.setSampleRate(defaults.sampleRate);
	}
	if (videoManager) {
		videoManager.setFPS(defaults.fps);
		videoManager.setResizeWidth(defaults.resizeWidth);
		videoManager.setQuality(defaults.quality);
	}
	if (screenRecorder) {
		screenRecorder.setFPS(defaults.fps);
		screenRecorder.setResizeWidth(defaults.resizeWidth);
		screenRecorder.setQuality(defaults.quality);
	}

	logMessage("Settings reset to default values", "system");
}

/**
 * Build configuration object from current UI settings
 */
function buildConfiguration() {
	return {
		fps: parseInt(fpsSlider.value),
		resizeWidth: parseInt(resizeWidthSlider.value),
		quality: parseFloat(qualitySlider.value),
		sampleRate: parseInt(sampleRateSlider.value),
		voice: voiceSelect.value,
		responseType: responseTypeSelect.value,
		systemInstruction: systemInstructionInput.value,
		language: languageSelect.value,
	};
}

// Handle reset button
resetConfigButton.addEventListener("click", () => {
	if (
		confirm("Are you sure you want to reset all settings to default values?")
	) {
		resetToDefaults();
	}
});
