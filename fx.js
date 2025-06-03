// fx.js - Effects System for F-E-R-M

// Available effects with their default settings
const AVAILABLE_EFFECTS = {
  reverb: {
    name: "Reverb",
    create: () => new Tone.Reverb({
      decay: 2,
      wet: 0.3
    })
  },
  delay: {
    name: "Delay", 
    create: () => new Tone.FeedbackDelay({
      delayTime: "8n",
      feedback: 0.3,
      wet: 0.2
    })
  },
  filter: {
    name: "Filter",
    create: () => new Tone.Filter({
      frequency: 1000,
      type: "lowpass",
      rolloff: -12
    })
  },
  distortion: {
    name: "Distortion",
    create: () => new Tone.Distortion({
      distortion: 0.4,
      wet: 0.5
    })
  },
  chorus: {
    name: "Chorus",
    create: () => new Tone.Chorus({
      frequency: 4,
      delayTime: 2.5,
      depth: 0.5,
      wet: 0.3
    }).start()
  }
};

// FX Chain Management
class EffectChain {
  constructor() {
    this.effects = []; // Array of {type, instance} objects
    this.input = new Tone.Gain(1); // Input node
    this.output = new Tone.Gain(1); // Output node
    
    // Initially connect input directly to output (bypass)
    this.input.connect(this.output);
    
    // Connect output to destination
    this.output.toDestination();
  }

  // Add an effect to the chain
  addEffect(effectType) {
    if (this.effects.length >= 3) {
      console.warn("Maximum 3 effects per chain");
      return false;
    }

    if (!AVAILABLE_EFFECTS[effectType]) {
      console.error(`Unknown effect type: ${effectType}`);
      return false;
    }

    const effect = {
      type: effectType,
      instance: AVAILABLE_EFFECTS[effectType].create()
    };

    this.effects.push(effect);
    this.rebuild();
    return true;
  }

  // Remove an effect by index
  removeEffect(index) {
    if (index < 0 || index >= this.effects.length) return false;

    // Dispose of the effect instance
    this.effects[index].instance.dispose();
    this.effects.splice(index, 1);
    this.rebuild();
    return true;
  }

  // Rebuild the audio routing chain
  rebuild() {
    // Disconnect everything first
    this.input.disconnect();
    this.effects.forEach(fx => fx.instance.disconnect());
    
    // Don't disconnect output from destination, just from previous connections
    this.output.disconnect();
    this.output.toDestination(); // Reconnect to destination

    // Rebuild the chain: input → fx1 → fx2 → fx3 → output
    let currentNode = this.input;
    
    this.effects.forEach(fx => {
      currentNode.connect(fx.instance);
      currentNode = fx.instance;
    });
    
    // Connect the last node (or input if no effects) to output
    currentNode.connect(this.output);
  }

  // Connect a player to this effect chain
  connectPlayer(player) {
    player.disconnect(); // Disconnect from previous destination
    player.connect(this.input);
  }

  // Connect this chain to destination (called during setup)
  connectToDestination() {
    // Already connected in constructor, but ensure it's connected
    this.output.toDestination();
  }

  // Dispose of all effects
  dispose() {
    this.effects.forEach(fx => fx.instance.dispose());
    this.input.dispose();
    this.output.dispose();
    this.effects = [];
  }

  // Get effects list for UI
  getEffectsList() {
    return this.effects.map((fx, index) => ({
      index,
      type: fx.type,
      name: AVAILABLE_EFFECTS[fx.type].name
    }));
  }
}

// Generate FX UI for a track
function generateFXUI(soundIndex, effectChain, isExpanded = false) {
  const effects = effectChain.getEffectsList();
  const availableOptions = Object.keys(AVAILABLE_EFFECTS)
    .map(key => `<option value="${key}">${AVAILABLE_EFFECTS[key].name}</option>`)
    .join('');

  let fxContent = '';
  
  if (isExpanded) {
    fxContent = `
      <div class="fx-expanded" data-sound-index="${soundIndex}">
        <div class="fx-header">
          <button class="fx-toggle-btn" data-sound-index="${soundIndex}">
            FX <span class="fx-toggle-icon">▲</span>
          </button>
        </div>
        <div class="fx-panel">
          <div class="fx-controls">
            <select class="fx-add-select" data-sound-index="${soundIndex}">
              <option value="">+ Add Effect</option>
              ${availableOptions}
            </select>
          </div>
          <div class="fx-chain">
            ${effects.map((fx, index) => `
              <div class="fx-item" data-fx-index="${index}">
                <span class="fx-name">${index + 1}. ${fx.name}</span>
                <button class="fx-remove-btn" data-sound-index="${soundIndex}" data-fx-index="${index}">×</button>
              </div>
            `).join('')}
            ${effects.length < 3 ? `
              <div class="fx-item fx-empty">
                <span class="fx-name">${effects.length + 1}. [Empty Slot]</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  } else {
    const effectCount = effects.length;
    const fxLabel = effectCount > 0 ? `FX (${effectCount})` : 'FX';
    
    fxContent = `
      <div class="fx-collapsed" data-sound-index="${soundIndex}">
        <button class="fx-toggle-btn" data-sound-index="${soundIndex}">
          ${fxLabel} <span class="fx-toggle-icon">▼</span>
        </button>
      </div>
    `;
  }

  return fxContent;
}

// Handle FX UI events
function setupFXEventListeners() {
  // Toggle FX panel
  document.addEventListener('click', (e) => {
    if (e.target.matches('.fx-toggle-btn') || e.target.closest('.fx-toggle-btn')) {
      const btn = e.target.closest('.fx-toggle-btn');
      const soundIndex = parseInt(btn.getAttribute('data-sound-index'));
      toggleFXPanel(soundIndex);
    }
  });

  // Add effect
  document.addEventListener('change', (e) => {
    if (e.target.matches('.fx-add-select')) {
      const soundIndex = parseInt(e.target.getAttribute('data-sound-index'));
      const effectType = e.target.value;
      
      if (effectType) {
        addEffectToSound(soundIndex, effectType);
        e.target.value = ''; // Reset select
      }
    }
  });

  // Remove effect
  document.addEventListener('click', (e) => {
    if (e.target.matches('.fx-remove-btn')) {
      const soundIndex = parseInt(e.target.getAttribute('data-sound-index'));
      const fxIndex = parseInt(e.target.getAttribute('data-fx-index'));
      removeEffectFromSound(soundIndex, fxIndex);
    }
  });
}

// Initialize FX event listeners when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupFXEventListeners);
} else {
  setupFXEventListeners();
}