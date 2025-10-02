/**
 * WP Audio Tracks - Admin JavaScript
 * 
 * Handles admin functionality for the recording post type
 */

(function($) {
    'use strict';

    $(document).ready(function() {
        
        // Initialize media uploader
        initMediaUploader();
        
        // Handle recording file management
        handleRecordingFileManagement();
        
        // Validate audio file types
        validateAudioFiles();
        
    });
    
    function initMediaUploader() {
        var mediaUploader;
        
        $('#upload_recording_button').on('click', function(e) {
            e.preventDefault();
            
            // If the uploader object has already been created, reopen the dialog
            if (mediaUploader) {
                mediaUploader.open();
                return;
            }
            
            // Create the media frame
            mediaUploader = wp.media({
                title: 'Choose Audio File',
                button: {
                    text: 'Use this audio file'
                },
                multiple: false,
                library: {
                    type: 'audio' // Only show audio files
                }
            });
            
            // When a file is selected, run a callback
            mediaUploader.on('select', function() {
                var attachment = mediaUploader.state().get('selection').first().toJSON();
                
                // Validate file type
                if (validateAudioFile(attachment)) {
                    $('#recording_file').val(attachment.url);
                    updateRecordingPreview(attachment.url);
                    $('#remove_recording_button').show();
                    
                    // Show success message
                    showAdminMessage('Audio file uploaded successfully!', 'success');
                } else {
                    showAdminMessage('Please select a valid audio file (MP3, WAV, OGG).', 'error');
                }
            });
            
            // Open the uploader dialog
            mediaUploader.open();
        });
        
        // Handle remove button
        $('#remove_recording_button').on('click', function(e) {
            e.preventDefault();
            
            if (confirm('Are you sure you want to remove the audio file?')) {
                $('#recording_file').val('');
                $('#recording_preview').remove();
                $(this).hide();
                showAdminMessage('Audio file removed.', 'success');
            }
        });
        
    }
    
    function handleRecordingFileManagement() {
        
        // Update preview when file URL changes
        $('#recording_file').on('change', function() {
            var url = $(this).val();
            if (url) {
                updateRecordingPreview(url);
                $('#remove_recording_button').show();
            } else {
                $('#recording_preview').remove();
                $('#remove_recording_button').hide();
            }
        });
        
        // Drag and drop support for audio files
        $('#recording_file').on('dragover', function(e) {
            e.preventDefault();
            $(this).closest('td').addClass('drag-over');
        });
        
        $('#recording_file').on('dragleave', function(e) {
            e.preventDefault();
            $(this).closest('td').removeClass('drag-over');
        });
        
        $('#recording_file').on('drop', function(e) {
            e.preventDefault();
            $(this).closest('td').removeClass('drag-over');
            
            var files = e.originalEvent.dataTransfer.files;
            if (files.length > 0) {
                handleFileUpload(files[0]);
            }
        });
        
    }
    
    function validateAudioFiles() {
        
        // Add file type validation to file input if it exists
        $('input[type="file"]').on('change', function() {
            var file = this.files[0];
            if (file && !validateAudioFile({ filename: file.name, mime: file.type })) {
                showAdminMessage('Please select a valid audio file (MP3, WAV, OGG).', 'error');
                this.value = '';
            }
        });
        
    }
    
    function validateAudioFile(attachment) {
        var allowedTypes = [
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/wave',
            'audio/x-wav',
            'audio/ogg',
            'audio/vorbis'
        ];
        
        var allowedExtensions = ['.mp3', '.wav', '.ogg'];
        
        // Check MIME type
        if (attachment.mime && allowedTypes.indexOf(attachment.mime) !== -1) {
            return true;
        }
        
        // Check file extension
        if (attachment.filename) {
            var extension = attachment.filename.toLowerCase().substring(attachment.filename.lastIndexOf('.'));
            if (allowedExtensions.indexOf(extension) !== -1) {
                return true;
            }
        }
        
        return false;
    }
    
    function updateRecordingPreview(url) {
        // Remove existing preview
        $('#recording_preview').remove();
        
        // Create new preview
        var preview = $('<div id="recording_preview">' +
            '<audio controls style="width: 100%; max-width: 400px;">' +
            '<source src="' + url + '" type="audio/mpeg">' +
            'Your browser does not support the audio element.' +
            '</audio>' +
            '</div>');
        
        $('#recording_file').after(preview);
    }
    
    function handleFileUpload(file) {
        if (!validateAudioFile({ filename: file.name, mime: file.type })) {
            showAdminMessage('Please select a valid audio file (MP3, WAV, OGG).', 'error');
            return;
        }
        
        // Create FormData for file upload
        var formData = new FormData();
        formData.append('action', 'upload_audio_file');
        formData.append('audio_file', file);
        formData.append('nonce', wpAudioTracksAdmin.nonce);
        
        // Show loading state
        showAdminMessage('Uploading audio file...', 'info');
        
        // Upload file via AJAX
        $.ajax({
            url: wpAudioTracksAdmin.ajaxUrl,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    $('#recording_file').val(response.data.url);
                    updateRecordingPreview(response.data.url);
                    $('#remove_recording_button').show();
                    showAdminMessage('Audio file uploaded successfully!', 'success');
                } else {
                    showAdminMessage(response.data || 'Upload failed. Please try again.', 'error');
                }
            },
            error: function() {
                showAdminMessage('Upload failed. Please try again.', 'error');
            }
        });
    }
    
    function showAdminMessage(message, type) {
        // Remove existing messages
        $('.wp-audio-tracks-message').remove();
        
        // Create message element
        var messageClass = 'notice notice-' + type + ' is-dismissible wp-audio-tracks-message';
        var messageHtml = '<div class="' + messageClass + '"><p>' + message + '</p></div>';
        
        // Insert message after the title
        $('.wrap h1').after(messageHtml);
        
        // Auto-dismiss after 5 seconds
        setTimeout(function() {
            $('.wp-audio-tracks-message').fadeOut(300, function() {
                $(this).remove();
            });
        }, 5000);
        
        // Make dismissible
        $('.wp-audio-tracks-message').on('click', '.notice-dismiss', function() {
            $(this).closest('.wp-audio-tracks-message').fadeOut(300, function() {
                $(this).remove();
            });
        });
    }
    
    // Add custom CSS for drag and drop
    $('<style>')
        .prop('type', 'text/css')
        .html(`
            .drag-over {
                background-color: #f0f8ff !important;
                border: 2px dashed #0073aa !important;
            }
            
            #recording_file {
                transition: all 0.3s ease;
            }
            
            .wp-audio-tracks-message {
                margin: 10px 0;
            }
            
            .notice-dismiss {
                position: relative;
                top: 0;
                right: 0;
                padding: 9px;
                margin: 0;
                border: none;
                background: none;
                cursor: pointer;
                color: #787c82;
            }
            
            .notice-dismiss:before {
                background: none;
                color: #787c82;
                content: "\\f153";
                display: block;
                font: normal 16px/20px dashicons;
                speak: none;
                height: 20px;
                text-align: center;
                width: 20px;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
        `)
        .appendTo('head');
    
    // Add file size validation
    function validateFileSize(file) {
        var maxSize = 50 * 1024 * 1024; // 50MB limit
        if (file.size > maxSize) {
            showAdminMessage('File size too large. Maximum allowed size is 50MB.', 'error');
            return false;
        }
        return true;
    }
    
    // Enhanced file validation
    $('input[type="file"]').on('change', function() {
        var file = this.files[0];
        if (file) {
            if (!validateFileSize(file)) {
                this.value = '';
                return;
            }
            
            if (!validateAudioFile({ filename: file.name, mime: file.type })) {
                showAdminMessage('Please select a valid audio file (MP3, WAV, OGG).', 'error');
                this.value = '';
            }
        }
    });

})(jQuery);
