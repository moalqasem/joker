/* HandTracker - Wraps MediaPipe Hands and webcam access */

export class HandTracker {
  constructor(videoElement, onResultsCallback) {
    this.videoElement = videoElement;
    this.onResultsCallback = onResultsCallback;
    this.hands = null;
    this.camera = null;
    this.isInitialized = false;
    this.isTracking = false;
    this.isProcessingFrame = false; // Lock flag to prevent frame processing congestion
  }

  // Load and initialize the MediaPipe model
  async init() {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      try {
        // Verify MediaPipe globals exist
        if (typeof window.Hands === 'undefined' || typeof window.Camera === 'undefined') {
          throw new Error("MediaPipe Hands or Camera library is not loaded from CDN.");
        }

        // Initialize Hands model
        this.hands = new window.Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          }
        });

        // Set optimal options for real-time web execution
        this.hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 0, // 0 = Lite (fastest), 1 = Full (balanced), 2 = Heavy
          minDetectionConfidence: 0.45,
          minTrackingConfidence: 0.45
        });

        // Register tracking callback
        this.hands.onResults((results) => {
          const parsedHands = this.parseResults(results);
          this.onResultsCallback(parsedHands);
        });

        // Setup camera helper
        this.camera = new window.Camera(this.videoElement, {
          onFrame: async () => {
            if (this.isTracking && !this.isProcessingFrame) {
              this.isProcessingFrame = true;
              try {
                await this.hands.send({ image: this.videoElement });
              } catch (err) {
                console.error("MediaPipe frame send error:", err);
              } finally {
                this.isProcessingFrame = false;
              }
            }
          },
          width: 640,
          height: 480
        });

        this.isInitialized = true;
        resolve();
      } catch (err) {
        console.error("Failed to initialize HandTracker:", err);
        reject(err);
      }
    });
  }

  // Start the webcam feed and the processing loop
  async start() {
    await this.init();
    if (this.isTracking) return;

    return new Promise((resolve, reject) => {
      this.isTracking = true;
      this.camera.start()
        .then(() => {
          resolve();
        })
        .catch(err => {
          this.isTracking = false;
          console.error("Failed to start camera:", err);
          reject(err);
        });
    });
  }

  // Stop the camera feed
  stop() {
    this.isTracking = false;
    if (this.camera) {
      // MediaPipe Camera doesn't have a clean stop() in some versions,
      // but stopping track execution is handled by checking this.isTracking.
      // Additionally, we stop the media stream tracks manually.
      const stream = this.videoElement.srcObject;
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        this.videoElement.srcObject = null;
      }
    }
  }

  // Parse MediaPipe output coordinates and map them cleanly for the canvas
  parseResults(results) {
    const handsData = [];

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const handedness = results.multiHandedness[i];
        
        // Hand type: 'Left' or 'Right'. 
        // Note: due to mirroring, MediaPipe detects the physical left hand 
        // which appears on the right side of the video if not mirrored.
        // We will output the raw labels and handle screen mirroring.
        const label = handedness.label; // "Left" or "Right"
        
        // Extract key coordinates: Index finger tip (8), Wrist (0), Palm Center (average of 0, 5, 9, 13, 17)
        const wrist = landmarks[0];
        const indexTip = landmarks[8];
        const mcpIndex = landmarks[5];
        const mcpPinky = landmarks[17];
        
        // Mirror X coordinates because we will draw a mirrored webcam feed so it acts like a mirror
        // (moving physical left hand to left direction moves cursor left)
        const processX = (rawX) => 1.0 - rawX;
        
        // Calculate palm center
        const palmCenter = {
          x: processX((wrist.x + mcpIndex.x + mcpPinky.x) / 3),
          y: (wrist.y + mcpIndex.y + mcpPinky.y) / 3
        };

        // Create normalized mirrored landmarks
        const mirroredLandmarks = landmarks.map(lm => ({
          x: processX(lm.x),
          y: lm.y,
          z: lm.z
        }));

        handsData.push({
          label: label, // "Left" or "Right"
          wrist: { x: processX(wrist.x), y: wrist.y },
          indexTip: { x: processX(indexTip.x), y: indexTip.y },
          palmCenter: palmCenter,
          rawLandmarks: mirroredLandmarks // Mirrored 21 coordinates
        });
      }
    }

    return handsData;
  }
}
