/* Game entities: Hole, Clown (and subclasses), PowerUpItem, and Particle */

// 1. Hole Class - Where clowns emerge
export class Hole {
  constructor(id, x, y, radius = 65) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.occupant = null; // Can hold a Clown or a PowerUpItem
  }

  draw(ctx) {
    // Draw 3D recessed hole with neon cyan ring
    ctx.save();
    
    // Outer glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.4)';
    
    // Hole rim
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Hole interior (recessed gradient)
    ctx.shadowBlur = 0; // remove shadow for inside
    const grad = ctx.createRadialGradient(
      this.x, this.y, this.radius * 0.4,
      this.x, this.y, this.radius
    );
    grad.addColorStop(0, '#020205');
    grad.addColorStop(0.7, '#070714');
    grad.addColorStop(1, '#0e0e24');
    
    ctx.fillStyle = grad;
    ctx.fill();

    // Inner shadow details
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius - 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }
}

// 2. Particle Class - For visual feedback on hits
export class Particle {
  constructor(x, y, color, type = 'confetti', text = '') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type; // 'confetti', 'spark', 'text'
    this.text = text; // Used only if type is 'text'
    
    this.size = type === 'text' ? 18 : Math.random() * 6 + 4;
    
    // Random velocity
    const angle = Math.random() * Math.PI * 2;
    const speed = type === 'text' ? Math.random() * 1.5 + 1 : Math.random() * 6 + 3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - (type === 'text' ? 1.5 : 2); // Initial upward bias
    
    this.life = 1.0; // Decay from 1.0 to 0.0
    this.decay = type === 'text' ? 0.02 : Math.random() * 0.03 + 0.02;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.2;
    this.gravity = type === 'text' ? -0.05 : 0.25; // Floating text doesn't fall
  }

  update(dt) {
    this.x += this.vx;
    this.vy += this.gravity;
    this.y += this.vy;
    this.rotation += this.rotSpeed;
    this.life -= this.decay;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.life;

    if (this.type === 'text') {
      // Floating text shadow
      ctx.shadowBlur = 6;
      ctx.shadowColor = this.color;
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${this.size}px 'Orbitron', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(this.text, this.x, this.y);
    } else if (this.type === 'confetti') {
      // Confetti squares
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
    } else {
      // Sparkling stars/circles
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.color;
      ctx.fill();
    }

    ctx.restore();
  }
}

// 3. Clown Base Class
export class Clown {
  constructor(hole, options = {}) {
    this.hole = hole;
    this.x = hole.x;
    this.y = hole.y;
    this.type = options.type || 'normal';
    
    // States: 'hiding', 'popping', 'active', 'retreating', 'hit'
    this.state = 'hiding';
    this.scale = 0.0; // 0.0 = fully hidden, 1.0 = fully popped up
    
    // Tuning parameters
    this.points = options.points || 100;
    this.healthChange = options.healthChange || 0; // Negative for damage
    this.activeDuration = options.activeDuration || 2500; // ms to remain active
    this.popSpeed = options.popSpeed || 4.0; // scaling speed up
    this.retractSpeed = options.retractSpeed || 3.0; // scaling speed down
    
    this.activeTimeElapsed = 0;
    this.color = options.color || '#ff007f';
  }

  spawn() {
    this.state = 'popping';
    this.scale = 0.0;
    this.activeTimeElapsed = 0;
  }

  hit() {
    this.state = 'hit';
    return this.points;
  }

  update(dt, isFrozen) {
    if (this.state === 'hiding') return;

    if (this.state === 'popping') {
      if (isFrozen) return; // Don't animate state change while frozen
      this.scale += this.popSpeed * dt;
      if (this.scale >= 1.0) {
        this.scale = 1.0;
        this.state = 'active';
      }
    } 
    
    else if (this.state === 'active') {
      if (!isFrozen) {
        this.activeTimeElapsed += dt * 1000;
        if (this.activeTimeElapsed >= this.activeDuration) {
          this.state = 'retreating';
        }
      }
    } 
    
    else if (this.state === 'retreating') {
      if (isFrozen) return;
      this.scale -= this.retractSpeed * dt;
      if (this.scale <= 0.0) {
        this.scale = 0.0;
        this.state = 'hiding';
        // Notify game this hole is free, and apply miss health penalty
        if (this.hole.occupant === this) {
          this.hole.occupant = null;
        }
        return 'miss';
      }
    } 
    
    else if (this.state === 'hit') {
      // Shrink super fast on hit
      this.scale -= 8.0 * dt;
      if (this.scale <= 0.0) {
        this.scale = 0.0;
        this.state = 'hiding';
        if (this.hole.occupant === this) {
          this.hole.occupant = null;
        }
      }
    }
  }

  // Draw the clown inside clipping mask of the hole
  draw(ctx) {
    if (this.state === 'hiding') return;

    ctx.save();
    
    // Clip the clown to the hole! This gives the realistic "popping out" effect
    ctx.beginPath();
    // We clip to a shape that covers the top of the hole but ends at the bottom curve,
    // actually, a simple circle clip of the hole itself is perfect, but we let the clown pop UPWARDS.
    // Clipping region: the circular hole, plus everything ABOVE the hole.
    ctx.arc(this.hole.x, this.hole.y, this.hole.radius - 2, 0, Math.PI, false); // Bottom edge of hole
    ctx.lineTo(this.hole.x - this.hole.radius, this.hole.y - 200); // Box up
    ctx.lineTo(this.hole.x + this.hole.radius, this.hole.y - 200); // Box across
    ctx.closePath();
    ctx.clip();

    // Now calculate actual rendering y coordinate based on scale.
    // When scale = 1.0, clown center is hole.y - 45 (fully popped out)
    // When scale = 0.0, clown center is hole.y + hole.radius (fully inside hole)
    const activeY = this.hole.y - 45;
    const hiddenY = this.hole.y + this.hole.radius + 15;
    const currentY = hiddenY + (activeY - hiddenY) * this.scale;

    this.renderClownArt(ctx, this.hole.x, currentY);

    ctx.restore();
  }

  renderClownArt(ctx, x, y) {
    const size = 35; // base radius of clown head
    
    // Draw hair (fluffy colorful circles)
    ctx.beginPath();
    ctx.arc(x - size, y - size*0.3, size * 0.6, 0, Math.PI * 2);
    ctx.arc(x - size*1.2, y + size*0.2, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size, y - size*0.3, size * 0.6, 0, Math.PI * 2);
    ctx.arc(x + size*1.2, y + size*0.2, size * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    // Draw collar
    ctx.beginPath();
    ctx.moveTo(x - size * 0.8, y + size * 0.7);
    ctx.lineTo(x, y + size * 1.3);
    ctx.lineTo(x + size * 0.8, y + size * 0.7);
    ctx.closePath();
    ctx.fillStyle = '#ffcc00';
    ctx.fill();

    // Collar stripes
    ctx.beginPath();
    ctx.moveTo(x - size * 0.4, y + size * 0.8);
    ctx.lineTo(x, y + size * 1.3);
    ctx.lineTo(x + size * 0.4, y + size * 0.8);
    ctx.closePath();
    ctx.fillStyle = '#ff3300';
    ctx.fill();

    // Draw face
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
    ctx.shadowBlur = 0; // Reset shadow

    // Face outlines/ears
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw makeup paint around eyes
    ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(x - size * 0.35, y - size * 0.2, size * 0.3, 0, Math.PI * 2);
    ctx.arc(x + size * 0.35, y - size * 0.2, size * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Draw eyes (crosses or pupils)
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    // Left eye
    ctx.beginPath();
    ctx.moveTo(x - size * 0.45, y - size * 0.3);
    ctx.lineTo(x - size * 0.25, y - size * 0.1);
    ctx.moveTo(x - size * 0.25, y - size * 0.3);
    ctx.lineTo(x - size * 0.45, y - size * 0.1);
    ctx.stroke();
    // Right eye
    ctx.beginPath();
    ctx.moveTo(x + size * 0.25, y - size * 0.3);
    ctx.lineTo(x + size * 0.45, y - size * 0.1);
    ctx.moveTo(x + size * 0.45, y - size * 0.3);
    ctx.lineTo(x + size * 0.25, y - size * 0.1);
    ctx.stroke();

    // Draw big clown mouth (smile)
    ctx.beginPath();
    ctx.arc(x, y + size * 0.1, size * 0.5, 0, Math.PI, false);
    ctx.fillStyle = '#ff003c';
    ctx.fill();
    
    // Draw inner mouth / teeth details
    ctx.beginPath();
    ctx.arc(x, y + size * 0.1, size * 0.5, 0.1, Math.PI - 0.1, false);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Teeth (white box)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 8, y + size * 0.1, 16, 5);
    ctx.strokeStyle = '#111';
    ctx.strokeRect(x - 8, y + size * 0.1, 16, 5);

    // Draw big red nose!
    ctx.beginPath();
    ctx.arc(x, y - size * 0.05, size * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = '#ff003c';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#ff0000';
    ctx.fill();
    ctx.shadowBlur = 0; // Reset
    
    // Nose highlight
    ctx.beginPath();
    ctx.arc(x - 2, y - size * 0.05 - 2, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}

// 4. Specialized Clowns

// Normal Clown - Pink hair, 100pts
export class NormalClown extends Clown {
  constructor(hole, level) {
    // Tweak active duration based on level (harder = faster)
    const baseDuration = Math.max(1600, 2600 - (level - 1) * 250);
    super(hole, {
      type: 'normal',
      points: 100,
      healthChange: -10, // Penalty for letting them escape
      activeDuration: baseDuration,
      popSpeed: 4.2 + (level * 0.3),
      retractSpeed: 3.5 + (level * 0.2),
      color: '#ff007f' // Neon Pink
    });
  }
}

// Fast Clown - Green hair, pops very quick, 200pts
export class FastClown extends Clown {
  constructor(hole, level) {
    const baseDuration = Math.max(900, 1500 - (level - 1) * 150);
    super(hole, {
      type: 'fast',
      points: 200,
      healthChange: -15, // High penalty for escaping
      activeDuration: baseDuration,
      popSpeed: 6.0 + (level * 0.4),
      retractSpeed: 5.0 + (level * 0.3),
      color: '#39ff14' // Neon Green
    });
  }

  // Override to render unique wild makeup
  renderClownArt(ctx, x, y) {
    super.renderClownArt(ctx, x, y);

    // Overlay extra green makeup triangles on the face
    const size = 35;
    ctx.fillStyle = '#39ff14';
    ctx.beginPath();
    ctx.moveTo(x - size*0.5, y - size*0.6);
    ctx.lineTo(x - size*0.35, y - size*0.4);
    ctx.lineTo(x - size*0.2, y - size*0.6);
    ctx.closePath();
    
    ctx.moveTo(x + size*0.2, y - size*0.6);
    ctx.lineTo(x + size*0.35, y - size*0.4);
    ctx.lineTo(x + size*0.5, y - size*0.6);
    ctx.closePath();
    ctx.fill();
  }
}

// Bomb Clown - Black/red colors, deducts health/score if hit!
export class BombClown extends Clown {
  constructor(hole, level) {
    super(hole, {
      type: 'bomb',
      points: -150, // Point deduction
      healthChange: -25, // Damage on hit!
      activeDuration: 2200, // Stays up a normal duration
      popSpeed: 4.0,
      retractSpeed: 3.0,
      color: '#3a3a4a'
    });
  }

  // Override rendering to make it a distinct dangerous bomb head
  renderClownArt(ctx, x, y) {
    const size = 35;

    // Spark fuse on top of head
    ctx.save();
    ctx.strokeStyle = '#ff9900';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x + 10, y - size - 15, x + 5, y - size - 22);
    ctx.stroke();

    // Spark fire at the end of the fuse
    const sparkGrad = ctx.createRadialGradient(x+5, y-size-22, 1, x+5, y-size-22, 8);
    sparkGrad.addColorStop(0, '#ffffff');
    sparkGrad.addColorStop(0.3, '#ffcc00');
    sparkGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = sparkGrad;
    ctx.beginPath();
    ctx.arc(x+5, y-size-22, 8, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // Dark charcoal metal head
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1e24';
    ctx.fill();
    ctx.strokeStyle = '#ff3b30'; // Glowing red outline
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Angry red eyes
    ctx.fillStyle = '#ff3b30';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff0000';
    
    // Left eye (angry angle)
    ctx.beginPath();
    ctx.moveTo(x - size*0.45, y - size*0.3);
    ctx.lineTo(x - size*0.2, y - size*0.2);
    ctx.lineTo(x - size*0.4, y - size*0.1);
    ctx.closePath();
    ctx.fill();
    
    // Right eye
    ctx.beginPath();
    ctx.moveTo(x + size*0.45, y - size*0.3);
    ctx.lineTo(x + size*0.2, y - size*0.2);
    ctx.lineTo(x + size*0.4, y - size*0.1);
    ctx.closePath();
    ctx.fill();
    
    ctx.shadowBlur = 0;

    // Jagged shark-like mouth
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - size*0.5, y + size*0.2);
    ctx.lineTo(x - size*0.3, y + size*0.4);
    ctx.lineTo(x - size*0.1, y + size*0.2);
    ctx.lineTo(x, y + size*0.4);
    ctx.lineTo(x + size*0.1, y + size*0.2);
    ctx.lineTo(x + size*0.3, y + size*0.4);
    ctx.lineTo(x + size*0.5, y + size*0.2);
    ctx.stroke();

    // Bomb details (fuse socket)
    ctx.fillStyle = '#444';
    ctx.fillRect(x - 8, y - size - 3, 16, 5);
  }
}

// Golden Clown - Golden hair, drops power-ups on hit! 500pts
export class GoldenClown extends Clown {
  constructor(hole, level) {
    super(hole, {
      type: 'gold',
      points: 500,
      healthChange: -5, // Low penalty for escaping
      activeDuration: 1200, // Very fast!
      popSpeed: 6.5,
      retractSpeed: 5.5,
      color: '#ffd700'
    });
  }

  renderClownArt(ctx, x, y) {
    const size = 35;
    
    // Golden glow aura
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ffd700';
    
    // Hair (Gold)
    ctx.beginPath();
    ctx.arc(x - size, y - size*0.3, size * 0.6, 0, Math.PI * 2);
    ctx.arc(x - size*1.2, y + size*0.2, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size, y - size*0.3, size * 0.6, 0, Math.PI * 2);
    ctx.arc(x + size*1.2, y + size*0.2, size * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();

    // Crown
    ctx.fillStyle = '#ff9900';
    ctx.beginPath();
    ctx.moveTo(x - 12, y - size);
    ctx.lineTo(x - 18, y - size - 12);
    ctx.lineTo(x - 6, y - size - 6);
    ctx.lineTo(x, y - size - 16); // center peak
    ctx.lineTo(x + 6, y - size - 6);
    ctx.lineTo(x + 18, y - size - 12);
    ctx.lineTo(x + 12, y - size);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Gold face
    const faceGrad = ctx.createRadialGradient(x - 5, y - 5, 5, x, y, size);
    faceGrad.addColorStop(0, '#fffbf0');
    faceGrad.addColorStop(0.5, '#ffeaa7');
    faceGrad.addColorStop(1, '#d4af37');

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = faceGrad;
    ctx.fill();
    ctx.strokeStyle = '#996515';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Glittery eyes
    ctx.fillStyle = '#996515';
    ctx.beginPath();
    ctx.arc(x - size * 0.3, y - size * 0.2, 4, 0, Math.PI * 2);
    ctx.arc(x + size * 0.3, y - size * 0.2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Smiling mouth
    ctx.beginPath();
    ctx.arc(x, y + size * 0.1, size * 0.4, 0, Math.PI, false);
    ctx.fillStyle = '#d43f3a';
    ctx.fill();

    // Big red nose
    ctx.beginPath();
    ctx.arc(x, y - size * 0.05, size * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#d43f3a';
    ctx.fill();
    
    ctx.restore();
  }
}

// 5. PowerUpItem Class - Floating bubbles/items to smack
export class PowerUpItem {
  constructor(hole, type = 'freeze') {
    this.hole = hole;
    this.x = hole.x;
    this.y = hole.y;
    this.type = type; // 'freeze', 'double'
    
    this.state = 'hiding';
    this.scale = 0.0;
    
    this.popSpeed = 3.5;
    this.retractSpeed = 2.5;
    this.activeDuration = 3500; // Powerup stays up longer so player has time
    this.activeTimeElapsed = 0;
    
    this.color = type === 'freeze' ? '#00f0ff' : '#ffd700';
    this.pulseAngle = 0;
  }

  spawn() {
    this.state = 'popping';
    this.scale = 0.0;
    this.activeTimeElapsed = 0;
  }

  hit() {
    this.state = 'hit';
    return this.type;
  }

  update(dt, isFrozen) {
    if (this.state === 'hiding') return;
    
    this.pulseAngle += dt * 5.0; // Pulse animation rate

    if (this.state === 'popping') {
      if (isFrozen && this.type !== 'freeze') return;
      this.scale += this.popSpeed * dt;
      if (this.scale >= 1.0) {
        this.scale = 1.0;
        this.state = 'active';
      }
    } 
    
    else if (this.state === 'active') {
      if (!isFrozen || this.type === 'freeze') {
        this.activeTimeElapsed += dt * 1000;
        if (this.activeTimeElapsed >= this.activeDuration) {
          this.state = 'retreating';
        }
      }
    } 
    
    else if (this.state === 'retreating') {
      if (isFrozen && this.type !== 'freeze') return;
      this.scale -= this.retractSpeed * dt;
      if (this.scale <= 0.0) {
        this.scale = 0.0;
        this.state = 'hiding';
        if (this.hole.occupant === this) {
          this.hole.occupant = null;
        }
      }
    } 
    
    else if (this.state === 'hit') {
      this.scale -= 8.0 * dt;
      if (this.scale <= 0.0) {
        this.scale = 0.0;
        this.state = 'hiding';
        if (this.hole.occupant === this) {
          this.hole.occupant = null;
        }
      }
    }
  }

  draw(ctx) {
    if (this.state === 'hiding') return;

    ctx.save();
    
    // Clip to hole
    ctx.beginPath();
    ctx.arc(this.hole.x, this.hole.y, this.hole.radius - 2, 0, Math.PI, false);
    ctx.lineTo(this.hole.x - this.hole.radius, this.hole.y - 200);
    ctx.lineTo(this.hole.x + this.hole.radius, this.hole.y - 200);
    ctx.closePath();
    ctx.clip();

    const activeY = this.hole.y - 40;
    const hiddenY = this.hole.y + this.hole.radius + 10;
    const currentY = hiddenY + (activeY - hiddenY) * this.scale;

    // Apply scaling and floating/pulsing effect
    const bounceOffset = Math.sin(this.pulseAngle) * 5;
    const drawY = currentY + bounceOffset;
    
    // Draw bubble
    ctx.translate(this.hole.x, drawY);
    ctx.scale(this.scale, this.scale);

    // Glowing border shadow
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;

    // Glass bubble background
    const grad = ctx.createRadialGradient(-5, -5, 2, 0, 0, 30);
    if (this.type === 'freeze') {
      grad.addColorStop(0, 'rgba(230, 248, 255, 0.9)');
      grad.addColorStop(0.5, 'rgba(100, 200, 255, 0.4)');
      grad.addColorStop(1, 'rgba(0, 122, 255, 0.8)');
    } else {
      grad.addColorStop(0, 'rgba(255, 250, 220, 0.9)');
      grad.addColorStop(0.5, 'rgba(255, 215, 0, 0.4)');
      grad.addColorStop(1, 'rgba(204, 153, 0, 0.8)');
    }

    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.shadowBlur = 0; // reset

    // Draw symbol inside
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '24px Arial';
    
    if (this.type === 'freeze') {
      ctx.fillText('❄️', 0, 0);
    } else {
      ctx.fillText('⚡', 0, 0);
    }

    // Highlight sheen
    ctx.beginPath();
    ctx.arc(-8, -8, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();

    ctx.restore();
  }
}
