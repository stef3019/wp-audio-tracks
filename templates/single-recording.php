<?php
/**
 * Single Recording Template
 * 
 * This template displays a single recording with secure audio playback
 * that prevents downloading of the audio file.
 */

get_header(); ?>

<?php 
// Add Open Graph meta tags for social media sharing
global $post;
if ($post && $post->post_type === 'recording') :
    
    // Get post data without calling the_post() to avoid interfering with main loop
    $post_title = get_the_title($post->ID);
    $post_url = get_permalink($post->ID);
    $session = get_post_meta($post->ID, '_recording_session', true);
    $speaker = get_post_meta($post->ID, '_recording_speaker', true);
    $post_content = $post->post_content;

    // Create description from session + speaker + content
    $og_description = '';
    if (!empty($session)) {
        $og_description .= $session;
    }
    if (!empty($speaker)) {
        if (!empty($og_description)) {
            $og_description .= ' - ';
        }
        $og_description .= $speaker;
    }

    if (!empty($post_content)) {
        if (!empty($og_description)) {
            $og_description .= ' - ';
        }
        // Strip HTML tags and limit length
        $clean_content = wp_strip_all_tags($post_content);
        $og_description .= $clean_content;
    }
    
    // Limit description length for social media (optimal is 155-160 characters)
    if (strlen($og_description) > 155) {
        $og_description = substr($og_description, 0, 152) . '...';
    }
    
    // Get featured image
    $og_image = '';
    if (has_post_thumbnail($post->ID)) {
        $thumbnail_id = get_post_thumbnail_id($post->ID);
        $og_image = wp_get_attachment_image_url($thumbnail_id, 'large');
    }
    
    // Get site name and description
    $site_name = get_bloginfo('name');
    $site_description = get_bloginfo('description');
    
    // Output Open Graph meta tags
    echo '<meta property="og:type" content="article" />' . "\n";
    echo '<meta property="og:title" content="' . esc_attr($post_title) . '" />' . "\n";
    echo '<meta property="og:description" content="' . esc_attr($og_description) . '" />' . "\n";
    echo '<meta property="og:url" content="' . esc_url($post_url) . '" />' . "\n";
    echo '<meta property="og:site_name" content="' . esc_attr($site_name) . '" />' . "\n";
    
    if (!empty($og_image)) {
        echo '<meta property="og:image" content="' . esc_url($og_image) . '" />' . "\n";
        echo '<meta property="og:image:width" content="1200" />' . "\n";
        echo '<meta property="og:image:height" content="630" />' . "\n";
        echo '<meta property="og:image:alt" content="' . esc_attr($post_title) . '" />' . "\n";
    }
    
    // Twitter Card meta tags
    echo '<meta name="twitter:card" content="summary_large_image" />' . "\n";
    echo '<meta name="twitter:title" content="' . esc_attr($post_title) . '" />' . "\n";
    echo '<meta name="twitter:description" content="' . esc_attr($og_description) . '" />' . "\n";
    if (!empty($og_image)) {
        echo '<meta name="twitter:image" content="' . esc_url($og_image) . '" />' . "\n";
    }
    
    // Additional meta tags
    echo '<meta property="article:published_time" content="' . get_the_date('c', $post->ID) . '" />' . "\n";
    echo '<meta property="article:modified_time" content="' . get_the_modified_date('c', $post->ID) . '" />' . "\n";
    
    // Add section tags
    $sections = get_the_terms($post->ID, 'section');
    if ($sections && !is_wp_error($sections)) {
        foreach ($sections as $section) {
            echo '<meta property="article:tag" content="' . esc_attr($section->name) . '" />' . "\n";
        }
    }
endif;
?>

<div class="wp-audio-tracks-container">
    <div class="theme-toggle-container">
        <button class="theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
            <span class="theme-toggle-icon light-icon">☀️</span>
            <span class="theme-toggle-icon dark-icon">🌙</span>
        </button>
    </div>
    
    <div class="recording-content">
        
        <?php while (have_posts()) : the_post(); ?>
            
            <article id="post-<?php the_ID(); ?>" <?php post_class('recording-single'); ?>>
                
                <header class="recording-header">
                    <h1 class="recording-title"><?php the_title(); ?></h1>
                </header>
                
                <?php 
                $recording_file = get_post_meta(get_the_ID(), '_recording_file', true);
                if (!empty($recording_file)) : ?>
                    
                    <div class="recording-player-container">
                        <div class="player-header">
                          
                            <div class="security-icon">🔒</div>
                        </div>
                        
                        <div class="secure-audio-player" data-recording-id="<?php echo get_the_ID(); ?>">
                            <audio 
                                id="secure-audio-<?php echo get_the_ID(); ?>" 
                                controls 
                                preload="metadata"
                                style="width: 100%; max-width: 600px;"
                                oncontextmenu="return false;"
                                onselectstart="return false;"
                            >
                                <source src="" type="audio/mpeg">
                                <?php _e('Your browser does not support the audio element.', 'wp-audio-tracks'); ?>
                            </audio>
                        </div>
                    </div>
                    
                <?php else : ?>
                    <div class="no-recording-message">
                        <p><?php _e('No audio recording available for this item.', 'wp-audio-tracks'); ?></p>
                    </div>
                <?php endif; ?>
                
                <div class="recording-details">
                    <?php 
                    $session = get_post_meta(get_the_ID(), '_recording_session', true);
                    if (!empty($session)) : ?>
                        <div class="recording-session">
                            <strong><?php _e('Session:', 'wp-audio-tracks'); ?></strong> 
                            <span><?php echo esc_html($session); ?></span>
                        </div>
                    <?php endif; ?>
                    
                    <?php 
                    $speaker = get_post_meta(get_the_ID(), '_recording_speaker', true);
                    if (!empty($speaker)) : ?>
                        <div class="recording-speaker">
                            <strong><?php _e('Speaker:', 'wp-audio-tracks'); ?></strong> 
                            <span><?php echo esc_html($speaker); ?></span>
                        </div>
                    <?php endif; ?>
                    
                    <?php 
                    $sections = get_the_terms(get_the_ID(), 'section');
                    if ($sections && !is_wp_error($sections)) : ?>
                        <div class="recording-sections">
                            <strong><?php _e('Section(s):', 'wp-audio-tracks'); ?></strong>
                            <?php 
                            $section_links = array();
                            foreach ($sections as $section) {
                                $section_links[] = '<a href="' . get_term_link($section) . '">' . esc_html($section->name) . '</a>';
                            }
                            echo implode(', ', $section_links);
                            ?>
                        </div>
                    <?php endif; ?>
                    
                    <div class="recording-description">
                        <?php the_content(); ?>
                    </div>
                </div>
                
                <?php if (has_post_thumbnail()) : ?>
                    <div class="recording-thumbnail">
                        <?php the_post_thumbnail('large'); ?>
                    </div>
                <?php endif; ?>
                
                <footer class="recording-footer">
                    <div class="recording-meta">
                        <span class="recording-date">
                            <?php _e('Published:', 'wp-audio-tracks'); ?> 
                            <time datetime="<?php echo get_the_date('c'); ?>">
                                <?php echo get_the_date(); ?>
                            </time>
                        </span>
                        
                        <?php 
                        $play_count = get_post_meta(get_the_ID(), '_recording_play_count', true);
                        $play_count = $play_count ? intval($play_count) : 0;
                        ?>
                        <span class="recording-plays">
                            <?php _e('Plays:', 'wp-audio-tracks'); ?> 
                            <span class="play-count" data-recording-id="<?php echo get_the_ID(); ?>">
                                <?php echo number_format($play_count); ?>
                            </span>
                        </span>
                    </div>
                </footer>
                
            </article>
            
            <?php
            // Navigation to other recordings
            $prev_post = get_previous_post(true, '', 'section');
            $next_post = get_next_post(true, '', 'section');
            
            if ($prev_post || $next_post) : ?>
                <nav class="recording-navigation">
                    <div class="nav-links">
                        <?php if ($prev_post) : ?>
                            <div class="nav-previous">
                                <a href="<?php echo get_permalink($prev_post->ID); ?>" rel="prev">
                                    <span class="nav-subtitle"><?php _e('Previous Recording', 'wp-audio-tracks'); ?></span>
                                    <span class="nav-title"><?php echo get_the_title($prev_post->ID); ?></span>
                                </a>
                            </div>
                        <?php endif; ?>
                        
                        <?php if ($next_post) : ?>
                            <div class="nav-next">
                                <a href="<?php echo get_permalink($next_post->ID); ?>" rel="next">
                                    <span class="nav-subtitle"><?php _e('Next Recording', 'wp-audio-tracks'); ?></span>
                                    <span class="nav-title"><?php echo get_the_title($next_post->ID); ?></span>
                                </a>
                            </div>
                        <?php endif; ?>
                    </div>
                </nav>
            <?php endif; ?>
            
        <?php endwhile; ?>
        
    </div>
</div>

<style>
/* Additional inline styles for extra security */
.secure-audio-player audio {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
}

/* Disable text selection on audio element */
.secure-audio-player audio::-webkit-media-controls {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
}

/* Hide download button in some browsers */
.secure-audio-player audio::-webkit-media-controls-enclosure {
    overflow: hidden;
}
</style>

<script>
// Additional security measures
document.addEventListener('DOMContentLoaded', function() {
    // Disable right-click context menu on audio player
    const audioPlayers = document.querySelectorAll('.secure-audio-player audio');
    audioPlayers.forEach(function(audio) {
        audio.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });
        
        // Disable drag and drop
        audio.addEventListener('dragstart', function(e) {
            e.preventDefault();
            return false;
        });
        
        // Disable selection
        audio.addEventListener('selectstart', function(e) {
            e.preventDefault();
            return false;
        });
        
        // Prevent keyboard shortcuts for saving
        audio.addEventListener('keydown', function(e) {
            // Disable Ctrl+S, Ctrl+Shift+S, F12, etc.
            if (e.ctrlKey && (e.keyCode === 83 || e.keyCode === 85)) {
                e.preventDefault();
                return false;
            }
            if (e.keyCode === 123) { // F12
                e.preventDefault();
                return false;
            }
        });
    });
    
    // Disable print screen and other shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.keyCode === 44) { // Print Screen
            e.preventDefault();
            return false;
        }
    });
    
    // Disable right-click on the entire page when audio is playing
    let audioPlaying = false;
    audioPlayers.forEach(function(audio) {
        audio.addEventListener('play', function() {
            audioPlaying = true;
        });
        
        audio.addEventListener('pause', function() {
            audioPlaying = false;
        });
        
        audio.addEventListener('ended', function() {
            audioPlaying = false;
        });
    });
    
    document.addEventListener('contextmenu', function(e) {
        if (audioPlaying) {
            e.preventDefault();
            return false;
        }
    });
});
</script>

<?php get_footer(); ?>
