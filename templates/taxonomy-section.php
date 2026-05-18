<?php
/**
 * Section Taxonomy Archive Template
 * 
 * This template displays all recordings for a specific section.
 */

get_header(); ?>

<div class="wp-audio-tracks-container">
    <div class="theme-toggle-container">
        <button class="theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
            <span class="theme-toggle-icon light-icon" aria-hidden="true">&#9728;&#65039;</span>
            <span class="theme-toggle-icon dark-icon" aria-hidden="true">&#127769;</span>
        </button>
    </div>
    
    <div class="section-archive-content">
        
        <header class="page-header">
            <h1 class="page-title">
                <?php
                $current_term = get_queried_object();
                if ($current_term) {
                    printf(__('Recordings in Section: %s', 'wp-audio-tracks'), '<span class="section-name">' . esc_html($current_term->name) . '</span>');
                } else {
                    _e('Section Recordings', 'wp-audio-tracks');
                }
                ?>
            </h1>
            
            <?php if ($current_term && !empty($current_term->description)) : ?>
                <div class="section-description">
                    <?php echo wp_kses_post($current_term->description); ?>
                </div>
            <?php endif; ?>
        </header>
        
        <?php if (have_posts()) : ?>
            
            <div class="recordings-grid">
                <?php while (have_posts()) : the_post(); ?>
                    
                    <article id="post-<?php the_ID(); ?>" <?php post_class('recording-item'); ?>>
                        
                        <div class="recording-card">
                            
                            <?php if (has_post_thumbnail()) : ?>
                                <div class="recording-thumbnail">
                                    <a href="<?php the_permalink(); ?>">
                                        <?php the_post_thumbnail('medium'); ?>
                                    </a>
                                </div>
                            <?php else : ?>
                                <div class="recording-thumbnail no-image">
                                    <a href="<?php the_permalink(); ?>">
                                        <div class="default-thumbnail">
                                            <span class="dashicons dashicons-microphone"></span>
                                        </div>
                                    </a>
                                </div>
                            <?php endif; ?>
                            
                            <div class="recording-content">
                                <header class="recording-header">
                                    <h2 class="recording-title">
                                        <a href="<?php the_permalink(); ?>" rel="bookmark">
                                            <?php the_title(); ?>
                                        </a>
                                    </h2>
                                    
                                    <?php 
                                    $session = get_post_meta(get_the_ID(), '_recording_session', true);
                                    if (!empty($session)) : ?>
                                        <div class="recording-session">
                                            <strong><?php _e('Session:', 'wp-audio-tracks'); ?></strong> 
                                            <span><?php echo esc_html($session); ?></span>
                                        </div>
                                    <?php endif; ?>
                                </header>
                                
                                <div class="recording-excerpt">
                                    <?php 
                                    if (has_excerpt()) {
                                        the_excerpt();
                                    } else {
                                        echo wp_trim_words(get_the_content(), 20, '...');
                                    }
                                    ?>
                                </div>
                                
                                <div class="recording-meta">
                                    <div class="recording-date">
                                        <time datetime="<?php echo get_the_date('c'); ?>">
                                            <?php echo get_the_date(); ?>
                                        </time>
                                    </div>
                                    
                                    <?php 
                                    $recording_file = get_post_meta(get_the_ID(), '_recording_file', true);
                                    if (!empty($recording_file)) : ?>
                                        <div class="recording-has-audio">
                                            <span class="audio-indicator">
                                                <span class="dashicons dashicons-controls-play"></span>
                                                <?php _e('Audio Available', 'wp-audio-tracks'); ?>
                                            </span>
                                        </div>
                                    <?php endif; ?>
                                </div>
                                
                                <div class="recording-actions">
                                    <a href="<?php the_permalink(); ?>" class="button button-primary">
                                        <?php _e('Listen to Recording', 'wp-audio-tracks'); ?>
                                    </a>
                                </div>
                            </div>
                            
                        </div>
                        
                    </article>
                    
                <?php endwhile; ?>
            </div>
            
            <?php
            // Pagination
            the_posts_pagination(array(
                'mid_size'  => 2,
                'prev_text' => __('Previous', 'wp-audio-tracks'),
                'next_text' => __('Next', 'wp-audio-tracks'),
            ));
            ?>
            
        <?php else : ?>
            
            <div class="no-recordings">
                <h2><?php _e('No Recordings Found', 'wp-audio-tracks'); ?></h2>
                <p><?php _e('Sorry, no recordings were found in this section.', 'wp-audio-tracks'); ?></p>
                
                <div class="back-to-sections">
                    <a href="<?php echo get_post_type_archive_link('recording'); ?>" class="button">
                        <?php _e('View All Recordings', 'wp-audio-tracks'); ?>
                    </a>
                </div>
            </div>
            
        <?php endif; ?>
        
        <?php
        // Show all sections navigation with hierarchical display
        $all_sections = get_terms(array(
            'taxonomy' => 'section',
            'hide_empty' => true,
            'parent' => 0, // Get only top-level terms
            'orderby' => 'name',
            'order' => 'ASC'
        ));
        
        if ($all_sections && !is_wp_error($all_sections)) : ?>
            <div class="all-sections-navigation">
                <h3><?php _e('Browse All Sections', 'wp-audio-tracks'); ?></h3>
                <div class="sections-hierarchy">
                    <?php foreach ($all_sections as $parent_section) : ?>
                        <div class="section-group">
                            <h4 class="parent-section">
                                <a href="<?php echo get_term_link($parent_section); ?>" 
                                   class="section-link parent-link <?php echo ($current_term && $current_term->term_id === $parent_section->term_id) ? 'current-section' : ''; ?>">
                                    <?php echo esc_html($parent_section->name); ?>
                                    <span class="section-count">(<?php echo $parent_section->count; ?>)</span>
                                </a>
                            </h4>
                            
                            <?php
                            // Get child terms
                            $child_sections = get_terms(array(
                                'taxonomy' => 'section',
                                'hide_empty' => true,
                                'parent' => $parent_section->term_id,
                                'orderby' => 'name',
                                'order' => 'ASC'
                            ));
                            
                            if ($child_sections && !is_wp_error($child_sections)) : ?>
                                <div class="child-sections">
                                    <?php foreach ($child_sections as $child_section) : ?>
                                        <a href="<?php echo get_term_link($child_section); ?>" 
                                           class="section-link child-link <?php echo ($current_term && $current_term->term_id === $child_section->term_id) ? 'current-section' : ''; ?>">
                                            <?php echo esc_html($child_section->name); ?>
                                            <span class="section-count">(<?php echo $child_section->count; ?>)</span>
                                        </a>
                                    <?php endforeach; ?>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endif; ?>
        
    </div>
</div>

<?php get_footer(); ?>
