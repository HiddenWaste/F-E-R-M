// Create or update the Tone.js sequence
function updateSequence() {
  if (sequence) {
    sequence.dispose();
  }
  
  sequence = new Tone.Sequence(
    (time, step) => {
      // Check each sound to see if it should play on this step
      selectedSounds.forEach(sound => {
        if (sound.pattern && 
            sound.pattern[step] === 1 && 
            players.has(sound.id)) {
          const player = players.get(sound.id);
          
          // Reset player if needed
          if (player.state !== "stopped") {
            player.stop();
          }
          
          // Make sure volume is set correctly
          if (sound.volume !== undefined) {
            player.volume.value = sound.volume;
          }
          
          player.start(time);
        }
      });
    },
    [...Array(steps).keys()], // Creates array [0, 1, 2, ..., steps-1]
    "16n"
  );
  
  if (isPlaying) {
    sequence.start(0);
  }
}

// Start the rhythm
async function startRhythm() {
  if (selectedSounds.length === 0) {
    showMessage("Please add at least one sound first", "error");
    return;
  }
  
  try {
    await Tone.start();
    updateSequence();
    sequence.start(0);
    Tone.Transport.start();
    document.getElementById("transport-status").textContent = "Playing";
    isPlaying = true;
  } catch (error) {
    console.error("Error starting rhythm:", error);
    showMessage("Error starting rhythm", "error");
  }
}

// Stop the rhythm
function stopRhythm() {
  if (sequence) {
    sequence.stop();
  }
  Tone.Transport.stop();
  document.getElementById("transport-status").textContent = "Stopped";
  isPlaying = false;
  
  // Also stop recording if it's active
  if (isRecording) {
    toggleRecording();
  }
}

// Remove a sound from the rhythm
function removeSound(index) {
  if (index >= 0 && index < selectedSounds.length) {
    selectedSounds.splice(index, 1);
    document.getElementById("selected-sounds-count").textContent = selectedSounds.length;
    updatePatternDisplay();
    
    // Update sequence if playing
    if (sequence && isPlaying) {
      updateSequence();
    }
  }
}

// Clear all sounds from the rhythm
function clearAllSounds() {
  stopRhythm();
  selectedSounds = [];
  document.getElementById("selected-sounds-count").textContent = "0";
  updatePatternDisplay();
}

// Display a message to the user
function showMessage(message, type = "info") {
  const element = document.getElementById("error");
  const className = type === "error" ? "error" : "message";
  element.innerHTML = `<div class="${className}">${message}</div>`;
  
  // Auto-clear after a few seconds
  setTimeout(() => {
    element.innerHTML = "";
  }, 3000);
}// Update all patterns if step count changes
function updatePatterns() {
  selectedSounds.forEach((sound, index) => {
    // Adjust fill count proportionally if steps changed
    if (sound.pattern && sound.pattern.length !== steps) {
      const oldLength = sound.pattern.length;
      const newFills = Math.max(1, Math.round(sound.fills * steps / oldLength));
      sound.fills = newFills;
      sound.pattern = generatePattern(steps, newFills);
    }
  });
  
  updatePatternDisplay();
  
  // Update sequence if it's playing
  if (sequence && isPlaying) {
    updateSequence();
  }
}

// Update the pattern display in the UI
function updatePatternDisplay() {
  const container = document.getElementById("patterns-container");
  container.innerHTML = "";
  
  if (selectedSounds.length === 0) {
    container.innerHTML = "<p>Add sounds to create patterns</p>";
    return;
  }
  
  // Create UI for each sound's pattern
  selectedSounds.forEach((sound, index) => {
    const row = document.createElement("div");
    row.className = "pattern-row";
    
    const controls = document.createElement("div");
    controls.className = "pattern-controls";
    controls.innerHTML = `
      <span class="sound-name">${sound.name}</span>
      <div class="pattern-actions">
        <button class="regenerate-btn" data-index="${index}">↻</button>
        <input type="range" class="fills-slider" data-index="${index}" 
               min="1" max="${steps}" value="${sound.fills}">
        <span class="fills-value">${sound.fills}</span>
        <button class="remove-btn" data-index="${index}">×</button>
      </div>
    `;
    
    const pattern = document.createElement("div");
    pattern.className = "pattern-display";
    pattern.innerHTML = sound.pattern.map(value => 
      value === 1 
        ? '<span class="step active">●</span>' 
        : '<span class="step inactive">○</span>'
    ).join("");
    
    // Add volume slider
    const volumeControl = document.createElement("div");
    volumeControl.className = "volume-control";
    volumeControl.innerHTML = `
      <label class="volume-label">Vol:</label>
      <input type="range" class="volume-slider" data-index="${index}" 
             min="-40" max="0" step="1" value="${sound.volume || -3}">
      <span class="volume-value">${sound.volume || -3}dB</span>
    `;
    
    row.appendChild(controls);
    row.appendChild(pattern);
    row.appendChild(volumeControl);
    container.appendChild(row);
  });
  
  // Add event listeners to new controls
  document.querySelectorAll('.regenerate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      regeneratePattern(parseInt(btn.getAttribute('data-index')));
    });
  });
  
  document.querySelectorAll('.fills-slider').forEach(slider => {
    slider.addEventListener('input', () => {
      const index = parseInt(slider.getAttribute('data-index'));
      const fills = parseInt(slider.value);
      
      // Update the fill count display
      slider.parentNode.querySelector('.fills-value').textContent = fills;
      
      // Update the pattern
      updatePatternFills(index, fills);
    });
  });
  
  document.querySelectorAll('.volume-slider').forEach(slider => {
    slider.addEventListener('input', () => {
      const index = parseInt(slider.getAttribute('data-index'));
      const volumeDb = parseInt(slider.value);
      
      // Update the volume display
      slider.parentNode.querySelector('.volume-value').textContent = `${volumeDb}dB`;
      
      // Update the volume
      updateVolume(index, volumeDb);
    });
  });
  
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      removeSound(parseInt(btn.getAttribute('data-index')));
    });
  });
}// Add a sound to the rhythm
function addSoundToRhythm(sound) {
  // Check if already added
  if (selectedSounds.some(s => s.id === sound.id)) {
    showMessage(`"${sound.name}" is already in your rhythm`, "info");
    return;
  }
  
  // Create a random fill value (number of hits)
  const fills = Math.floor(Math.random() * (steps / 2)) + 1;
  
  // Add to selected sounds with default volume
  selectedSounds.push({
    id: sound.id,
    name: sound.name,
    fills: fills,
    volume: -3, // -3dB is approximately 0.7 linear volume
    pattern: generatePattern(steps, fills)
  });
  
  // Update UI
  document.getElementById("selected-sounds-count").textContent = selectedSounds.length;
  updatePatternDisplay();
  showMessage(`Added "${sound.name}" to the rhythm`, "info");
  
  // Make sure player is loaded
  if (sound.previews && sound.previews["preview-hq-mp3"]) {
    loadSound(sound.previews["preview-hq-mp3"], sound.id);
  }
}

// Generate an Euclidean rhythm pattern
function generatePattern(steps, fills) {
  // Try to use Total Serialism library if available
  if (typeof TotalSerialism !== 'undefined' && 
      TotalSerialism.Algorithmic && 
      TotalSerialism.Algorithmic.fastEuclid) {
    return TotalSerialism.Algorithmic.fastEuclid(steps, fills);
  }
  
  // Basic fallback implementation
  const pattern = new Array(steps).fill(0);
  
  if (fills > 0) {
    const stepSize = steps / fills;
    for (let i = 0; i < fills; i++) {
      const index = Math.floor(i * stepSize);
      if (index < steps) {
        pattern[index] = 1;
      }
    }
  }
  
  return pattern;
}

// Regenerate a pattern for a specific sound
function regeneratePattern(index) {
  if (index >= 0 && index < selectedSounds.length) {
    const sound = selectedSounds[index];
    sound.pattern = generatePattern(steps, sound.fills);
    updatePatternDisplay();
    
    // Update sequence if it's playing
    if (sequence && isPlaying) {
      updateSequence();
    }
  }
}

// Update pattern fills for a specific sound
function updatePatternFills(index, fills) {
  if (index >= 0 && index < selectedSounds.length) {
    const sound = selectedSounds[index];
    sound.fills = fills;
    sound.pattern = generatePattern(steps, fills);
    updatePatternDisplay();
    
    // Update sequence if it's playing
    if (sequence && isPlaying) {
      updateSequence();
    }
  }
}

// Update volume for a specific sound
function updateVolume(index, volumeDb) {
  if (index >= 0 && index < selectedSounds.length) {
    const sound = selectedSounds[index];
    sound.volume = volumeDb;
    
    // Update the actual player volume
    if (players.has(sound.id)) {
      players.get(sound.id).volume.value = volumeDb;
    }
  }
}// Load a sound into a Tone.js player
function loadSound(url, id) {
  // If we already have this sound loaded, don't reload it
  if (players.has(id) && players.get(id).loaded) return;
  
  // If there's an existing player that's not fully loaded, dispose it
  if (players.has(id)) {
    players.get(id).dispose();
  }
  
  const player = new Tone.Player({
    url: url,
    autostart: false,
    onload: () => {
      console.log(`Sound ${id} loaded`);
      // Enable the play button once loaded
      const playButton = document.getElementById(`play-${id}`);
      if (playButton) {
        playButton.disabled = false;
        playButton.classList.remove('loading');
      }
    },
    onerror: e => {
      console.error(`Error loading sound ${id}:`, e);
      // Show error state on the button
      const playButton = document.getElementById(`play-${id}`);
      if (playButton) {
        playButton.disabled = true;
        playButton.classList.add('error');
        playButton.title = "Failed to load sound";
      }
    }
  }).toDestination();
  
  // Set default volume to 0.7 (slightly lower than 1 to prevent peaking)
  player.volume.value = -3; // -3dB is approximately 0.7 linear volume
  
  players.set(id, player);
}

// Play a sound preview
async function previewSound(id) {
  if (!players.has(id)) {
    showMessage("Sound is still loading", "error");
    return;
  }
  
  const player = players.get(id);
  
  if (!player.loaded) {
    showMessage("Sound is still loading, please wait", "error");
    return;
  }
  
  try {
    await Tone.start();
    
    // Reset if already playing
    if (player.state !== "stopped") {
      player.stop();
    }
    
    player.start();
    
    // Enable the stop button
    const stopButton = document.getElementById(`stop-${id}`);
    if (stopButton) {
      stopButton.disabled = false;
    }
  } catch (error) {
    console.error("Error playing sound:", error);
    showMessage("Error playing sound", "error");
  }
}

// Stop a specific sound
function stopSound(id) {
  if (players.has(id)) {
    const player = players.get(id);
    if (player.state !== "stopped") {
      player.stop();
    }
  }
}// Process search results
function handleSearchResults(sounds) {
  document.getElementById("loading").style.display = "none";
  document.getElementById("search-sounds-button").disabled = false;
  
  if (!sounds.results || !sounds.results.length) {
    showMessage("No sounds found", "error");
    return;
  }
  
  // Debug: Log the first result structure to console
  if (sounds.results.length > 0) {
    console.log("Sample sound result structure:", sounds.results[0]);
  }
  
  document.getElementById("euclidean-controls").style.display = "block";
  const resultsContainer = document.getElementById("sound-results");
  resultsContainer.innerHTML = "<h3>Available Sounds:</h3>";
  
  sounds.results.forEach(sound => {
    // Make sure the sound has the minimum required fields
    if (!sound.id || !sound.name) {
      console.error("Incomplete sound data:", sound);
      return; // Skip this sound
    }
    
    const soundCard = document.createElement("div");
    soundCard.className = "sound-info";
    soundCard.innerHTML = `
      <strong>${sound.name}</strong>
      <span class="sound-author">by ${sound.username || "Unknown"}</span>
      <div class="sound-actions">
        <button id="play-${sound.id}" class="play-btn loading" disabled>▶</button>
        <button id="stop-${sound.id}" class="stop-btn" disabled>■</button>
        <button id="add-${sound.id}" class="add-btn">Add to Rhythm</button>
        <button id="similar-${sound.id}" class="similar-btn">Find Similar</button>
      </div>
    `;
    resultsContainer.appendChild(soundCard);
    
    // Check if previews exist and log if not
    if (!sound.previews || Object.keys(sound.previews).length === 0) {
      console.error(`Sound ${sound.id} (${sound.name}) has no previews!`, sound);
      showMessage(`No preview available for "${sound.name}"`, "error");
      return;
    }
    
    // Start loading sound - check for various preview formats
    let previewUrl = null;
    if (sound.previews["preview-hq-mp3"]) {
      previewUrl = sound.previews["preview-hq-mp3"];
    } else if (sound.previews["preview-lq-mp3"]) {
      previewUrl = sound.previews["preview-lq-mp3"];
    } else if (sound.previews["preview-hq-ogg"]) {
      previewUrl = sound.previews["preview-hq-ogg"];
    } else if (typeof sound.previews === 'object') {
      // Fall back to any available preview
      const urls = Object.values(sound.previews);
      if (urls.length > 0) {
        previewUrl = urls[0];
      }
    }
    
    if (previewUrl) {
      console.log(`Loading sound ${sound.id} from URL: ${previewUrl}`);
      loadSound(previewUrl, sound.id);
    } else {
      console.error(`No usable preview URL for sound ${sound.id}`, sound);
      showMessage(`Could not find preview for "${sound.name}"`, "error");
    }
    
    // Add event listeners
    document.getElementById(`play-${sound.id}`).addEventListener("click", () => previewSound(sound.id));
    document.getElementById(`stop-${sound.id}`).addEventListener("click", () => stopSound(sound.id));
    document.getElementById(`add-${sound.id}`).addEventListener("click", () => addSoundToRhythm(sound));
    document.getElementById(`similar-${sound.id}`).addEventListener("click", () => findSimilarSounds(sound.id));
  });
}

// Handle search errors
function handleSearchError(error) {
  document.getElementById("loading").style.display = "none";
  document.getElementById("search-sounds-button").disabled = false;
  console.error("Error:", error);
  
  let message = "Error searching for sounds";
  if (error && error.status === 401) {
    message = "Authentication error. Check your Freesound API key.";
  }
  showMessage(message, "error");
}// Search for sounds on Freesound
async function searchSounds() {
  const searchButton = document.getElementById("search-sounds-button");
  const query = document.getElementById("sound-search").value.trim();
  
  if (!query) {
    showMessage("Please enter a search term", "error");
    return;
  }
  
  searchButton.disabled = true;
  document.getElementById("loading").style.display = "block";
  document.getElementById("sound-results").innerHTML = "";
  
  const maxDuration = document.getElementById("duration-slider").value;
  let filter = `duration:[0.1 TO ${maxDuration}]`;
  
  // Add audio feature filters if active
  const audioFeatureFilter = buildAudioFeatureFilter();
  if (audioFeatureFilter) {
    filter += audioFeatureFilter;
  }
  
  try {
    await Tone.start();
    
    freesound.textSearch(
      query,
      {
        filter: filter,
        sort: "rating_desc",
        page_size: 12,
        fields: "id,name,previews,username"
      },
      handleSearchResults,
      handleSearchError
    );
  } catch (error) {
    handleSearchError(error);
  }
}

// Find similar sounds
function findSimilarSounds(soundId) {
  document.getElementById("loading").style.display = "block";
  document.getElementById("sound-results").innerHTML = "";
  
  freesound.getSound(
    soundId, 
    sound => {
      // First get similar sounds
      sound.getSimilar(
        similarSounds => {
          console.log("Similar sounds results:", similarSounds);
          
          if (!similarSounds.results || similarSounds.results.length === 0) {
            document.getElementById("loading").style.display = "none";
            showMessage("No similar sounds found", "error");
            return;
          }
          
          // Fetch complete sound details for each similar sound
          const soundPromises = [];
          
          for (let i = 0; i < Math.min(similarSounds.results.length, 12); i++) {
            const similarSoundId = similarSounds.results[i].id;
            soundPromises.push(new Promise((resolve, reject) => {
              freesound.getSound(similarSoundId, resolve, reject);
            }));
          }
          
          // When all sounds are fetched, display them
          Promise.all(soundPromises.map(p => p.catch(e => null))) // Handle rejected promises
            .then(fetchedSounds => {
              // Filter out failed fetches
              const validSounds = fetchedSounds.filter(s => s !== null);
              
              if (validSounds.length === 0) {
                document.getElementById("loading").style.display = "none";
                showMessage("Could not load similar sounds", "error");
                return;
              }
              
              // Create a SoundCollection-like object
              const soundCollection = {
                results: validSounds
              };
              
              handleSearchResults(soundCollection);
            })
            .catch(error => {
              console.error("Error fetching similar sounds:", error);
              document.getElementById("loading").style.display = "none";
              showMessage("Error loading similar sounds", "error");
            });
        },
        handleSearchError,
        { 
          page_size: 12,
          fields: "id,name" // We just need IDs here, we'll fetch full details
        }
      );
    }, 
    handleSearchError
  );
}// Toggle recording state
async function toggleRecording() {
  if (!isRecording) {
    // Start recording
    if (!isPlaying) {
      // Start rhythm if not already playing
      await startRhythm();
    } else {
      await Tone.start();
    }
    recorder.start();
    isRecording = true;
    document.getElementById("record-button").textContent = "Stop Recording";
    document.getElementById("record-button").classList.add("recording");
    showMessage("Recording started", "info");
  } else {
    // Stop recording and show format options
    if (isPlaying) {
      // Don't stop the rhythm, only the recording
      const recording = await recorder.stop();
      
      // Show format selection dialog
      document.getElementById("recording-blob").value = URL.createObjectURL(recording);
      document.getElementById("format-selection-dialog").style.display = "flex";
    }
    
    isRecording = false;
    document.getElementById("record-button").textContent = "Record";
    document.getElementById("record-button").classList.remove("recording");
  }
}

// Download recording in selected format
function downloadRecording(format) {
  const blobUrl = document.getElementById("recording-blob").value;
  if (!blobUrl) return;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `euclidean-rhythm-${timestamp}.${format}`;
  
  // For WebM (native format), download directly
  if (format === 'webm') {
    const anchor = document.createElement("a");
    anchor.download = filename;
    anchor.href = blobUrl;
    anchor.click();
    showMessage("Recording saved as WebM", "info");
  } 
  // For WAV or MP3, use an audio converter
  else {
    showMessage("Converting and preparing download...", "info");
    
    // Create an audio element to load the blob
    const audio = new Audio();
    audio.src = blobUrl;
    
    // Set up Web Audio API for conversion
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const mediaSource = audioContext.createMediaElementSource(audio);
    const destination = audioContext.createMediaStreamDestination();
    mediaSource.connect(destination);
    
    // Create a new MediaRecorder with the desired format
    const options = { 
      mimeType: format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
      audioBitsPerSecond: 128000
    };
    
    // Use what the browser supports if requested format isn't available
    let mediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(destination.stream, options);
    } catch (e) {
      console.warn(`${options.mimeType} not supported, using default format`);
      mediaRecorder = new MediaRecorder(destination.stream);
    }
    
    const chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.download = filename;
      anchor.href = url;
      anchor.click();
      URL.revokeObjectURL(url);
      URL.revokeObjectURL(blobUrl);
      showMessage(`Recording saved as ${format.toUpperCase()}`, "info");
    };
    
    // Play the audio and record it in the new format
    mediaRecorder.start();
    audio.onended = () => {
      mediaRecorder.stop();
      audioContext.close();
    };
    audio.play();
  }
  
  // Hide the dialog
  document.getElementById("format-selection-dialog").style.display = "none";
}// Update filter value display
function updateFilterValue(slider, valueDisplay, unit) {
  valueDisplay.textContent = `${slider.value}${unit}`;
}

// Update active filters object
function updateActiveFilters(filterName, minValue, maxValue) {
  const min = parseInt(minValue);
  const max = parseInt(maxValue);
  const defaultMin = filterDefaults[filterName].min;
  const defaultMax = filterDefaults[filterName].max;
  
  // Only add to active filters if not at default values
  if (min !== defaultMin || max !== defaultMax) {
    activeFilters[filterName] = { min, max };
  } else {
    delete activeFilters[filterName];
  }
  
  // Update filter status indicator
  updateFilterStatus();
}

// Update filter status display
function updateFilterStatus() {
  const statusElement = document.getElementById('filters-status');
  const filterCount = Object.keys(activeFilters).length;
  
  if (filterCount > 0) {
    statusElement.textContent = `${filterCount} filter${filterCount !== 1 ? 's' : ''} active`;
    statusElement.classList.add('active');
    filtersActive = true;
  } else {
    statusElement.textContent = 'No filters active';
    statusElement.classList.remove('active');
    filtersActive = false;
  }
}

// Reset individual filter to defaults
function resetFilter(filterName) {
  const minSlider = document.getElementById(`${filterName}-min`);
  const maxSlider = document.getElementById(`${filterName}-max`);
  const minValue = document.getElementById(`${filterName}-min-value`);
  const maxValue = document.getElementById(`${filterName}-max-value`);
  const unit = filterName === 'pitch' ? 'Hz' : (filterName === 'loudness' ? 'dB' : '%');
  
  minSlider.value = filterDefaults[filterName].min;
  maxSlider.value = filterDefaults[filterName].max;
  
  updateFilterValue(minSlider, minValue, unit);
  updateFilterValue(maxSlider, maxValue, unit);
  
  delete activeFilters[filterName];
}

// Reset all filters to defaults
function resetAllFilters() {
  Object.keys(filterDefaults).forEach(resetFilter);
  updateFilterStatus();
}

// Build filter string for Freesound API
function buildAudioFeatureFilter() {
  if (!filtersActive) return "";
  
  let filterString = "";
  
  // Add each active filter to the query
  if (activeFilters.brightness) {
    const min = activeFilters.brightness.min / 100; // Convert percent to 0-1 range
    const max = activeFilters.brightness.max / 100;
    filterString += ` lowlevel.spectral_centroid.mean:[${min} TO ${max}]`;
  }
  
  if (activeFilters.pitch) {
    const min = activeFilters.pitch.min;
    const max = activeFilters.pitch.max;
    filterString += ` lowlevel.pitch.mean:[${min} TO ${max}]`;
  }
  
  if (activeFilters.loudness) {
    const min = activeFilters.loudness.min;
    const max = activeFilters.loudness.max;
    filterString += ` lowlevel.loudness_ebu128.integrated:[${min} TO ${max}]`;
  }
  
  if (activeFilters.temporal) {
    const min = activeFilters.temporal.min / 100; // Convert percent to 0-1 range
    const max = activeFilters.temporal.max / 100;
    filterString += ` sfx.temporal_centroid:[${min} TO ${max}]`;
  }
  
  return filterString.trim();
}// Initialize core variables
let players = new Map(); // Stores Tone.js players for each sound
let selectedSounds = []; // Array to store selected sounds and their patterns
let sequence = null; // Tone.js sequence that plays the rhythm pattern
let steps = 16; // Number of steps in the rhythm pattern
let isPlaying = false;
let recorder = null; // Tone.js recorder
let isRecording = false;

// Audio feature filter functionality
let filtersActive = false;
let activeFilters = {};

// Default filter ranges
const filterDefaults = {
  brightness: { min: 0, max: 100 },
  pitch: { min: 50, max: 2000 },
  loudness: { min: -40, max: 0 },
  temporal: { min: 0, max: 100 }
};

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Freesound API
  freesound.setToken("Y4LBMrk6uAEG4plz6ivOY38RWV9RQ3aC6ZcHCsAi");
  
  // Set initial values
  document.getElementById("steps-value").textContent = document.getElementById("steps-slider").value;
  document.getElementById("duration-value").textContent = document.getElementById("duration-slider").value;
  document.getElementById("bpm-value").textContent = "120";
  
  // Hide elements initially
  document.getElementById("loading").style.display = "none";
  document.getElementById("euclidean-controls").style.display = "none";
  
  // Initialize recorder
  initializeRecorder();
  
  // Set up event listeners
  setupEventListeners();
});

function initializeRecorder() {
  const dest = Tone.getDestination();
  recorder = new Tone.Recorder();
  dest.connect(recorder);
}

function setupEventListeners() {
  // Toggle advanced filters
  document.getElementById("toggle-filters-btn").addEventListener("click", toggleAdvancedFilters);
  
  // Search button
  document.getElementById("search-sounds-button").addEventListener("click", searchSounds);
  
  // Rhythm controls
  document.getElementById("start-rhythm").addEventListener("click", startRhythm);
  document.getElementById("stop-rhythm").addEventListener("click", stopRhythm);
  document.getElementById("clear-sounds-button").addEventListener("click", clearAllSounds);
  
  // Recording controls
  document.getElementById("record-button").addEventListener("click", toggleRecording);
  document.getElementById("download-webm").addEventListener("click", () => downloadRecording('webm'));
  document.getElementById("download-wav").addEventListener("click", () => downloadRecording('wav'));
  document.getElementById("download-mp3").addEventListener("click", () => downloadRecording('mp3'));
  document.getElementById("cancel-download").addEventListener("click", () => {
    document.getElementById("format-selection-dialog").style.display = "none";
  });
  
  // Sliders
  document.getElementById("steps-slider").addEventListener("input", (e) => {
    steps = parseInt(e.target.value);
    document.getElementById("steps-value").textContent = steps;
    updatePatterns();
  });
  
  document.getElementById("duration-slider").addEventListener("input", (e) => {
    document.getElementById("duration-value").textContent = e.target.value;
  });
  
  document.getElementById("bpm-slider").addEventListener("input", (e) => {
    document.getElementById("bpm-value").textContent = e.target.value;
    Tone.Transport.bpm.value = parseInt(e.target.value);
  });
  
  // Set up filter controls
  setupFilterControls();
}

// Advanced Filters Toggle
function toggleAdvancedFilters() {
  const btn = document.getElementById("toggle-filters-btn");
  const panel = document.getElementById("advanced-filters");
  
  // Toggle visibility class
  panel.classList.toggle("visible");
  
  // Update button appearance
  const isVisible = panel.classList.contains("visible");
  btn.classList.toggle("active", isVisible);
  btn.querySelector("span").textContent = isVisible ? "Hide Advanced Filters" : "Show Advanced Filters";
}

// Set up all filter controls
function setupFilterControls() {
  // Set up dual sliders
  setupDualSlider('brightness', '%');
  setupDualSlider('pitch', 'Hz');
  setupDualSlider('loudness', 'dB');
  setupDualSlider('temporal', '%');
  
  // Reset individual filters
  document.querySelectorAll('.reset-filter').forEach(button => {
    button.addEventListener('click', () => {
      const filter = button.getAttribute('data-filter');
      resetFilter(filter);
      updateFilterStatus();
    });
  });
  
  // Clear all filters
  document.getElementById('clear-all-filters').addEventListener('click', resetAllFilters);
}

// Setup dual slider functionality
function setupDualSlider(filterName, unit) {
  const minSlider = document.getElementById(`${filterName}-min`);
  const maxSlider = document.getElementById(`${filterName}-max`);
  const minValue = document.getElementById(`${filterName}-min-value`);
  const maxValue = document.getElementById(`${filterName}-max-value`);
  
  // Initial values
  updateFilterValue(minSlider, minValue, unit);
  updateFilterValue(maxSlider, maxValue, unit);
  
  // Ensure min doesn't exceed max
  minSlider.addEventListener('input', () => {
    const minVal = parseInt(minSlider.value);
    const maxVal = parseInt(maxSlider.value);
    
    if (minVal > maxVal) {
      minSlider.value = maxVal;
    }
    
    updateFilterValue(minSlider, minValue, unit);
    updateActiveFilters(filterName, minSlider.value, maxSlider.value);
  });
  
  // Ensure max doesn't go below min
  maxSlider.addEventListener('input', () => {
    const minVal = parseInt(minSlider.value);
    const maxVal = parseInt(maxSlider.value);
    
    if (maxVal < minVal) {
      maxSlider.value = minVal;
    }
    
    updateFilterValue(maxSlider, maxValue, unit);
    updateActiveFilters(filterName, minSlider.value, maxSlider.value);
  });
}