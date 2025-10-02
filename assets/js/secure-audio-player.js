/**
 * Secure Audio Player
 * 
 * A custom JavaScript audio player with advanced security measures
 * to prevent unauthorized downloading of audio files.
 */

class SecureAudioPlayer {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            recordingId: null,
            serverUrl: '',
            chunkSize: 8192, // 8KB chunks
            bufferSize: 1024 * 1024, // 1MB buffer
            obfuscationKey: 'wp-audio-tracks-secure-key-2024',
            ...options
        };
        
        this.audioContext = null;
        this.audioBuffer = null;
        this.source = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.duration = 0;
        this.bufferedChunks = new Map();
        this.loadedChunks = 0;
        this.totalChunks = 0;
        this.isLoading = false;
        this.isDragging = false;
        this.dragHandlers = null;
        this.hasTrackedPlay = false;
        this.wakeLock = null;
        this.progressSaveInterval = null;
        this.lastSavedTime = 0;
        this.retryAttempts = 0;
        this.maxRetries = 3;
        this.networkErrorCount = 0;
        this.isOffline = false;
        this.hasResumed = false;
        this.isOldDevice = this.detectOldDevice();
        this.isLargeFile = false; // Will be set when we know file size
        this.shouldUseSafeMode = false; // Will be determined based on file size + device
        
        this.init();
    }
    
    async init() {
        try {
            // Create audio context with optimizations for older devices and iOS
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            
            // Use smaller buffer size for older devices and iOS devices
            if (this.isOldDevice || this.isIOSDevice()) {
                // Create with smaller buffer size to reduce memory usage
                this.audioContext = new AudioContextClass({
                    sampleRate: 44100, // Standard sample rate
                    latencyHint: 'playback' // Optimize for playback
                });
            } else {
                this.audioContext = new AudioContextClass();
            }
            
            // Create player UI
            this.createPlayerUI();
            
            // Initialize security measures
            this.initSecurityMeasures();
            
            // Load audio metadata first
            await this.loadAudioMetadata();
            
            // Start preloading audio data immediately
            this.preloadAudio();
            
            // Set up network monitoring
            this.setupNetworkMonitoring();
            
        } catch (error) {
            console.error('Secure Audio Player initialization failed:', error);
            this.showError('Failed to initialize audio player');
        }
    }
    
    createPlayerUI() {
        this.container.innerHTML = `
            <div class="secure-audio-player-wrapper">
                <div class="player-controls">
                    <button class="play-pause-btn" aria-label="Play/Pause">
                        <span class="play-icon">▶</span>
                        <span class="pause-icon" style="display: none;">⏸</span>
                    </button>
                    
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                            <div class="progress-handle"></div>
                        </div>
                        <div class="time-display">
                            <span class="current-time">0:00</span>
                            <span class="duration">0:00</span>
                        </div>
                    </div>
                    
                    <div class="volume-control">
                        <button class="mute-btn" aria-label="Mute/Unmute">
                            <span class="volume-icon">🔊</span>
                            <span class="mute-icon" style="display: none;">🔇</span>
                        </button>
                        <input type="range" class="volume-slider" min="0" max="100" value="100">
                    </div>
                </div>
                
                <div class="loading-indicator" style="display: none;">
                    <div class="spinner"></div>
                    <span>Loading audio...</span>
                </div>
                
                <div class="error-message" style="display: none;"></div>
                
                
            </div>
        `;
        
        this.bindEvents();
    }
    
    bindEvents() {
        const playPauseBtn = this.container.querySelector('.play-pause-btn');
        const progressBar = this.container.querySelector('.progress-bar');
        const progressHandle = this.container.querySelector('.progress-handle');
        const muteBtn = this.container.querySelector('.mute-btn');
        const volumeSlider = this.container.querySelector('.volume-slider');
        
        playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        
        progressBar.addEventListener('click', (e) => this.seekToPosition(e));
        progressHandle.addEventListener('mousedown', (e) => this.startDragging(e));
        progressHandle.addEventListener('touchstart', (e) => this.startDragging(e));
        
        muteBtn.addEventListener('click', () => this.toggleMute());
        volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        
        // Prevent right-click and other security measures
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());
        this.container.addEventListener('selectstart', (e) => e.preventDefault());
        this.container.addEventListener('dragstart', (e) => e.preventDefault());
    }
    
    initSecurityMeasures() {
        // Disable developer tools detection
        let devtools = { open: false, orientation: null };
        const threshold = 160;
        
        setInterval(() => {
            if (window.outerHeight - window.innerHeight > threshold || 
                window.outerWidth - window.innerWidth > threshold) {
                if (!devtools.open) {
                    devtools.open = true;
                    this.showSecurityWarning();
                }
            } else {
                devtools.open = false;
            }
        }, 500);
        
        // Disable keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.isPlaying && (
                (e.ctrlKey && (e.keyCode === 83 || e.keyCode === 85)) || // Ctrl+S, Ctrl+U
                e.keyCode === 123 || // F12
                e.keyCode === 44 // Print Screen
            )) {
                e.preventDefault();
                this.showSecurityWarning();
                return false;
            }
        });
        
        // Disable text selection during playback
        document.addEventListener('selectstart', (e) => {
            if (this.isPlaying) {
                e.preventDefault();
                return false;
            }
        });
    }
    
    async loadAudioMetadata() {
        try {
            this.showLoading();
            
            // Fetch audio metadata from secure endpoint
            const response = await fetch(`${this.options.serverUrl}/secure-audio/${this.options.recordingId}/metadata/`, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-Obfuscation-Key': this.options.obfuscationKey
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const metadata = await response.json();
            this.duration = metadata.duration;
            this.totalChunks = metadata.totalChunks;
            this.chunkSize = metadata.chunkSize;
            this.fileSize = metadata.fileSize;
            
            // Determine if this is a large file that might cause crashes
            this.isLargeFile = this.fileSize > 10 * 1024 * 1024; // 10MB threshold
            this.shouldUseSafeMode = this.shouldUseSafeModeForLargeFiles();
            
            // Debug logging for large files and iOS devices
            if (this.isLargeFile || this.isIOSDevice()) {
                console.log(`WP Audio Tracks: Large file detected (${(this.fileSize / 1024 / 1024).toFixed(1)}MB)`);
                console.log(`WP Audio Tracks: Safe mode for large files: ${this.shouldUseSafeMode}`);
                console.log(`WP Audio Tracks: Is mobile device: ${this.isMobileDevice()}`);
                console.log(`WP Audio Tracks: Is iOS device: ${this.isIOSDevice()}`);
            }
            
            // console.log('Audio metadata loaded:', metadata);
            
            this.updateDurationDisplay();
            this.hideLoading();
            
            // Check for saved progress and offer to resume
            const savedTime = this.loadProgress();
            if (savedTime > 0) {
                // Small delay to ensure UI is ready
                setTimeout(() => {
                    this.showResumePrompt(savedTime);
                }, 500);
            }
            
        } catch (error) {
            console.error('Failed to load audio metadata:', error);
            await this.handleNetworkError(error, 'loading audio metadata');
        }
    }
    
    async preloadAudio() {
        try {
            // console.log('WP Audio Tracks: Starting audio preload...');
            
            // Skip preloading on older devices to prevent crashes
            if (this.isOldDevice) {
                // console.log('WP Audio Tracks: Skipping preload on old device');
                return;
            }
            
            // Use safe mode for large files on mobile devices (like iPhone 14, Redmi 9)
            if (this.shouldUseSafeMode) {
                // console.log('WP Audio Tracks: Using safe mode for large file on mobile device');
                await this.preloadInitialChunks();
                return;
            }
            
            // Check if this is a mobile device or large file (legacy check)
            const isMobile = this.isMobileDevice();
            const isLargeFile = this.totalChunks > 500; // Roughly 4MB+ files
            
            if (isMobile || isLargeFile) {
                // console.log('WP Audio Tracks: Using chunked loading for mobile/large file');
                // For mobile or large files, just load first few chunks for quick start
                await this.preloadInitialChunks();
            } else {
                // Show subtle preload indicator for desktop
                this.showPreloadIndicator();
                
                // Load the full audio file for immediate playback
                await this.loadFullAudio();
                
                this.hidePreloadIndicator();
            }
            
            // console.log('WP Audio Tracks: Audio preload completed');
            
        } catch (error) {
            console.error('WP Audio Tracks: Audio preload failed:', error);
            this.hidePreloadIndicator();
            // Don't show error to user during preload, just log it
            // The error will be shown when they try to play
        }
    }
    
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }
    
    async preloadInitialChunks() {
        try {
            // Use fewer chunks for older devices
            const maxChunks = this.isOldDevice ? 5 : 10;
            const initialChunks = Math.min(maxChunks, this.totalChunks);
            
            for (let i = 0; i < initialChunks; i++) {
                await this.loadAudioChunk(i);
                
                // Add small delay between chunks for older devices to prevent memory pressure
                if (this.isOldDevice && i < initialChunks - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            
            // console.log(`WP Audio Tracks: Preloaded ${initialChunks} chunks`);
            
        } catch (error) {
            console.error('WP Audio Tracks: Failed to preload initial chunks:', error);
        }
    }
    
    async togglePlayPause() {
        if (this.isPlaying) {
            await this.pause();
        } else {
            await this.play();
        }
    }
    
    async play() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Track play count
            this.trackPlay();

            // Request wake lock to prevent screen sleep
            await this.requestWakeLock();

            // Start saving progress periodically
            this.startProgressSaving();

            // Check if we should use chunked playback for mobile/large files
            const isMobile = this.isMobileDevice();
            const isLargeFile = this.totalChunks > 500;
            
            // Force HTML5 fallback for older devices
            if (this.shouldUseHTML5Fallback()) {
                await this.playWithHTML5Fallback();
            } else if (this.shouldUseSafeMode) {
                // Use HTML5 fallback for large files on mobile devices to prevent crashes
                await this.playWithHTML5Fallback();
            } else if (isMobile || isLargeFile) {
                // Use chunked streaming playback for mobile/large files
                await this.playChunked();
            } else {
                // Use full file playback for desktop/small files
                await this.playFullAudio();
            }

        } catch (error) {
            console.error('Play failed:', error);
            await this.handleNetworkError(error, 'playing audio');
        }
    }
    
    async playFullAudio() {
        // Load the full audio file
        if (!this.audioBuffer) {
            this.showLoading();
            try {
                await this.loadFullAudio();
                this.hideLoading();
            } catch (error) {
                console.error('Failed to load audio:', error);
                this.showError('Failed to load audio');
                return;
            }
        }

        // Create audio source from buffer
        if (this.audioBuffer) {
            this.source = this.audioContext.createBufferSource();
            this.source.buffer = this.audioBuffer;

            // Create gain node for volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = this.audioContext.gain ? this.audioContext.gain.gain.value : 1;

            // Connect audio graph
            this.source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // Start playback from current time (resume position)
            this.source.start(0, this.currentTime);
            this.isPlaying = true;
            this.isPaused = false;
            this.updatePlayButton();
            this.startProgressUpdate();

            // Handle end of playback
            this.source.onended = () => {
                this.pause();
                this.currentTime = 0;
                this.updateProgress();
                this.clearSavedProgress(); // Clear saved progress when audio ends
            };
        }
    }
    
    async playChunked() {
        try {
            this.showLoading();
            
            // For very large files on mobile, fall back to HTML5 audio
            const isVeryLargeFile = this.totalChunks > 1000; // ~8MB+ files
            
            if (isVeryLargeFile) {
                // console.log('WP Audio Tracks: Using HTML5 fallback for very large file');
                await this.playWithHTML5Fallback();
            } else {
                // Try Web Audio API with memory management
                this.isPlaying = true;
                this.isPaused = false;
                this.updatePlayButton();
                this.startProgressUpdate();
                
                // Start chunked audio streaming
                this.startChunkedPlayback();
            }
            
            this.hideLoading();
            
        } catch (error) {
            console.error('Failed to start chunked playback:', error);
            // Fallback to HTML5 audio if Web Audio fails
            try {
                await this.playWithHTML5Fallback();
            } catch (fallbackError) {
                this.showError('Playback not supported on this device');
                this.hideLoading();
            }
        }
    }
    
    async playWithHTML5Fallback() {
        try {
            // console.log('WP Audio Tracks: Using HTML5 audio fallback');
            
            // Check if HTML5 audio element already exists
            if (!this.html5Audio) {
                // Create HTML5 audio element for large files
                const audioElement = document.createElement('audio');
                audioElement.controls = false;
                
                // Optimize for older devices, large files on mobile, and iOS devices
                if (this.isOldDevice || this.shouldUseSafeMode || this.isIOSDevice()) {
                    audioElement.preload = 'none'; // Don't preload on old devices, large files, or iOS
                    audioElement.crossOrigin = 'anonymous'; // Better compatibility
                    
                    // iOS-specific optimizations
                    if (this.isIOSDevice()) {
                        audioElement.setAttribute('playsinline', 'true'); // Prevent fullscreen on iOS
                        audioElement.setAttribute('webkit-playsinline', 'true'); // iOS Safari compatibility
                    }
                } else {
                    audioElement.preload = 'metadata';
                }
                
                // Set the secure audio URL
                audioElement.src = `${this.options.serverUrl}/secure-audio/${this.options.recordingId}/`;
                
                // Add security attributes
                audioElement.setAttribute('oncontextmenu', 'return false;');
                audioElement.setAttribute('onselectstart', 'return false;');
                audioElement.setAttribute('ondragstart', 'return false;');
                
                // Hide the default controls and add our custom ones
                audioElement.style.display = 'none';
                this.container.appendChild(audioElement);
                
                // Store reference for cleanup
                this.html5Audio = audioElement;
                
                // Set up event listeners
                audioElement.addEventListener('loadedmetadata', () => {
                    this.duration = audioElement.duration;
                    this.updateDurationDisplay();
                });
                
                audioElement.addEventListener('timeupdate', () => {
                    this.currentTime = audioElement.currentTime;
                    this.updateProgress();
                });
                
                audioElement.addEventListener('ended', () => {
                    this.pause();
                    this.currentTime = 0;
                    this.updateProgress();
                    this.clearSavedProgress(); // Clear saved progress when audio ends
                });
                
                audioElement.addEventListener('error', (e) => {
                    console.error('HTML5 audio error:', e);
                    this.showError('Audio playback failed');
                });
            }
            
            // Set current time before starting playback (resume position)
            this.html5Audio.currentTime = this.currentTime;
            
            // Start playback
            await this.html5Audio.play();
            this.isPlaying = true;
            this.isPaused = false;
            this.updatePlayButton();
            this.startProgressUpdate();
            
        } catch (error) {
            console.error('HTML5 fallback failed:', error);
            throw error;
        }
    }
    
    async startChunkedPlayback() {
        // This is a simplified chunked playback approach
        // In a real implementation, you'd need to decode chunks and queue them
        
        // For now, we'll fall back to loading the full file but with memory management
        try {
            await this.loadFullAudioWithMemoryManagement();
            
            // Create audio source from buffer
            if (this.audioBuffer) {
                this.source = this.audioContext.createBufferSource();
                this.source.buffer = this.audioBuffer;

                // Create gain node for volume control
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = this.audioContext.gain ? this.audioContext.gain.gain.value : 1;

                // Connect audio graph
                this.source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                // Start playback from current time (resume position)
                this.source.start(0, this.currentTime);

                // Handle end of playback
                this.source.onended = () => {
                    this.pause();
                    this.currentTime = 0;
                    this.updateProgress();
                    this.clearSavedProgress(); // Clear saved progress when audio ends
                };
            }
            
        } catch (error) {
            console.error('Chunked playback failed:', error);
            await this.handleNetworkError(error, 'playing audio chunks');
        }
    }
    
    async loadFullAudioWithMemoryManagement() {
        try {
            // Use a more memory-efficient approach for large files
            const response = await fetch(`${this.options.serverUrl}/secure-audio/${this.options.recordingId}/`, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-Obfuscation-Key': this.options.obfuscationKey
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            
            // Deobfuscate the audio data
            const deobfuscatedData = this.deobfuscateAudioData(arrayBuffer);
            
            // Decode audio data with error handling for large files
            this.audioBuffer = await this.audioContext.decodeAudioData(deobfuscatedData.slice(0));
            
            // console.log('Audio loaded with memory management');
            
        } catch (error) {
            console.error('Failed to load audio with memory management:', error);
            await this.handleNetworkError(error, 'loading full audio file');
            throw error;
        }
    }
    
    async pause() {
        // Save progress when pausing
        this.saveProgress();
        
        // Stop saving progress
        this.stopProgressSaving();
        
        // Release wake lock when pausing
        this.releaseWakeLock();
        
        if (this.source) {
            this.source.stop();
            this.source = null;
        }
        
        if (this.html5Audio) {
            this.html5Audio.pause();
        }
        
        this.isPlaying = false;
        this.isPaused = true;
        this.updatePlayButton();
        this.stopProgressUpdate();
    }
    
    async loadAudioChunk(chunkIndex) {
        try {
            if (this.bufferedChunks.has(chunkIndex)) {
                return this.bufferedChunks.get(chunkIndex);
            }
            
            // console.log(`Loading chunk ${chunkIndex}...`);
            
            const response = await fetch(`${this.options.serverUrl}/secure-audio/${this.options.recordingId}/chunk/${chunkIndex}/`, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-Obfuscation-Key': this.options.obfuscationKey
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load chunk ${chunkIndex}: ${response.status} ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            // console.log(`Chunk ${chunkIndex} loaded, size: ${arrayBuffer.byteLength} bytes`);
            
            // Deobfuscate the audio data
            const deobfuscatedData = this.deobfuscateAudioData(arrayBuffer);
            // console.log(`Chunk ${chunkIndex} deobfuscated, size: ${deobfuscatedData.byteLength} bytes`);
            
            // For the first chunk, try to decode as audio
            if (chunkIndex === 0) {
                try {
                    const audioBuffer = await this.audioContext.decodeAudioData(deobfuscatedData);
                    this.audioBuffer = audioBuffer;
                    // console.log(`Chunk ${chunkIndex} decoded successfully, duration: ${audioBuffer.duration}s`);
                    this.bufferedChunks.set(chunkIndex, audioBuffer);
                    return audioBuffer;
                } catch (decodeError) {
                    console.error(`Failed to decode chunk ${chunkIndex}:`, decodeError);
                    // If decoding fails, try loading the full audio file instead
                    return await this.loadFullAudio();
                }
            }
            
            // For other chunks, just store the raw data for now
            this.bufferedChunks.set(chunkIndex, deobfuscatedData);
            return deobfuscatedData;
            
        } catch (error) {
            console.error(`Failed to load chunk ${chunkIndex}:`, error);
            throw error;
        }
    }
    
    async loadFullAudio() {
        try {
            // console.log('Loading full audio file...');
            const response = await fetch(`${this.options.serverUrl}/secure-audio/${this.options.recordingId}/`, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load full audio: ${response.status} ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            // console.log(`Full audio loaded, size: ${arrayBuffer.byteLength} bytes`);
            
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.audioBuffer = audioBuffer;
            // console.log(`Full audio decoded successfully, duration: ${audioBuffer.duration}s`);
            return audioBuffer;
            
        } catch (error) {
            console.error('Failed to load full audio:', error);
            throw error;
        }
    }
    
    deobfuscateAudioData(obfuscatedData) {
        // XOR deobfuscation matching server-side implementation
        const key = this.options.obfuscationKey;
        const keyLength = key.length;
        const data = new Uint8Array(obfuscatedData);
        const deobfuscated = new Uint8Array(data.length);
        
        for (let i = 0; i < data.length; i++) {
            deobfuscated[i] = data[i] ^ key.charCodeAt(i % keyLength);
        }
        
        return deobfuscated.buffer;
    }
    
    obfuscateAudioData(originalData) {
        // XOR obfuscation (server-side implementation)
        const key = this.options.obfuscationKey;
        const keyBytes = new TextEncoder().encode(key);
        const data = new Uint8Array(originalData);
        
        for (let i = 0; i < data.length; i++) {
            data[i] ^= keyBytes[i % keyBytes.length];
        }
        
        return data.buffer;
    }
    
    updatePlayButton() {
        const playIcon = this.container.querySelector('.play-icon');
        const pauseIcon = this.container.querySelector('.pause-icon');
        
        if (this.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'inline';
        } else {
            playIcon.style.display = 'inline';
            pauseIcon.style.display = 'none';
        }
    }
    
    updateDurationDisplay() {
        const durationElement = this.container.querySelector('.duration');
        durationElement.textContent = this.formatTime(this.duration);
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    startProgressUpdate() {
        this.progressInterval = setInterval(() => {
            if (this.isPlaying && this.duration > 0) {
                this.currentTime += 0.1;
                this.updateProgress();
                
                if (this.currentTime >= this.duration) {
                    this.pause();
                    this.currentTime = 0;
                    this.updateProgress();
                }
            }
        }, 100);
    }
    
    stopProgressUpdate() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
    }
    
    updateProgress() {
        const progressFill = this.container.querySelector('.progress-fill');
        const progressHandle = this.container.querySelector('.progress-handle');
        const currentTimeElement = this.container.querySelector('.current-time');
        
        const progress = (this.currentTime / this.duration) * 100;
        
        progressFill.style.width = `${progress}%`;
        progressHandle.style.left = `${progress}%`;
        currentTimeElement.textContent = this.formatTime(this.currentTime);
    }
    
    seekToPosition(eventOrTime) {
        if (!this.duration) return;
        
        let newTime;
        
        // Handle both click events and direct time values
        if (typeof eventOrTime === 'number') {
            // Direct time value (for programmatic seeking)
            newTime = Math.max(0, Math.min(this.duration, eventOrTime));
        } else {
            // Click event (for user interaction)
            const rect = this.container.querySelector('.progress-bar').getBoundingClientRect();
            const clientX = eventOrTime.clientX || (eventOrTime.touches && eventOrTime.touches[0] ? eventOrTime.touches[0].clientX : 0);
            const clickX = clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, clickX / rect.width));
            newTime = percentage * this.duration;
        }
        
        this.currentTime = newTime;
        this.updateProgress();
        
        // Handle seeking for HTML5 audio
        if (this.html5Audio) {
            this.html5Audio.currentTime = newTime;
            return;
        }
        
        // For Web Audio API, if audio is playing, restart from new position
        if (this.isPlaying && this.source) {
            this.source.stop();
            this.source = null;
            
            // Create new source and start from new position
            if (this.audioBuffer) {
                this.source = this.audioContext.createBufferSource();
                this.source.buffer = this.audioBuffer;
                this.source.connect(this.gainNode);
                
                // Start from new position
                this.source.start(0, this.currentTime);
                
                // Re-attach end handler
                this.source.onended = () => {
                    this.pause();
                    this.currentTime = 0;
                    this.updateProgress();
                    this.clearSavedProgress();
                };
            }
        }
    }
    
    startDragging(event) {
        event.preventDefault();
        
        // Prevent default touch behavior
        if (event.type === 'touchstart') {
            event.preventDefault();
        }
        
        this.isDragging = true;
        
        // Add visual feedback
        const progressHandle = this.container.querySelector('.progress-handle');
        progressHandle.style.transform = 'translate(-50%, -50%) scale(1.3)';
        
        // Set up mouse/touch move and end events
        const handleMouseMove = (e) => this.handleDrag(e);
        const handleMouseUp = (e) => this.stopDragging(e);
        
        // Add event listeners for both mouse and touch
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleMouseMove, { passive: false });
        document.addEventListener('touchend', handleMouseUp);
        
        // Store references for cleanup
        this.dragHandlers = {
            move: handleMouseMove,
            up: handleMouseUp
        };
        
        // Initial drag position
        this.handleDrag(event);
    }
    
    handleDrag(event) {
        if (!this.isDragging || !this.duration) return;
        
        event.preventDefault();
        
        const progressBar = this.container.querySelector('.progress-bar');
        const rect = progressBar.getBoundingClientRect();
        const clientX = event.clientX || (event.touches && event.touches[0] ? event.touches[0].clientX : 0);
        const dragX = clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, dragX / rect.width));
        const newTime = percentage * this.duration;
        
        this.currentTime = newTime;
        this.updateProgress();
    }
    
    stopDragging(event) {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        // Remove visual feedback
        const progressHandle = this.container.querySelector('.progress-handle');
        progressHandle.style.transform = 'translate(-50%, -50%) scale(1)';
        
        // Clean up event listeners
        if (this.dragHandlers) {
            document.removeEventListener('mousemove', this.dragHandlers.move);
            document.removeEventListener('mouseup', this.dragHandlers.up);
            document.removeEventListener('touchmove', this.dragHandlers.move);
            document.removeEventListener('touchend', this.dragHandlers.up);
            this.dragHandlers = null;
        }
        
        // Apply the seek position
        if (this.html5Audio) {
            this.html5Audio.currentTime = this.currentTime;
        } else if (this.isPlaying) {
            // For Web Audio API, restart playback from new position
            this.pause();
            setTimeout(() => {
                this.play();
            }, 10);
        }
    }
    
    toggleMute() {
        // Implement volume control
        const volumeSlider = this.container.querySelector('.volume-slider');
        const isMuted = volumeSlider.value == 0;
        
        if (isMuted) {
            volumeSlider.value = 100;
            this.setVolume(100);
        } else {
            volumeSlider.value = 0;
            this.setVolume(0);
        }
        
        this.updateMuteButton();
    }
    
    setVolume(value) {
        if (this.html5Audio) {
            this.html5Audio.volume = value / 100;
        } else if (this.audioContext) {
            this.audioContext.gain = this.audioContext.gain || this.audioContext.createGain();
            this.audioContext.gain.gain.value = value / 100;
        }
        this.updateMuteButton();
    }
    
    updateMuteButton() {
        const volumeIcon = this.container.querySelector('.volume-icon');
        const muteIcon = this.container.querySelector('.mute-icon');
        const volumeSlider = this.container.querySelector('.volume-slider');
        
        if (volumeSlider.value == 0) {
            volumeIcon.style.display = 'none';
            muteIcon.style.display = 'inline';
        } else {
            volumeIcon.style.display = 'inline';
            muteIcon.style.display = 'none';
        }
    }
    
    showLoading() {
        this.container.querySelector('.loading-indicator').style.display = 'block';
    }
    
    hideLoading() {
        this.container.querySelector('.loading-indicator').style.display = 'none';
    }
    
    showPreloadIndicator() {
        const playBtn = this.container.querySelector('.play-pause-btn');
        if (playBtn) {
            playBtn.classList.add('preloading');
        }
    }
    
    hidePreloadIndicator() {
        const playBtn = this.container.querySelector('.play-pause-btn');
        if (playBtn) {
            playBtn.classList.remove('preloading');
        }
    }
    
    showError(message) {
        const errorElement = this.container.querySelector('.error-message');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        this.hideLoading();
    }
    
    showSecurityWarning() {
        const warning = document.createElement('div');
        warning.className = 'security-warning';
        warning.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        warning.textContent = '🔒 Audio content is protected. Downloading is not allowed.';
        
        document.body.appendChild(warning);
        
        setTimeout(() => {
            warning.remove();
        }, 3000);
    }
    
    trackPlay() {
        // Only track once per session to avoid duplicate counts
        if (this.hasTrackedPlay) {
            return;
        }
        
        this.hasTrackedPlay = true;
        
        const recordingId = this.container.getAttribute('data-recording-id');
        if (!recordingId) {
            return;
        }
        
        // Check if wpAudioTracks is defined
        if (typeof wpAudioTracks === 'undefined') {
            return;
        }
        
        // Send AJAX request to track the play
        fetch(wpAudioTracks.ajaxUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'track_recording_play',
                recording_id: recordingId,
                nonce: wpAudioTracks.nonce
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data.play_count) {
                // Update the play count display
                this.updatePlayCountDisplay(data.data.play_count);
            }
        })
        .catch(error => {
            // Silently fail - tracking is not critical
        });
    }
    
    updatePlayCountDisplay(newCount) {
        const playCountElement = document.querySelector('.play-count[data-recording-id="' + this.container.getAttribute('data-recording-id') + '"]');
        if (playCountElement) {
            // Format the number with commas
            playCountElement.textContent = newCount.toLocaleString();
            
            // Add visual feedback
            playCountElement.classList.add('updated');
            setTimeout(() => {
                playCountElement.classList.remove('updated');
            }, 1000);
        }
    }
    
    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                
                // Handle wake lock release
                this.wakeLock.addEventListener('release', () => {
                    this.wakeLock = null;
                    this.updateWakeLockIndicator();
                });
                
                this.updateWakeLockIndicator();
                return true;
            } else {
                // Browser doesn't support wake lock API
                this.showWakeLockUnavailable();
                return false;
            }
        } catch (err) {
            // Wake lock request failed (user denied permission or other error)
            this.showWakeLockUnavailable();
            return false;
        }
    }
    
    showWakeLockUnavailable() {
        // Show a subtle message that wake lock is not available
        let message = this.container.querySelector('.wake-lock-message');
        if (!message) {
            message = document.createElement('div');
            message.className = 'wake-lock-message';
            message.innerHTML = '💡 Tip: Keep your device awake manually while listening';
            message.style.cssText = `
                font-size: 12px;
                color: #666;
                text-align: center;
                margin-top: 5px;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            
            const playerWrapper = this.container.querySelector('.secure-audio-player-wrapper');
            if (playerWrapper) {
                playerWrapper.appendChild(message);
                
                // Fade in the message
                setTimeout(() => {
                    message.style.opacity = '1';
                }, 100);
                
                // Hide after 5 seconds
                setTimeout(() => {
                    if (message) {
                        message.style.opacity = '0';
                        setTimeout(() => {
                            if (message && message.parentNode) {
                                message.parentNode.removeChild(message);
                            }
                        }, 300);
                    }
                }, 5000);
            }
        }
    }
    
    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
            this.updateWakeLockIndicator();
        }
    }
    
    updateWakeLockIndicator() {
        // Add or remove a small indicator to show wake lock status
        let indicator = this.container.querySelector('.wake-lock-indicator');
        
        if (this.wakeLock && !indicator) {
            // Create wake lock indicator
            indicator = document.createElement('div');
            indicator.className = 'wake-lock-indicator';
            indicator.title = 'Screen will stay on while playing';
            indicator.innerHTML = '🔒';
            
            // Insert after the play button
            const playButton = this.container.querySelector('.play-button');
            if (playButton) {
                playButton.parentNode.insertBefore(indicator, playButton.nextSibling);
            }
        } else if (!this.wakeLock && indicator) {
            // Remove indicator when wake lock is released
            indicator.remove();
        }
    }
    
    getStorageKey() {
        return `wp-audio-tracks-progress-${this.options.recordingId}`;
    }
    
    saveProgress() {
        try {
            const progressData = {
                currentTime: this.currentTime,
                duration: this.duration,
                timestamp: Date.now(),
                recordingId: this.options.recordingId
            };
            
            localStorage.setItem(this.getStorageKey(), JSON.stringify(progressData));
            this.lastSavedTime = this.currentTime;
        } catch (error) {
            // localStorage might be full or disabled
        }
    }
    
    loadProgress() {
        try {
            const savedProgress = localStorage.getItem(this.getStorageKey());
            if (savedProgress) {
                const progressData = JSON.parse(savedProgress);
                
                // Check if the saved progress is for the same recording
                if (progressData.recordingId === this.options.recordingId && progressData.duration) {
                    // Only restore if the saved time is reasonable (not at the very end)
                    if (progressData.currentTime > 5 && progressData.currentTime < progressData.duration - 10) {
                        return progressData.currentTime;
                    }
                }
            }
        } catch (error) {
            // Invalid JSON or other error
        }
        return 0;
    }
    
    startProgressSaving() {
        // Save progress every 10 seconds while playing
        this.progressSaveInterval = setInterval(() => {
            if (this.isPlaying && this.currentTime > 0) {
                this.saveProgress();
            }
        }, 10000);
    }
    
    stopProgressSaving() {
        if (this.progressSaveInterval) {
            clearInterval(this.progressSaveInterval);
            this.progressSaveInterval = null;
        }
    }
    
    showResumePrompt(savedTime) {
        const minutes = Math.floor(savedTime / 60);
        const seconds = Math.floor(savedTime % 60);
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Create resume prompt
        const prompt = document.createElement('div');
        prompt.className = 'resume-prompt';
        prompt.innerHTML = `
            <div class="resume-prompt-content">
                <p>Resume from ${timeString}?</p>
                <div class="resume-prompt-buttons">
                    <button class="resume-btn" data-action="resume">Resume</button>
                    <button class="resume-btn" data-action="restart">Start Over</button>
                </div>
            </div>
        `;
        
        // Style the prompt
        prompt.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: auto;
        `;
        
        // Prevent clicking outside the modal from closing it
        prompt.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        const content = prompt.querySelector('.resume-prompt-content');
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            max-width: 300px;
            pointer-events: auto;
        `;
        
        // Prevent clicking on content from bubbling up
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        const buttons = prompt.querySelector('.resume-prompt-buttons');
        buttons.style.cssText = `
            margin-top: 20px;
            display: flex;
            gap: 10px;
            justify-content: center;
        `;
        
        const buttonStyle = `
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s ease;
        `;
        
        const resumeBtn = prompt.querySelector('[data-action="resume"]');
        const restartBtn = prompt.querySelector('[data-action="restart"]');
        
        resumeBtn.style.cssText = buttonStyle + 'background: #0073aa; color: white;';
        restartBtn.style.cssText = buttonStyle + 'background: #666; color: white;';
        
        resumeBtn.onmouseover = () => resumeBtn.style.background = '#005a87';
        resumeBtn.onmouseout = () => resumeBtn.style.background = '#0073aa';
        restartBtn.onmouseover = () => restartBtn.style.background = '#555';
        restartBtn.onmouseout = () => restartBtn.style.background = '#666';
        
        // Add event listeners
        resumeBtn.addEventListener('click', async () => {
            // Clean up keyboard event listeners
            if (prompt.cleanup) {
                prompt.cleanup();
            }
            document.body.removeChild(prompt);
            
            // Set the current time and update progress display
            this.currentTime = savedTime;
            this.updateProgress();
            this.hasResumed = true;
            
            // Show resume indicator first
            this.showResumeIndicator(savedTime);
            
            // If audio is already loaded, seek to position and start playing
            if (this.audioBuffer || this.html5Audio) {
                setTimeout(async () => {
                    this.seekToPosition(savedTime);
                    // Auto-start playing after seeking
                    await this.play();
                }, 100);
            } else {
                // If audio isn't loaded yet, wait for it to load then seek and play
                const originalPreload = this.preloadAudio;
                this.preloadAudio = async () => {
                    await originalPreload.call(this);
                    setTimeout(async () => {
                        this.seekToPosition(savedTime);
                        // Auto-start playing after seeking
                        await this.play();
                    }, 100);
                };
            }
        });
        
        restartBtn.addEventListener('click', () => {
            // Clean up keyboard event listeners
            if (prompt.cleanup) {
                prompt.cleanup();
            }
            document.body.removeChild(prompt);
            this.clearSavedProgress();
        });
        
        // Prevent keyboard events from closing the modal
        const preventKeydown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Allow only the buttons to be focused/activated
            if (e.key === 'Tab') {
                const focusableElements = prompt.querySelectorAll('button');
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                    }
                }
            }
        };
        
        const preventKeyup = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        
        // Add keyboard event listeners
        document.addEventListener('keydown', preventKeydown, true);
        document.addEventListener('keyup', preventKeyup, true);
        
        // Store cleanup function
        prompt.cleanup = () => {
            document.removeEventListener('keydown', preventKeydown, true);
            document.removeEventListener('keyup', preventKeyup, true);
        };
        
        // Add to page and fade in
        document.body.appendChild(prompt);
        setTimeout(() => {
            prompt.style.opacity = '1';
        }, 100);
    }
    
    showResumeIndicator(resumedTime) {
        const minutes = Math.floor(resumedTime / 60);
        const seconds = Math.floor(resumedTime % 60);
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        let indicator = this.container.querySelector('.resume-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'resume-indicator';
            indicator.style.cssText = `
                background: #28a745;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                margin-top: 10px;
                text-align: center;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            
            const playerWrapper = this.container.querySelector('.secure-audio-player-wrapper');
            if (playerWrapper) {
                playerWrapper.appendChild(indicator);
            }
        }
        
        indicator.innerHTML = `✓ Resumed from ${timeString}`;
        indicator.style.opacity = '1';
        
        // Fade out after 3 seconds
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator && indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 300);
        }, 3000);
    }
    
    clearSavedProgress() {
        try {
            localStorage.removeItem(this.getStorageKey());
        } catch (error) {
            // Ignore errors
        }
    }
    
    detectOldDevice() {
        // Detect devices that might have memory/performance issues with large audio files
        const userAgent = navigator.userAgent.toLowerCase();
        
        // Detect truly old Android versions (1-4) - these are genuinely old
        const isOldAndroid = /android [1-4]/.test(userAgent);
        
        // Detect old iOS versions (1-11) - iOS 12+ is generally modern enough for Web Audio API
        const isOldIOS = /os [1-9]_/.test(userAgent) || /os 1[0-1]_/.test(userAgent) || /iphone os [1-9]_/.test(userAgent);
        
        // Detect old Safari versions (Safari 10 and below)
        const isOldSafari = /version\/[1-9]\./.test(userAgent) || /version\/10\./.test(userAgent);
        
        // Detect old Chrome versions (Chrome 60 and below)
        const isOldChrome = /chrome\/[1-5][0-9]/.test(userAgent) || /chrome\/6[0-9]/.test(userAgent);
        
        // Check for limited memory - be more conservative for mobile devices
        const hasLimitedMemory = navigator.deviceMemory && navigator.deviceMemory <= 2;
        
        // Check for old Web Audio API support
        const hasOldWebAudio = !window.AudioContext && !window.webkitAudioContext;
        
        // Check for old browser features
        const hasOldFeatures = !window.fetch || !window.Promise || !window.Array.from;
        
        // Check for very old screen resolutions (likely old devices)
        const hasOldScreen = window.screen && (window.screen.width <= 320 || window.screen.height <= 480);
        
        return isOldAndroid || isOldIOS || isOldSafari || isOldChrome || hasLimitedMemory || hasOldWebAudio || hasOldFeatures || hasOldScreen;
    }
    
    // New method to determine if we should use safe mode for large files
    shouldUseSafeModeForLargeFiles() {
        // Always use safe mode for iOS devices (iPhones crash with Web Audio API on large files)
        if (this.isIOSDevice()) {
            return true; // Always use HTML5 audio on iOS for stability
        }
        
        // Always use safe mode for large files on mobile devices
        if (this.isMobileDevice()) {
            return this.isLargeFile;
        }
        
        // For desktop, only use safe mode for very large files (>50MB)
        return this.isLargeFile && this.fileSize > 50 * 1024 * 1024;
    }
    
    // Detect iOS devices specifically
    isIOSDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        return /iphone|ipad|ipod/.test(userAgent) || 
               (navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform));
    }
    
    getOptimalChunkSize() {
        // Use smaller chunks for older devices to reduce memory usage
        if (this.isOldDevice) {
            return 4096; // 4KB chunks instead of 8KB
        }
        return 8192; // Default 8KB chunks
    }
    
    shouldUseHTML5Fallback() {
        // Force HTML5 audio for older devices as it's more memory efficient
        return this.isOldDevice;
    }
    
    // Network error handling methods
    checkNetworkStatus() {
        return navigator.onLine;
    }
    
    async handleNetworkError(error, operation = 'audio operation') {
        this.networkErrorCount++;
        this.isOffline = !this.checkNetworkStatus();
        
        // console.log(`Network error in ${operation}:`, error);
        
        if (this.isOffline) {
            this.showOfflineMessage();
        } else if (this.networkErrorCount <= this.maxRetries) {
            this.showRetryMessage(operation);
        } else {
            this.showPermanentError(operation);
        }
        
        // Reset error count after successful operation
        setTimeout(() => {
            if (this.checkNetworkStatus()) {
                this.networkErrorCount = Math.max(0, this.networkErrorCount - 1);
            }
        }, 30000); // Reduce error count after 30 seconds
    }
    
    showOfflineMessage() {
        this.hideLoading();
        
        let offlineMessage = this.container.querySelector('.offline-message');
        if (!offlineMessage) {
            offlineMessage = document.createElement('div');
            offlineMessage.className = 'offline-message';
            offlineMessage.innerHTML = `
                <div class="offline-content">
                    <div class="offline-icon">📡</div>
                    <h3>You're currently offline</h3>
                    <p>Please check your internet connection and try again.</p>
                    <button class="retry-btn" onclick="window.location.reload()">Refresh Page</button>
                </div>
            `;
            
            // Style the offline message
            offlineMessage.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                border-radius: 8px;
            `;
            
            const content = offlineMessage.querySelector('.offline-content');
            content.style.cssText = `
                text-align: center;
                padding: 30px;
                max-width: 300px;
            `;
            
            const icon = offlineMessage.querySelector('.offline-icon');
            icon.style.cssText = `
                font-size: 48px;
                margin-bottom: 15px;
            `;
            
            const heading = offlineMessage.querySelector('h3');
            heading.style.cssText = `
                margin: 0 0 10px 0;
                color: #333;
                font-size: 18px;
            `;
            
            const paragraph = offlineMessage.querySelector('p');
            paragraph.style.cssText = `
                margin: 0 0 20px 0;
                color: #666;
                line-height: 1.4;
            `;
            
            const retryBtn = offlineMessage.querySelector('.retry-btn');
            retryBtn.style.cssText = `
                background: #0073aa;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.3s ease;
            `;
            
            retryBtn.onmouseover = () => retryBtn.style.background = '#005a87';
            retryBtn.onmouseout = () => retryBtn.style.background = '#0073aa';
            
            this.container.appendChild(offlineMessage);
        }
    }
    
    showRetryMessage(operation) {
        this.hideLoading();
        
        let retryMessage = this.container.querySelector('.retry-message');
        if (!retryMessage) {
            retryMessage = document.createElement('div');
            retryMessage.className = 'retry-message';
            retryMessage.innerHTML = `
                <div class="retry-content">
                    <div class="retry-icon">⚠️</div>
                    <h3>Connection Issue</h3>
                    <p>Having trouble ${operation}. Retrying...</p>
                    <div class="retry-progress">
                        <div class="retry-spinner"></div>
                    </div>
                    <button class="retry-btn manual-retry">Try Again</button>
                </div>
            `;
            
            // Style the retry message
            retryMessage.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                border-radius: 8px;
            `;
            
            const content = retryMessage.querySelector('.retry-content');
            content.style.cssText = `
                text-align: center;
                padding: 30px;
                max-width: 300px;
            `;
            
            const icon = retryMessage.querySelector('.retry-icon');
            icon.style.cssText = `
                font-size: 48px;
                margin-bottom: 15px;
            `;
            
            const heading = retryMessage.querySelector('h3');
            heading.style.cssText = `
                margin: 0 0 10px 0;
                color: #333;
                font-size: 18px;
            `;
            
            const paragraph = retryMessage.querySelector('p');
            paragraph.style.cssText = `
                margin: 0 0 20px 0;
                color: #666;
                line-height: 1.4;
            `;
            
            const spinner = retryMessage.querySelector('.retry-spinner');
            spinner.style.cssText = `
                width: 20px;
                height: 20px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #0073aa;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px auto;
            `;
            
            const retryBtn = retryMessage.querySelector('.retry-btn');
            retryBtn.style.cssText = `
                background: #0073aa;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.3s ease;
            `;
            
            retryBtn.onmouseover = () => retryBtn.style.background = '#005a87';
            retryBtn.onmouseout = () => retryBtn.style.background = '#0073aa';
            
            retryBtn.addEventListener('click', () => {
                this.hideRetryMessage();
                this.retryOperation();
            });
            
            this.container.appendChild(retryMessage);
            
            // Auto-retry after 3 seconds
            setTimeout(() => {
                if (retryMessage && retryMessage.parentNode) {
                    this.hideRetryMessage();
                    this.retryOperation();
                }
            }, 3000);
        }
    }
    
    showPermanentError(operation) {
        this.hideLoading();
        
        let errorMessage = this.container.querySelector('.permanent-error');
        if (!errorMessage) {
            errorMessage = document.createElement('div');
            errorMessage.className = 'permanent-error';
            errorMessage.innerHTML = `
                <div class="error-content">
                    <div class="error-icon">❌</div>
                    <h3>Unable to Load Audio</h3>
                    <p>We're having trouble loading the audio file. This might be due to network issues or server problems.</p>
                    <div class="error-actions">
                        <button class="retry-btn" onclick="window.location.reload()">Refresh Page</button>
                        <button class="retry-btn secondary" onclick="this.closest('.permanent-error').remove()">Dismiss</button>
                    </div>
                </div>
            `;
            
            // Style the error message
            errorMessage.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                border-radius: 8px;
            `;
            
            const content = errorMessage.querySelector('.error-content');
            content.style.cssText = `
                text-align: center;
                padding: 30px;
                max-width: 350px;
            `;
            
            const icon = errorMessage.querySelector('.error-icon');
            icon.style.cssText = `
                font-size: 48px;
                margin-bottom: 15px;
            `;
            
            const heading = errorMessage.querySelector('h3');
            heading.style.cssText = `
                margin: 0 0 10px 0;
                color: #333;
                font-size: 18px;
            `;
            
            const paragraph = errorMessage.querySelector('p');
            paragraph.style.cssText = `
                margin: 0 0 20px 0;
                color: #666;
                line-height: 1.4;
            `;
            
            const actions = errorMessage.querySelector('.error-actions');
            actions.style.cssText = `
                display: flex;
                gap: 10px;
                justify-content: center;
            `;
            
            const buttons = errorMessage.querySelectorAll('.retry-btn');
            buttons.forEach(btn => {
                btn.style.cssText = `
                    background: ${btn.classList.contains('secondary') ? '#666' : '#0073aa'};
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.3s ease;
                `;
                
                btn.onmouseover = () => {
                    btn.style.background = btn.classList.contains('secondary') ? '#555' : '#005a87';
                };
                btn.onmouseout = () => {
                    btn.style.background = btn.classList.contains('secondary') ? '#666' : '#0073aa';
                };
            });
            
            this.container.appendChild(errorMessage);
        }
    }
    
    hideRetryMessage() {
        const retryMessage = this.container.querySelector('.retry-message');
        if (retryMessage) {
            retryMessage.remove();
        }
    }
    
    hideOfflineMessage() {
        const offlineMessage = this.container.querySelector('.offline-message');
        if (offlineMessage) {
            offlineMessage.remove();
        }
    }
    
    hideErrorMessages() {
        this.hideRetryMessage();
        this.hideOfflineMessage();
        const permanentError = this.container.querySelector('.permanent-error');
        if (permanentError) {
            permanentError.remove();
        }
    }
    
    async retryOperation() {
        this.retryAttempts++;
        
        // Clear any existing error messages
        this.hideErrorMessages();
        
        // Show loading state
        this.showLoading();
        
        try {
            // Retry the initialization
            await this.loadAudioMetadata();
            this.retryAttempts = 0; // Reset on success
        } catch (error) {
            await this.handleNetworkError(error, 'loading audio metadata');
        }
    }
    
    setupNetworkMonitoring() {
        // Monitor online/offline status
        window.addEventListener('online', () => {
            this.isOffline = false;
            this.networkErrorCount = 0; // Reset error count when back online
            
            // If we have error messages showing, try to recover
            const hasErrorMessages = this.container.querySelector('.offline-message, .retry-message, .permanent-error');
            if (hasErrorMessages) {
                this.hideErrorMessages();
                this.retryOperation();
            }
        });
        
        window.addEventListener('offline', () => {
            this.isOffline = true;
            this.showOfflineMessage();
        });
        
        // Monitor fetch errors globally
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                const response = await originalFetch(...args);
                
                // Reset error count on successful requests
                if (response.ok) {
                    this.networkErrorCount = Math.max(0, this.networkErrorCount - 1);
                }
                
                return response;
            } catch (error) {
                // Handle fetch errors
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    this.networkErrorCount++;
                    if (!this.isOffline && this.networkErrorCount <= this.maxRetries) {
                        // Retry the fetch after a delay
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        return originalFetch(...args);
                    }
                }
                throw error;
            }
        };
    }
    
    cleanup() {
        // Save final progress before cleanup
        this.saveProgress();
        
        // Stop progress saving
        this.stopProgressSaving();
        
        // Release wake lock first
        this.releaseWakeLock();
        
        // Clean up HTML5 audio element
        if (this.html5Audio) {
            this.html5Audio.pause();
            this.html5Audio.src = ''; // Clear source to free memory
            this.html5Audio.remove();
            this.html5Audio = null;
        }
        
        // Clean up Web Audio API resources
        if (this.source) {
            try {
                this.source.stop();
            } catch (e) {
                // Source might already be stopped
            }
            this.source.disconnect();
            this.source = null;
        }
        
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.audioBuffer = null;
        this.bufferedChunks.clear();
        
        // Force garbage collection hint for older devices
        if (this.isOldDevice && window.gc) {
            window.gc();
        }
    }
    
    // Memory management for older devices and iOS
    forceMemoryCleanup() {
        if (this.isOldDevice || this.isIOSDevice()) {
            // Clear any cached data
            this.bufferedChunks.clear();
            
            // Reset audio buffer to free memory
            if (this.audioBuffer) {
                this.audioBuffer = null;
            }
            
            // iOS-specific memory cleanup
            if (this.isIOSDevice()) {
                // Force audio context to close and reopen to free memory
                if (this.audioContext && this.audioContext.state !== 'closed') {
                    this.audioContext.close();
                    this.audioContext = null;
                }
            }
            
            // Force garbage collection if available
            if (window.gc) {
                window.gc();
            }
        }
    }
}

// Export for use in other files
window.SecureAudioPlayer = SecureAudioPlayer;
