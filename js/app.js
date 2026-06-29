/* App - Main entry point connecting UI, Audio, HandTracker, and GameEngine */

import { AudioManager } from './audio.js';
import { GameEngine } from './game.js';
import { HandTracker } from './tracker.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Core DOM Elements
  const canvas = document.getElementById('gameCanvas');
  const videoElement = document.getElementById('webcam');
  
  const btnStart = document.getElementById('btnStart');
  const btnPlay = document.getElementById('btnPlay');
  const btnRestart = document.getElementById('btnRestart');
  
  // 2. Initialize Managers
  const audio = new AudioManager();
  const game = new GameEngine(canvas, videoElement, audio);
  
  // 3. Initialize Hand Tracker
  // The tracker callback sets the detected hands coordinates in the game engine
  const tracker = new HandTracker(videoElement, (hands) => {
    game.setHandsData(hands);
  });

  // 4. Manage UI Button Interactions
  
  // Start Screen -> Calibration Screen
  btnStart.addEventListener('click', async () => {
    audio.playClick();
    
    // Lazy initialize the audio context inside click listener (required by browsers)
    audio.init();
    
    game.setState('CALIBRATE');
    
    try {
      // Start the webcam and tracker loop
      await tracker.start();
    } catch (err) {
      console.warn("Camera failed or was blocked. Reverting to mouse-only fallback mode:", err);
      
      // Notify the user in the calibration screen and direct them straight to the game
      document.getElementById('calibrationStatus').innerHTML = `
        <span class="highlight-red">⚠️ WEBCAM ACCESS FAILED</span><br>
        No worries! You can still play the game using your mouse as the cursor backup.<br>
        Click below to proceed.
      `;
      
      // Auto-enable button with mouse-only instructions
      btnPlay.disabled = false;
      btnPlay.textContent = 'START PLAYING';
    }
  });

  // Calibration Screen -> Gameplay Screen
  btnPlay.addEventListener('click', () => {
    audio.playClick();
    game.setState('PLAYING');
  });

  // Game Over Screen -> Restart Gameplay
  btnRestart.addEventListener('click', () => {
    audio.playClick();
    game.setState('PLAYING');
  });

  // 5. Dynamic Scale and Responsiveness
  // Scales the entire game-container proportionally using CSS transform to fit smaller screens
  const handleResize = () => {
    const container = document.querySelector('.game-container');
    if (!container) return;
    
    const baseWidth = 960;
    const baseHeight = 720;
    const padding = 20; // 10px margin around edges
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    const scaleX = (windowWidth - padding) / baseWidth;
    const scaleY = (windowHeight - padding) / baseHeight;
    
    // Choose the smaller scaling ratio, clamped to max 1.0 (so it doesn't pixelate on large monitors)
    const scale = Math.min(scaleX, scaleY, 1.0);
    
    container.style.transform = `scale(${scale})`;
    container.style.transformOrigin = 'center center';
  };

  // Run scale calculation immediately and listen for browser resizing
  window.addEventListener('resize', handleResize);
  handleResize();

  // 6. Start the Game Rendering Loops
  // Kicks off the requestAnimationFrame loop immediately. It will update states internally.
  requestAnimationFrame((timestamp) => {
    game.run(timestamp);
  });
});
