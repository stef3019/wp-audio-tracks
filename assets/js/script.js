/**
 * WP Audio Tracks - Frontend JavaScript
 * 
 * Handles secure audio playback and additional security measures
 */

(function($) {
    'use strict';

    $(document).ready(function() {
        
        // Initialize theme toggle
        initThemeToggle();
        
        // Initialize secure audio players
        initSecureAudioPlayers();
        
        // Add additional security measures
        addSecurityMeasures();
        
        // Handle audio player events
        handleAudioEvents();
        
    });
    
    function initThemeToggle() {
        // Check for saved theme preference or detect system preference
        var savedTheme = localStorage.getItem('wp-audio-tracks-theme');
        var currentTheme;
        
        if (savedTheme) {
            // Use saved preference
            currentTheme = savedTheme;
        } else {
            // Detect system preference
            currentTheme = detectSystemTheme();
        }
        
        // Apply the theme
        applyTheme(currentTheme);
        
        // Update toggle button state
        updateToggleButtonState(!savedTheme);
        
        // Set up click handler for theme toggle
        $('#theme-toggle').on('click', function() {
            var body = $('body');
            var newTheme = body.hasClass('dark-mode') ? 'light' : 'dark';
            
            applyTheme(newTheme);
            localStorage.setItem('wp-audio-tracks-theme', newTheme);
            
            // Remove system mode indicator since user manually set preference
            updateToggleButtonState(false);
        });
        
        // Listen for system theme changes (when user changes system preference)
        if (window.matchMedia) {
            var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addListener(function(e) {
                // Only update if user hasn't manually set a preference
                if (!localStorage.getItem('wp-audio-tracks-theme')) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }
    
    function updateToggleButtonState(isSystemMode) {
        var $toggle = $('#theme-toggle');
        
        if (isSystemMode) {
            $toggle.addClass('system-mode');
        } else {
            $toggle.removeClass('system-mode');
        }
    }
    
    function detectSystemTheme() {
        // Check if the browser supports prefers-color-scheme
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        
        // Fallback: check if user has dark mode enabled in other ways
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        
        // Default fallback to light mode if no system preference detected
        return 'light';
    }
    
    function applyTheme(theme) {
        var body = $('body');
        
        if (theme === 'dark') {
            body.addClass('dark-mode');
            // Also apply to html element to ensure full coverage
            $('html').addClass('dark-mode');
        } else {
            body.removeClass('dark-mode');
            $('html').removeClass('dark-mode');
        }
    }
    
    function initSecureAudioPlayers() {
        $('.secure-audio-player').each(function() {
            var $player = $(this);
            var recordingId = $player.data('recording-id');
            
            if (recordingId && typeof SecureAudioPlayer !== 'undefined') {
                // Initialize the secure audio player
                var securePlayer = new SecureAudioPlayer($player[0], {
                    recordingId: recordingId,
                    serverUrl: wpAudioTracks.siteUrl.replace(/\/$/, ''), // Remove trailing slash
                    chunkSize: 8192,
                    bufferSize: 1024 * 1024
                });
                
                // Store reference for cleanup
                $player.data('secure-player', securePlayer);
                
                // console.log('WP Audio Tracks: Initialized secure player for recording:', recordingId);
            } else {
                console.warn('WP Audio Tracks: SecureAudioPlayer not available, falling back to HTML5 audio');
                initFallbackAudioPlayer($player);
            }
        });
    }
    
    function initFallbackAudioPlayer($player) {
        var recordingId = $player.data('recording-id');
        var $audio = $player.find('audio');
        
        if ($audio.length) {
            // Set secure source URL using the rewrite rule format
            var secureUrl = wpAudioTracks.siteUrl + '/secure-audio/' + recordingId + '/';
            // console.log('WP Audio Tracks: Setting fallback audio source to:', secureUrl);
            
            $audio.attr('src', secureUrl);
            
            // Add additional security attributes
            $audio.attr('controlsList', 'nodownload');
            $audio.attr('disablePictureInPicture', 'true');
            $audio.attr('controlsList', 'nodownload nofullscreen noremoteplayback');
        }
    }
    
    function addSecurityMeasures() {
        
        // Disable right-click context menu globally when audio is playing
        var audioPlaying = false;
        
        $(document).on('contextmenu', function(e) {
            if (audioPlaying) {
                e.preventDefault();
                showSecurityMessage();
                return false;
            }
        });
        
        // Disable keyboard shortcuts
        $(document).on('keydown', function(e) {
            // Disable F12 (Developer Tools)
            if (e.keyCode === 123) {
                e.preventDefault();
                showSecurityMessage();
                return false;
            }
            
            // Disable Ctrl+Shift+I (Developer Tools)
            if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
                e.preventDefault();
                showSecurityMessage();
                return false;
            }
            
            // Disable Ctrl+U (View Source)
            if (e.ctrlKey && e.keyCode === 85) {
                e.preventDefault();
                showSecurityMessage();
                return false;
            }
            
            // Disable Ctrl+S (Save)
            if (e.ctrlKey && e.keyCode === 83) {
                e.preventDefault();
                showSecurityMessage();
                return false;
            }
            
            // Disable Ctrl+A (Select All) when audio is playing
            if (audioPlaying && e.ctrlKey && e.keyCode === 65) {
                e.preventDefault();
                return false;
            }
            
            // Disable Print Screen
            if (e.keyCode === 44) {
                e.preventDefault();
                showSecurityMessage();
                return false;
            }
        });
        
        // Disable drag and drop
        $(document).on('dragstart dragover drop', function(e) {
            e.preventDefault();
            return false;
        });
        
        // Disable text selection when audio is playing
        $(document).on('selectstart', function(e) {
            if (audioPlaying) {
                e.preventDefault();
                return false;
            }
        });
        
        // Monitor audio playing state
        $('audio').on('play', function() {
            audioPlaying = true;
            $('body').addClass('audio-playing');
        });
        
        $('audio').on('pause ended', function() {
            audioPlaying = false;
            $('body').removeClass('audio-playing');
        });
        
        // Disable print functionality
        $(window).on('beforeprint', function() {
            // Hide audio players before printing
            $('.secure-audio-player').hide();
        });
        
        $(window).on('afterprint', function() {
            // Show audio players after printing
            $('.secure-audio-player').show();
        });
        
        // Disable screenshot attempts (basic protection)
        $(document).on('keydown', function(e) {
            // Alt+Print Screen
            if (e.altKey && e.keyCode === 44) {
                e.preventDefault();
                showSecurityMessage();
                return false;
            }
        });
        
    }
    
    function handleAudioEvents() {
        
        // Prevent audio element manipulation
        $('audio').on('loadstart', function(e) {
            // Validate the source URL
            var src = $(this).attr('src');
            if (src && !src.includes('secure-audio/')) {
                // If someone tries to load a non-secure URL, redirect to secure URL
                var recordingId = $(this).closest('.secure-audio-player').data('recording-id');
                if (recordingId) {
                    var secureUrl = wpAudioTracks.siteUrl + 'secure-audio/' + recordingId + '/';
                    $(this).attr('src', secureUrl);
                }
            }
        });
        
        // Prevent audio download attempts
        $('audio').on('error', function(e) {
            var audio = this;
            var error = audio.error;
            var errorMessage = 'Audio loading error - this may be due to security restrictions';
            
            if (error) {
                switch (error.code) {
                    case MediaError.MEDIA_ERR_ABORTED:
                        errorMessage = 'Audio loading was aborted';
                        break;
                    case MediaError.MEDIA_ERR_NETWORK:
                        errorMessage = 'Network error occurred while loading audio';
                        break;
                    case MediaError.MEDIA_ERR_DECODE:
                        errorMessage = 'Audio decoding error occurred';
                        break;
                    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMessage = 'Audio format not supported or file not found';
                        break;
                    default:
                        errorMessage = 'Unknown audio error occurred';
                        break;
                }
            }
            
            // console.log('WP Audio Tracks Error:', errorMessage);
            // console.log('WP Audio Tracks Error Details:', error);
            // console.log('WP Audio Tracks Audio Source:', audio.src);
            
            // Show user-friendly error message
            var $player = $(audio).closest('.secure-audio-player');
            if ($player.length) {
                $player.append('<div class="audio-error-message" style="color: #dc3545; margin-top: 10px; padding: 10px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">Error loading audio: ' + errorMessage + '</div>');
            }
        });
        
        // Add loading state
        $('audio').on('loadstart', function() {
            $(this).closest('.secure-audio-player').addClass('loading');
        });
        
        $('audio').on('canplay', function() {
            $(this).closest('.secure-audio-player').removeClass('loading');
        });
        
    }
    
    function showSecurityMessage() {
        // Create a temporary security message
        var $message = $('<div class="security-message">Audio content is protected. Downloading is not allowed.</div>');
        
        // Style the message
        $message.css({
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#dc3545',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '4px',
            zIndex: 9999,
            fontSize: '14px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
        });
        
        // Add to page
        $('body').append($message);
        
        // Remove after 3 seconds
        setTimeout(function() {
            $message.fadeOut(300, function() {
                $message.remove();
            });
        }, 3000);
    }
    
    // Additional security: Monitor for developer tools
    var devtools = {
        open: false,
        orientation: null
    };
    
    var threshold = 160;
    
    setInterval(function() {
        if (window.outerHeight - window.innerHeight > threshold || 
            window.outerWidth - window.innerWidth > threshold) {
            if (!devtools.open) {
                devtools.open = true;
                // Developer tools opened - show warning
                showSecurityMessage();
            }
        } else {
            devtools.open = false;
        }
    }, 500);
    
    // Disable image saving
    $(document).on('contextmenu', 'img', function(e) {
        e.preventDefault();
        showSecurityMessage();
        return false;
    });
    
    // Disable video controls if any video elements exist
    $('video').each(function() {
        $(this).attr('controlsList', 'nodownload');
        $(this).attr('disablePictureInPicture', 'true');
    });
    
    // Monitor for iframe attempts (additional security)
    if (window.top !== window.self) {
        // Page is in an iframe - redirect to top
        window.top.location = window.self.location;
    }
    
    // Disable text selection on audio elements
    $('audio').css({
        '-webkit-user-select': 'none',
        '-moz-user-select': 'none',
        '-ms-user-select': 'none',
        'user-select': 'none'
    });
    
    // Add CSS to prevent selection
    $('<style>')
        .prop('type', 'text/css')
        .html(`
            .secure-audio-player audio {
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
                user-select: none !important;
            }
            
            .audio-playing {
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
                user-select: none !important;
            }
            
            .loading::after {
                content: 'Loading...';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 10px;
                border-radius: 4px;
                font-size: 14px;
            }
        `)
        .appendTo('head');

})(jQuery);
