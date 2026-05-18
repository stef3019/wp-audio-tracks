<?php
/**
 * Single Recording Template
 *
 * Displays a single recording with secure audio playback.
 */

get_header(); ?>

<div class="wp-audio-tracks-container wat-recording-page">
    <div class="theme-toggle-container">
        <button class="theme-toggle" id="theme-toggle" aria-label="<?php esc_attr_e('Toggle dark mode', 'wp-audio-tracks'); ?>">
            <span class="theme-toggle-icon light-icon" aria-hidden="true">&#9728;&#65039;</span>
            <span class="theme-toggle-icon dark-icon" aria-hidden="true">&#127769;</span>
        </button>
    </div>

    <div class="recording-content">
        <?php while (have_posts()) : the_post(); ?>

            <?php
            $session  = get_post_meta(get_the_ID(), '_recording_session', true);
            $speaker  = get_post_meta(get_the_ID(), '_recording_speaker', true);
            $sections = get_the_terms(get_the_ID(), 'section');
            $section_names = array();
            if ($sections && !is_wp_error($sections)) {
                foreach ($sections as $section) {
                    $section_names[] = $section->name;
                }
            }
            $sections_text = implode(', ', $section_names);
            $recording_file = get_post_meta(get_the_ID(), '_recording_file', true);
            ?>

            <article id="post-<?php the_ID(); ?>" <?php post_class('recording-single wat-recording-layout'); ?>>

                <header class="wat-top-bar">
                    <h1 class="wat-top-title"><?php esc_html_e('Playing', 'wp-audio-tracks'); ?></h1>
                </header>

                <main class="wat-main">
                    <div class="wat-hero">
                        <div class="wat-hero-gradient" aria-hidden="true"></div>
                        <?php if (has_post_thumbnail()) : ?>
                            <?php the_post_thumbnail('large', array('alt' => esc_attr(get_the_title()))); ?>
                        <?php else : ?>
                            <div class="wat-hero-placeholder" aria-hidden="true"></div>
                        <?php endif; ?>
                    </div>

                    <div class="wat-metadata">
                        <h2 class="wat-title"><?php the_title(); ?></h2>
                        <?php if ($session || $speaker || $sections_text) : ?>
                            <div class="wat-pills">
                                <?php if ($session) : ?>
                                    <div class="wat-pill">
                                        <span class="wat-pill-label"><?php esc_html_e('Session', 'wp-audio-tracks'); ?></span>
                                        <?php echo esc_html($session); ?>
                                    </div>
                                <?php endif; ?>
                                <?php if ($speaker) : ?>
                                    <div class="wat-pill">
                                        <span class="wat-pill-label"><?php esc_html_e('Speaker', 'wp-audio-tracks'); ?></span>
                                        <?php echo esc_html($speaker); ?>
                                    </div>
                                <?php endif; ?>
                                <?php if ($sections_text) : ?>
                                    <div class="wat-pill">
                                        <span class="wat-pill-label"><?php esc_html_e('Sections', 'wp-audio-tracks'); ?></span>
                                        <?php echo esc_html($sections_text); ?>
                                    </div>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                    </div>

                    <?php if (!empty($recording_file)) : ?>
                        <div class="recording-player-container wat-player-shell">
                            <div class="secure-audio-player" data-recording-id="<?php echo esc_attr(get_the_ID()); ?>">
                                <audio
                                    id="secure-audio-<?php echo esc_attr(get_the_ID()); ?>"
                                    preload="metadata"
                                    oncontextmenu="return false;"
                                    onselectstart="return false;"
                                >
                                    <source src="" type="audio/mpeg">
                                    <?php esc_html_e('Your browser does not support the audio element.', 'wp-audio-tracks'); ?>
                                </audio>
                            </div>
                        </div>
                    <?php else : ?>
                        <div class="no-recording-message">
                            <p><?php esc_html_e('No audio recording available for this item.', 'wp-audio-tracks'); ?></p>
                        </div>
                    <?php endif; ?>

                    <?php if (get_the_content()) : ?>
                        <div class="recording-details">
                            <div class="recording-description">
                                <?php the_content(); ?>
                            </div>
                        </div>
                    <?php endif; ?>

                    <footer class="recording-footer">
                        <div class="recording-meta">
                            <span class="recording-date">
                                <?php esc_html_e('Published:', 'wp-audio-tracks'); ?>
                                <time datetime="<?php echo esc_attr(get_the_date('c')); ?>">
                                    <?php echo esc_html(get_the_date()); ?>
                                </time>
                            </span>
                            <?php
                            $play_count = get_post_meta(get_the_ID(), '_recording_play_count', true);
                            $play_count = $play_count ? intval($play_count) : 0;
                            ?>
                            <span class="recording-plays">
                                <?php esc_html_e('Plays:', 'wp-audio-tracks'); ?>
                                <span class="play-count" data-recording-id="<?php echo esc_attr(get_the_ID()); ?>">
                                    <?php echo esc_html(number_format($play_count)); ?>
                                </span>
                            </span>
                        </div>
                    </footer>
                </main>
            </article>
        <?php endwhile; ?>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const audioPlayers = document.querySelectorAll('.secure-audio-player audio');
    audioPlayers.forEach(function(audio) {
        audio.addEventListener('contextmenu', function(e) { e.preventDefault(); return false; });
        audio.addEventListener('dragstart', function(e) { e.preventDefault(); return false; });
        audio.addEventListener('selectstart', function(e) { e.preventDefault(); return false; });
        audio.addEventListener('keydown', function(e) {
            if (e.ctrlKey && (e.keyCode === 83 || e.keyCode === 85)) { e.preventDefault(); return false; }
            if (e.keyCode === 123) { e.preventDefault(); return false; }
        });
    });

    document.addEventListener('keydown', function(e) {
        if (e.keyCode === 44) { e.preventDefault(); return false; }
    });

    let audioPlaying = false;
    audioPlayers.forEach(function(audio) {
        audio.addEventListener('play', function() { audioPlaying = true; });
        audio.addEventListener('pause', function() { audioPlaying = false; });
        audio.addEventListener('ended', function() { audioPlaying = false; });
    });

    document.addEventListener('contextmenu', function(e) {
        if (audioPlaying) { e.preventDefault(); return false; }
    });
});
</script>

<?php get_footer(); ?>
