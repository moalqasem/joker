/* GameEngine - Manages loops, states, levels, collisions, and drawing */

import { Hole, Clown, NormalClown, FastClown, BombClown, GoldenClown, PowerUpItem, Particle } from './entities.js';

export class GameEngine {
  constructor(canvas, videoElement, audioManager) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.videoElement = videoElement;
    this.audio = audioManager;

    // Game state: 'START', 'CALIBRATE', 'PLAYING', 'GAMEOVER'
    this.state = 'START';
    
    // Core parameters
    this.score = 0;
    this.health = 100;
    this.maxTime = 60; // 60 seconds round
    this.timeRemaining = this.maxTime;
    this.level = 1;
    this.clownsHit = 0;
    this.highScore = parseInt(localStorage.getItem('whac_clown_high_score')) || 0;

    // Game elements
    this.holes = [];
    this.particles = [];
    this.hands = []; // Tracks current hands data from tracker
    
    // Spawning controls
    this.spawnTimer = 0;
    this.spawnInterval = 1500; // ms between spawn checks
    this.lastTime = 0;

    // Power-up states
    this.freezeDuration = 4.0; // seconds
    this.freezeTimeRemaining = 0;
    this.doublePointsDuration = 6.0; // seconds
    this.doublePointsTimeRemaining = 0;

    // Screenshake effect
    this.shakeDuration = 0;
    this.shakeIntensity = 0;

    // Mouse fallback coordinates
    this.mouseCoords = null;
    this.useMouseFallback = true; // Always listen to mouse as a backup/test cursor

    // Calibration details
    this.calibrationProgress = 0; // 0 to 100%
    this.calibrationStartTime = null;

    this.initHoles();
    this.setupMouseListeners();
  }

  // Setup holes in a beautiful circular arch covering the upper body
  initHoles() {
    this.holes = [
      new Hole(0, 180, 240, 60), // Top Left
      new Hole(1, 480, 180, 60), // Top Center
      new Hole(2, 780, 240, 60), // Top Right
      new Hole(3, 220, 520, 60), // Bottom Left
      new Hole(4, 480, 560, 60), // Bottom Center
      new Hole(5, 740, 520, 60)  // Bottom Right
    ];
  }

  // Track mouse movements to act as a fallback pointer (Right hand)
  setupMouseListeners() {
    const getCanvasMousePos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      // Scale mouse coordinates relative to canvas drawing dimensions (960x720)
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    this.canvas.addEventListener('mousemove', (e) => {
      this.mouseCoords = getCanvasMousePos(e);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mouseCoords = null;
    });

    // Touch events for mobile/tablet test
    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.mouseCoords = getCanvasMousePos(e.touches[0]);
      }
    });

    this.canvas.addEventListener('touchend', () => {
      this.mouseCoords = null;
    });
  }

  // Set hand tracking data received from App -> Tracker
  setHandsData(handsData) {
    const alpha = 0.55; // 55% current frame, 45% history. Balances zero-latency with noise filtering.
    
    const smoothedHands = handsData.map(newHand => {
      // Find matching hand by label from the previous frame's hands data
      const oldHand = this.hands.find(h => h.label === newHand.label);
      if (oldHand) {
        // Smooth indexTip
        newHand.indexTip.x = oldHand.indexTip.x * (1 - alpha) + newHand.indexTip.x * alpha;
        newHand.indexTip.y = oldHand.indexTip.y * (1 - alpha) + newHand.indexTip.y * alpha;
        
        // Smooth palmCenter
        newHand.palmCenter.x = oldHand.palmCenter.x * (1 - alpha) + newHand.palmCenter.x * alpha;
        newHand.palmCenter.y = oldHand.palmCenter.y * (1 - alpha) + newHand.palmCenter.y * alpha;

        // Smooth wrist
        newHand.wrist.x = oldHand.wrist.x * (1 - alpha) + newHand.wrist.x * alpha;
        newHand.wrist.y = oldHand.wrist.y * (1 - alpha) + newHand.wrist.y * alpha;

        // Smooth raw landmarks for skeleton drawing
        if (newHand.rawLandmarks && oldHand.rawLandmarks && newHand.rawLandmarks.length === oldHand.rawLandmarks.length) {
          for (let j = 0; j < newHand.rawLandmarks.length; j++) {
            newHand.rawLandmarks[j].x = oldHand.rawLandmarks[j].x * (1 - alpha) + newHand.rawLandmarks[j].x * alpha;
            newHand.rawLandmarks[j].y = oldHand.rawLandmarks[j].y * (1 - alpha) + newHand.rawLandmarks[j].y * alpha;
          }
        }
      }
      return newHand;
    });

    this.hands = smoothedHands;
  }

  // Set game state
  setState(newState) {
    this.state = newState;
    
    // Hide all overlay divs, then show the current active one
    document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
    document.getElementById('hudOverlay').classList.remove('active');

    if (newState === 'START') {
      document.getElementById('startScreen').classList.add('active');
      document.getElementById('startHighScore').textContent = this.highScore;
    } 
    else if (newState === 'CALIBRATE') {
      document.getElementById('calibrationScreen').classList.add('active');
      this.calibrationProgress = 0;
      this.calibrationStartTime = null;
      document.getElementById('btnPlay').disabled = true;
      document.getElementById('btnPlay').textContent = 'WAITING FOR TRACKING...';
    } 
    else if (newState === 'PLAYING') {
      document.getElementById('hudOverlay').classList.add('active');
      this.resetGame();
    } 
    else if (newState === 'GAMEOVER') {
      document.getElementById('gameOverScreen').classList.add('active');
      document.getElementById('finalScore').textContent = this.score;
      document.getElementById('finalLevel').textContent = this.level;
      document.getElementById('finalClownsHit').textContent = this.clownsHit;
      
      // Save high score
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('whac_clown_high_score', this.highScore);
      }
      document.getElementById('finalHighScore').textContent = this.highScore;
      
      // Display cause of game over
      if (this.timeRemaining <= 0) {
        document.getElementById('gameOverReason').textContent = "Time's Up!";
      } else {
        document.getElementById('gameOverReason').textContent = "Out of Health!";
      }

      this.audio.playGameOver();
    }
  }

  // Reset variables to start a fresh game
  resetGame() {
    this.score = 0;
    this.health = 100;
    this.timeRemaining = this.maxTime;
    this.level = 1;
    this.clownsHit = 0;
    this.particles = [];
    
    this.freezeTimeRemaining = 0;
    this.doublePointsTimeRemaining = 0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;

    // Clear all holes
    this.holes.forEach(hole => {
      hole.occupant = null;
    });

    this.spawnTimer = 0;
    this.lastTime = performance.now();
    this.updateHUD();
  }

  // Update HTML elements with current HUD status
  updateHUD() {
    document.getElementById('hudScore').textContent = String(this.score).padStart(4, '0');
    document.getElementById('hudTimer').textContent = Math.ceil(this.timeRemaining);
    document.getElementById('hudHighScore').textContent = String(this.highScore).padStart(4, '0');
    document.getElementById('hudLevel').textContent = this.level;
    
    // Health bar fill percentage
    const healthBar = document.getElementById('healthBarFill');
    healthBar.style.width = `${this.health}%`;
    document.getElementById('hudHealthText').textContent = `${Math.ceil(this.health)}%`;

    // Health color gradient shift based on value
    if (this.health > 50) {
      healthBar.style.background = 'linear-gradient(90deg, #00ff87 0%, #60efff 100%)';
    } else if (this.health > 25) {
      healthBar.style.background = 'linear-gradient(90deg, #f7d070 0%, #f39c12 100%)';
    } else {
      healthBar.style.background = 'linear-gradient(90deg, #ff6b6b 0%, #ff3b30 100%)';
    }

    // Time fill
    const timerBar = document.getElementById('timerBarFill');
    const fillPercent = (this.timeRemaining / this.maxTime) * 100;
    timerBar.style.width = `${fillPercent}%`;

    // Timer warnings
    if (this.timeRemaining < 15) {
      timerBar.classList.add('warning');
    } else {
      timerBar.classList.remove('warning');
    }

    // Multiplier badge
    const multBadge = document.getElementById('multiplierBadge');
    if (this.doublePointsTimeRemaining > 0) {
      multBadge.classList.remove('hide');
    } else {
      multBadge.classList.add('hide');
    }
  }

  // Trigger screen shake
  shakeScreen(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  // Core Game Loop
  run(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); // clamp dt to avoid giant leaps
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();

    // Repeat loop
    requestAnimationFrame((t) => this.run(t));
  }

  // Update Game Logic
  update(dt) {
    if (this.state === 'START') return;

    if (this.state === 'CALIBRATE') {
      this.updateCalibration(dt);
      return;
    }

    if (this.state === 'GAMEOVER') {
      // Still update particles and canvas in the background for visual continuity
      this.updateParticles(dt);
      return;
    }

    if (this.state === 'PLAYING') {
      // 1. Decrement timer
      if (this.freezeTimeRemaining <= 0) {
        this.timeRemaining -= dt;
      }
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.setState('GAMEOVER');
        return;
      }

      // 2. Decrement power-up timers
      if (this.freezeTimeRemaining > 0) {
        this.freezeTimeRemaining -= dt;
        const indicator = document.getElementById('freezeIndicator');
        const timerText = document.getElementById('freezeTimer');
        if (this.freezeTimeRemaining <= 0) {
          indicator.classList.add('hide');
        } else {
          indicator.classList.remove('hide');
          timerText.textContent = `${this.freezeTimeRemaining.toFixed(1)}s`;
        }
      }

      if (this.doublePointsTimeRemaining > 0) {
        this.doublePointsTimeRemaining -= dt;
        const indicator = document.getElementById('doubleIndicator');
        const timerText = document.getElementById('doubleTimer');
        if (this.doublePointsTimeRemaining <= 0) {
          indicator.classList.add('hide');
        } else {
          indicator.classList.remove('hide');
          timerText.textContent = `${this.doublePointsTimeRemaining.toFixed(1)}s`;
        }
      }

      // 3. Screen shake decay
      if (this.shakeDuration > 0) {
        this.shakeDuration -= dt;
      }

      // 4. Update Level difficulty scaling based on time remaining
      this.updateDifficulty();

      // 5. Spawn new items/clowns
      this.updateSpawning(dt);

      // 6. Update all active occupants in holes
      const isFrozen = this.freezeTimeRemaining > 0;
      this.holes.forEach(hole => {
        if (hole.occupant) {
          const occupantRef = hole.occupant;
          const res = occupantRef.update(dt, isFrozen);
          
          // If clown escaped (retreat completed without hit)
          if (res === 'miss') {
            if (occupantRef.type !== 'bomb') {
              // Deduct health
              this.health += occupantRef.healthChange;
              if (this.health <= 0) {
                this.health = 0;
                this.setState('GAMEOVER');
              }
              // Play escaping clown laugh
              this.audio.playLaugh();
              this.createFloatingText(hole.x, hole.y - 30, 'MISSED!', '#ff3b30');
            }
          }
        }
      });

      // 7. Update hands trails and collisions
      this.updateHandsTrails();
      this.checkCollisions();

      // 8. Update active particles
      this.updateParticles(dt);

      // 9. Synchronize HUD
      this.updateHUD();
    }
  }

  // Calibration checks if hands are in viewport
  updateCalibration(dt) {
    const handsDetected = this.hands.length > 0;
    
    if (handsDetected) {
      if (!this.calibrationStartTime) {
        this.calibrationStartTime = performance.now();
      }
      const elapsed = (performance.now() - this.calibrationStartTime) / 1000;
      this.calibrationProgress = Math.min(100, Math.floor((elapsed / 2.0) * 100)); // 2 seconds of tracking required
      
      const playBtn = document.getElementById('btnPlay');
      if (this.calibrationProgress >= 100) {
        playBtn.disabled = false;
        playBtn.textContent = 'ENTER ARCADE';
        document.getElementById('calibrationStatus').textContent = 'CALIBRATION COMPLETE! Stand back and click below.';
      } else {
        document.getElementById('calibrationStatus').textContent = `Tracking hands... hold steady (${this.calibrationProgress}%)`;
      }
    } else {
      this.calibrationStartTime = null;
      this.calibrationProgress = Math.max(0, this.calibrationProgress - dt * 50); // decay quickly if lost
      document.getElementById('btnPlay').disabled = true;
      document.getElementById('btnPlay').textContent = 'WAITING FOR TRACKING...';
      document.getElementById('calibrationStatus').textContent = 'Please stand in front of the camera and raise your hands.';
    }
  }

  updateDifficulty() {
    // 60-45s: Level 1
    // 45-30s: Level 2
    // 30-15s: Level 3
    // 15-0s: Level 4
    const oldLevel = this.level;
    
    if (this.timeRemaining > 45) {
      this.level = 1;
      this.spawnInterval = 1600;
    } else if (this.timeRemaining > 30) {
      this.level = 2;
      this.spawnInterval = 1200;
    } else if (this.timeRemaining > 15) {
      this.level = 3;
      this.spawnInterval = 850;
    } else {
      this.level = 4;
      this.spawnInterval = 650;
    }

    if (this.level !== oldLevel) {
      this.shakeScreen(6, 0.4);
      this.createFloatingText(480, 360, `LEVEL ${this.level}!`, '#00f0ff');
      this.audio.playWarning();
    }
  }

  // Handle spawn timers
  updateSpawning(dt) {
    this.spawnTimer += dt * 1000;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      
      // Determine how many items are currently active
      const activeOccupants = this.holes.filter(h => h.occupant && h.occupant.state !== 'hiding').length;
      
      // Max simultaneous occupants depending on level
      let maxOccupants = 1;
      if (this.level === 2) maxOccupants = 2;
      if (this.level >= 3) maxOccupants = 3;

      if (activeOccupants < maxOccupants) {
        // Pick a free hole
        const freeHoles = this.holes.filter(h => h.occupant === null);
        if (freeHoles.length > 0) {
          const targetHole = freeHoles[Math.floor(Math.random() * freeHoles.length)];
          this.spawnSomething(targetHole);
        }
      }
    }
  }

  // Spawn a Clown or Power-up based on probabilities and Level
  spawnSomething(hole) {
    const roll = Math.random();
    
    // Levels adjust spawning logic
    if (this.level === 1) {
      // 100% normal clowns
      hole.occupant = new NormalClown(hole, this.level);
    } 
    
    else if (this.level === 2) {
      // 80% normal, 15% fast, 5% freeze powerup
      if (roll < 0.80) {
        hole.occupant = new NormalClown(hole, this.level);
      } else if (roll < 0.95) {
        hole.occupant = new FastClown(hole, this.level);
      } else {
        hole.occupant = new PowerUpItem(hole, 'freeze');
      }
    } 
    
    else if (this.level === 3) {
      // 60% normal, 20% fast, 8% gold, 7% freeze/double powerup, 5% bomb
      if (roll < 0.60) {
        hole.occupant = new NormalClown(hole, this.level);
      } else if (roll < 0.80) {
        hole.occupant = new FastClown(hole, this.level);
      } else if (roll < 0.88) {
        hole.occupant = new GoldenClown(hole, this.level);
      } else if (roll < 0.95) {
        const type = Math.random() < 0.5 ? 'freeze' : 'double';
        hole.occupant = new PowerUpItem(hole, type);
      } else {
        hole.occupant = new BombClown(hole, this.level);
      }
      
      // Warning sound for multiple spawns
      const activeOccupants = this.holes.filter(h => h.occupant && h.occupant.state !== 'hiding').length;
      if (activeOccupants >= 2) {
        this.audio.playWarning();
      }
    } 
    
    else { // Level 4 (Chaos)
      // 40% normal, 25% fast, 10% gold, 10% bomb, 15% power-up
      if (roll < 0.40) {
        hole.occupant = new NormalClown(hole, this.level);
      } else if (roll < 0.65) {
        hole.occupant = new FastClown(hole, this.level);
      } else if (roll < 0.75) {
        hole.occupant = new GoldenClown(hole, this.level);
      } else if (roll < 0.85) {
        hole.occupant = new BombClown(hole, this.level);
      } else {
        const type = Math.random() < 0.5 ? 'freeze' : 'double';
        hole.occupant = new PowerUpItem(hole, type);
      }

      this.audio.playWarning();
    }

    hole.occupant.spawn();
  }

  // Emit light particle trails from index fingers
  updateHandsTrails() {
    // MediaPipe Hands
    this.hands.forEach(hand => {
      const tip = hand.indexTip;
      const x = tip.x * this.canvas.width;
      const y = tip.y * this.canvas.height;
      const color = hand.label === 'Left' ? '#00f0ff' : '#ff007f';
      
      // Spawn trail particles at coordinates
      if (Math.random() < 0.4) {
        const p = new Particle(x, y, color, 'spark');
        p.vx = (Math.random() - 0.5) * 2;
        p.vy = (Math.random() - 0.5) * 2;
        p.decay = 0.05;
        this.particles.push(p);
      }
    });

    // Mouse fallback trail
    if (this.mouseCoords) {
      const x = this.mouseCoords.x;
      const y = this.mouseCoords.y;
      if (Math.random() < 0.4) {
        const p = new Particle(x, y, '#ffd700', 'spark'); // Gold trail for mouse
        p.vx = (Math.random() - 0.5) * 2;
        p.vy = (Math.random() - 0.5) * 2;
        p.decay = 0.05;
        this.particles.push(p);
      }
    }
  }

  // Update particles positions and filters dead ones
  updateParticles(dt) {
    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => p.life > 0);
  }

  // Create floating numbers or status words on canvas
  createFloatingText(x, y, text, color) {
    this.particles.push(new Particle(x, y, color, 'text', text));
  }

  // Check collision between hands/mouse and active targets
  checkCollisions() {
    // 1. Gather all active cursors (hands tips, palm centers, and mouse)
    const cursors = [];
    
    this.hands.forEach(hand => {
      // Check index finger tip
      cursors.push({
        x: hand.indexTip.x * this.canvas.width,
        y: hand.indexTip.y * this.canvas.height,
        label: hand.label
      });
      // Check palm center (allows hitting with palm!)
      cursors.push({
        x: hand.palmCenter.x * this.canvas.width,
        y: hand.palmCenter.y * this.canvas.height,
        label: hand.label
      });
    });

    if (this.mouseCoords) {
      cursors.push({
        x: this.mouseCoords.x,
        y: this.mouseCoords.y,
        label: 'Mouse'
      });
    }

    // 2. Perform distance-based checking against occupants in holes
    cursors.forEach(cursor => {
      this.holes.forEach(hole => {
        const item = hole.occupant;
        
        // Target must be active and not hit
        if (item && (item.state === 'active' || item.state === 'popping')) {
          
          // Calculate center of item
          // Approximate actual render center of the item (clown face is about hole.y - 45 when scaled = 1)
          const itemY = hole.y + hole.radius + 15 - (hole.radius + 60) * item.scale;
          
          const dx = cursor.x - hole.x;
          const dy = cursor.y - itemY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          // Collision distance threshold (clown radius is roughly 45px. Increase hit box to hole.radius + 15 = 75px for ease)
          const hitRadius = hole.radius + 15;
          
          if (dist < hitRadius) {
            this.handleHit(hole, item);
          }
        }
      });
    });
  }

  // Execute results when a clown or power-up is hit
  handleHit(hole, item) {
    const isDouble = this.doublePointsTimeRemaining > 0;
    
    // Hit a Clown
    if (item instanceof Clown) {
      const pointsBase = item.hit(); // sets state to 'hit' and returns points
      
      if (item.type === 'bomb') {
        // Explode bomb clown!
        this.shakeScreen(15, 0.5);
        this.audio.playExplosion();
        
        this.score = Math.max(0, this.score + pointsBase); // deduct points
        this.health = Math.max(0, this.health + item.healthChange); // deduct health
        
        this.createFloatingText(hole.x, hole.y - 50, 'BOMB! -150', '#ff3b30');
        this.createExplosionParticles(hole.x, hole.y - 40, '#ff3b30', 30);
        
        if (this.health <= 0) {
          this.setState('GAMEOVER');
        }
      } 
      
      else {
        // Regular hit
        this.clownsHit++;
        this.audio.playHit();
        
        const earnedPoints = isDouble ? pointsBase * 2 : pointsBase;
        this.score += earnedPoints;
        
        const scoreColor = item.type === 'gold' ? '#ffd700' : (isDouble ? '#ffd700' : '#ff007f');
        const textVal = isDouble ? `x2 +${earnedPoints}` : `+${earnedPoints}`;
        
        this.createFloatingText(hole.x, hole.y - 50, textVal, scoreColor);
        
        // Spawn sparks
        this.createExplosionParticles(hole.x, hole.y - 40, item.color, 25);
        
        // Golden clown drops a random powerup immediately in another hole!
        if (item.type === 'gold') {
          this.spawnPowerUpElsewhere();
        }
      }
    } 
    
    // Hit a Power-up bubble
    else if (item instanceof PowerUpItem) {
      const type = item.hit(); // sets state to 'hit' and returns type
      
      if (type === 'freeze') {
        this.audio.playFreeze();
        this.freezeTimeRemaining = this.freezeDuration;
        this.createFloatingText(hole.x, hole.y - 50, 'FREEZE!', '#00f0ff');
        this.createExplosionParticles(hole.x, hole.y - 40, '#00f0ff', 35);
        this.shakeScreen(5, 0.3);
      } 
      else if (type === 'double') {
        this.audio.playDouble();
        this.doublePointsTimeRemaining = this.doublePointsDuration;
        this.createFloatingText(hole.x, hole.y - 50, '2X POINTS!', '#ffd700');
        this.createExplosionParticles(hole.x, hole.y - 40, '#ffd700', 35);
      }
    }
  }

  // Force spawn powerup in a free hole
  spawnPowerUpElsewhere() {
    const freeHoles = this.holes.filter(h => h.occupant === null);
    if (freeHoles.length > 0) {
      const targetHole = freeHoles[Math.floor(Math.random() * freeHoles.length)];
      const type = Math.random() < 0.5 ? 'freeze' : 'double';
      targetHole.occupant = new PowerUpItem(targetHole, type);
      targetHole.occupant.spawn();
    }
  }

  // Create particle burst on hit
  createExplosionParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const p = new Particle(x, y, color, Math.random() < 0.6 ? 'confetti' : 'spark');
      this.particles.push(p);
    }
  }

  // Main Canvas Rendering Method
  draw() {
    // Apply screen shake translate offset
    let dx = 0;
    let dy = 0;
    if (this.shakeDuration > 0) {
      dx = (Math.random() - 0.5) * this.shakeIntensity;
      dy = (Math.random() - 0.5) * this.shakeIntensity;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.translate(dx, dy);

    // 1. Draw webcam feed in the background (mirrored and semi-transparent)
    if (this.state === 'PLAYING' || this.state === 'CALIBRATE') {
      this.ctx.save();
      // Mirror draw
      this.ctx.translate(this.canvas.width, 0);
      this.ctx.scale(-1, 1);
      
      // In calibration mode, video is brighter so player can align themselves
      this.ctx.globalAlpha = this.state === 'CALIBRATE' ? 0.75 : 0.40;
      this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();

      // Cyber punk overlay tint
      this.ctx.fillStyle = this.state === 'CALIBRATE' ? 'rgba(5, 5, 15, 0.3)' : 'rgba(5, 5, 12, 0.45)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      // Dark fallback screen background
      this.ctx.fillStyle = '#05050c';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // 2. Draw target holes (only in PLAYING state)
    if (this.state === 'PLAYING') {
      this.holes.forEach(hole => hole.draw(this.ctx));
      
      // 3. Draw active clowns / powerups (inside holes)
      this.holes.forEach(hole => {
        if (hole.occupant) {
          hole.occupant.draw(this.ctx);
        }
      });
    }

    // 4. Draw particle sparks / confetti / floating points
    this.particles.forEach(p => p.draw(this.ctx));

    // 5. Draw active hand skeletons and glowing energy cursors
    if (this.state === 'PLAYING' || this.state === 'CALIBRATE') {
      this.drawHands();
      this.drawMouseCursor();
    }

    // 6. Draw calibration guides (only in CALIBRATE state)
    if (this.state === 'CALIBRATE') {
      this.drawCalibrationGuides();
    }

    // 7. Draw Freeze screen overlay
    if (this.state === 'PLAYING' && this.freezeTimeRemaining > 0) {
      this.drawFreezeOverlay();
    }

    this.ctx.restore();
  }

  // Draw glowing lines between joints and big neon rings at index fingers
  drawHands() {
    this.hands.forEach(hand => {
      const color = hand.label === 'Left' ? '#00f0ff' : '#ff007f';
      const points = hand.rawLandmarks;

      this.ctx.save();
      
      // Draw hand skeleton lines
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = 2.5;
      
      // Helper function to draw joint connections
      const drawLine = (p1Idx, p2Idx) => {
        if (points[p1Idx] && points[p2Idx]) {
          this.ctx.beginPath();
          this.ctx.moveTo(points[p1Idx].x * this.canvas.width, points[p1Idx].y * this.canvas.height);
          this.ctx.lineTo(points[p2Idx].x * this.canvas.width, points[p2Idx].y * this.canvas.height);
          this.ctx.stroke();
        }
      };

      // Connect fingers to wrist
      drawLine(0, 1); drawLine(1, 2); drawLine(2, 3); drawLine(3, 4); // Thumb
      drawLine(0, 5); drawLine(5, 6); drawLine(6, 7); drawLine(7, 8); // Index
      drawLine(0, 9); drawLine(9, 10); drawLine(10, 11); drawLine(11, 12); // Middle
      drawLine(0, 13); drawLine(13, 14); drawLine(14, 15); drawLine(15, 16); // Ring
      drawLine(0, 17); drawLine(17, 18); drawLine(18, 19); drawLine(19, 20); // Pinky
      // Connect MCP joints
      drawLine(5, 9); drawLine(9, 13); drawLine(13, 17);

      // Draw all joints as glowing dots
      points.forEach(lm => {
        this.ctx.beginPath();
        this.ctx.arc(lm.x * this.canvas.width, lm.y * this.canvas.height, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
      });

      // Draw glowing halo around index finger tip cursor
      const tip = hand.indexTip;
      const tx = tip.x * this.canvas.width;
      const ty = tip.y * this.canvas.height;

      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = color;
      
      // Outer ring
      this.ctx.beginPath();
      this.ctx.arc(tx, ty, 18, 0, Math.PI * 2);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 3;
      this.ctx.stroke();

      // Inner solid point
      this.ctx.beginPath();
      this.ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fill();
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      this.ctx.restore();
    });
  }

  // Draw glowing cursor for the mouse testing fallback
  drawMouseCursor() {
    if (!this.mouseCoords) return;
    
    const x = this.mouseCoords.x;
    const y = this.mouseCoords.y;
    const color = '#ffd700'; // Gold glow for fallback cursor

    this.ctx.save();
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = color;

    // Crosshair target
    this.ctx.beginPath();
    this.ctx.arc(x, y, 16, 0, Math.PI * 2);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2.5;
    this.ctx.stroke();

    // Horizontal crosshair line
    this.ctx.beginPath();
    this.ctx.moveTo(x - 22, y);
    this.ctx.lineTo(x + 22, y);
    this.ctx.moveTo(x, y - 22);
    this.ctx.lineTo(x, y + 22);
    this.ctx.stroke();

    // Center dot
    this.ctx.beginPath();
    this.ctx.arc(x, y, 4, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();

    this.ctx.restore();
  }

  // Draw frosted glass overlay when freeze powerup is active
  drawFreezeOverlay() {
    this.ctx.save();
    
    // Ice border color gradient
    const borderWidth = 25;
    const grad = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
    grad.addColorStop(0.5, 'rgba(0, 122, 255, 0.15)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0.45)');
    
    this.ctx.strokeStyle = grad;
    this.ctx.lineWidth = borderWidth;
    this.ctx.strokeRect(borderWidth/2, borderWidth/2, this.canvas.width - borderWidth, this.canvas.height - borderWidth);

    // Blue frosted tint across the canvas
    this.ctx.fillStyle = 'rgba(0, 122, 255, 0.08)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.restore();
  }

  // Draw silhouette guide overlay for calibration alignment
  drawCalibrationGuides() {
    this.ctx.save();
    
    // Draw guide box to help player stand center
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
    this.ctx.lineWidth = 4;
    this.ctx.setLineDash([15, 10]);
    
    // Oval shape in center for body outline
    this.ctx.beginPath();
    this.ctx.ellipse(480, 420, 220, 280, 0, 0, Math.PI * 2);
    this.ctx.stroke();

    // Guide text
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.font = "bold 20px 'Orbitron', sans-serif";
    this.ctx.textAlign = 'center';
    this.ctx.fillText("ALIGN YOUR BODY WITHIN THE OVAL", 480, 100);

    this.ctx.restore();
  }
}
