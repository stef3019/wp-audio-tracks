<?php
/**
 * Plugin Name: WP Audio Tracks

 * Description: A WordPress plugin for managing audio recordings with custom post types and taxonomies. Includes secure audio playback without download capability.
 * Version: 1.0.0
 * Author: Stef
 * Author URI: https://stefcordina.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wp-audio-tracks
 * Domain Path: /languages
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('WP_AUDIO_TRACKS_VERSION', '1.0.0');
define('WP_AUDIO_TRACKS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WP_AUDIO_TRACKS_PLUGIN_URL', plugin_dir_url(__FILE__));

// Main plugin class
class WPAudioTracks {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
        add_action('admin_init', array($this, 'admin_init'));
        
        // Serve secure audio as early as possible (before theme/plugins add output)
        add_action('parse_request', array($this, 'maybe_serve_secure_audio'), 0);
        add_action('template_redirect', array($this, 'handle_secure_audio'));
        
        // Add test endpoint for debugging
        add_action('init', array($this, 'add_test_endpoint'));
        
        // Add AJAX handlers for play tracking
        add_action('wp_ajax_track_recording_play', array($this, 'track_recording_play'));
        add_action('wp_ajax_nopriv_track_recording_play', array($this, 'track_recording_play'));
        
        // Add sorting for play count column
        add_action('pre_get_posts', array($this, 'handle_recording_sorting'));
        
        // Open Graph / social preview meta (must be in <head> for WhatsApp, Facebook, etc.)
        add_action('wp_head', array($this, 'output_recording_social_meta'), 1);
        
        // Use featured image for SEO plugin Open Graph output (Yoast, Rank Math, etc.)
        add_filter('wpseo_opengraph_image', array($this, 'filter_recording_og_image'));
        add_filter('rank_math/opengraph/facebook/og_image', array($this, 'filter_recording_og_image'));
        add_filter('aioseo_facebook_tags', array($this, 'filter_aioseo_facebook_tags'));
    }
    
    public function init() {
        $this->register_post_type();
        $this->register_taxonomy();
        $this->add_templates();
    }
    
    public function admin_init() {
        $this->add_meta_boxes();
        $this->add_admin_columns();
    }
    
    public function enqueue_scripts() {
        wp_enqueue_style('wp-audio-tracks-style', WP_AUDIO_TRACKS_PLUGIN_URL . 'assets/css/style.css', array(), WP_AUDIO_TRACKS_VERSION);
        
        if (is_singular('recording')) {
            wp_enqueue_style(
                'wp-audio-tracks-fonts',
                'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
                array(),
                null
            );
            wp_enqueue_style(
                'wp-audio-tracks-player-ui',
                WP_AUDIO_TRACKS_PLUGIN_URL . 'assets/css/player-ui.css',
                array('wp-audio-tracks-style', 'wp-audio-tracks-fonts'),
                WP_AUDIO_TRACKS_VERSION
            );
        }
        
        // Enqueue secure audio player first
        wp_enqueue_script('wp-audio-tracks-secure-player', WP_AUDIO_TRACKS_PLUGIN_URL . 'assets/js/secure-audio-player.js', array(), WP_AUDIO_TRACKS_VERSION, true);
        
        // Enqueue main script with dependency on secure player
        wp_enqueue_script('wp-audio-tracks-script', WP_AUDIO_TRACKS_PLUGIN_URL . 'assets/js/script.js', array('jquery', 'wp-audio-tracks-secure-player'), WP_AUDIO_TRACKS_VERSION, true);
        
        // Localize script for AJAX
        wp_localize_script('wp-audio-tracks-script', 'wpAudioTracks', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'siteUrl' => home_url('/'),
            'nonce' => wp_create_nonce('wp_audio_tracks_nonce')
        ));
    }
    
    public function admin_enqueue_scripts() {
        wp_enqueue_media();
        wp_enqueue_script('wp-audio-tracks-admin', WP_AUDIO_TRACKS_PLUGIN_URL . 'assets/js/admin.js', array('jquery'), WP_AUDIO_TRACKS_VERSION, true);
        
        // Localize admin script for AJAX
        wp_localize_script('wp-audio-tracks-admin', 'wpAudioTracksAdmin', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('wp_audio_tracks_admin_nonce')
        ));
    }
    
    public function register_post_type() {
        $labels = array(
            'name'                  => _x('Recordings', 'Post type general name', 'wp-audio-tracks'),
            'singular_name'         => _x('Recording', 'Post type singular name', 'wp-audio-tracks'),
            'menu_name'             => _x('Recordings', 'Admin Menu text', 'wp-audio-tracks'),
            'name_admin_bar'        => _x('Recording', 'Add New on Toolbar', 'wp-audio-tracks'),
            'add_new'               => __('Add New', 'wp-audio-tracks'),
            'add_new_item'          => __('Add New Recording', 'wp-audio-tracks'),
            'new_item'              => __('New Recording', 'wp-audio-tracks'),
            'edit_item'             => __('Edit Recording', 'wp-audio-tracks'),
            'view_item'             => __('View Recording', 'wp-audio-tracks'),
            'all_items'             => __('All Recordings', 'wp-audio-tracks'),
            'search_items'          => __('Search Recordings', 'wp-audio-tracks'),
            'parent_item_colon'     => __('Parent Recordings:', 'wp-audio-tracks'),
            'not_found'             => __('No recordings found.', 'wp-audio-tracks'),
            'not_found_in_trash'    => __('No recordings found in Trash.', 'wp-audio-tracks'),
            'featured_image'        => _x('Recording Cover Image', 'Overrides the "Featured Image" phrase', 'wp-audio-tracks'),
            'set_featured_image'    => _x('Set cover image', 'Overrides the "Set featured image" phrase', 'wp-audio-tracks'),
            'remove_featured_image' => _x('Remove cover image', 'Overrides the "Remove featured image" phrase', 'wp-audio-tracks'),
            'use_featured_image'    => _x('Use as cover image', 'Overrides the "Use as featured image" phrase', 'wp-audio-tracks'),
            'archives'              => _x('Recording archives', 'The post type archive label', 'wp-audio-tracks'),
            'insert_into_item'      => _x('Insert into recording', 'Overrides the "Insert into post" phrase', 'wp-audio-tracks'),
            'uploaded_to_this_item' => _x('Uploaded to this recording', 'Overrides the "Uploaded to this post" phrase', 'wp-audio-tracks'),
            'filter_items_list'     => _x('Filter recordings list', 'Screen reader text for the filter links', 'wp-audio-tracks'),
            'items_list_navigation' => _x('Recordings list navigation', 'Screen reader text for the pagination', 'wp-audio-tracks'),
            'items_list'            => _x('Recordings list', 'Screen reader text for the items list', 'wp-audio-tracks'),
        );

        $args = array(
            'labels'             => $labels,
            'public'             => true,
            'publicly_queryable' => true,
            'show_ui'            => true,
            'show_in_menu'       => true,
            'query_var'          => true,
            'rewrite'            => array('slug' => 'recording'),
            'capability_type'    => 'post',
            'has_archive'        => true,
            'hierarchical'       => false,
            'menu_position'      => null,
            'menu_icon'          => 'dashicons-microphone',
            'supports'           => array('title', 'editor', 'thumbnail'),
            'show_in_rest'       => true,
        );

        register_post_type('recording', $args);
    }
    
    public function register_taxonomy() {
        $labels = array(
            'name'              => _x('Sections', 'taxonomy general name', 'wp-audio-tracks'),
            'singular_name'     => _x('Section', 'taxonomy singular name', 'wp-audio-tracks'),
            'search_items'      => __('Search Sections', 'wp-audio-tracks'),
            'all_items'         => __('All Sections', 'wp-audio-tracks'),
            'parent_item'       => __('Parent Section', 'wp-audio-tracks'),
            'parent_item_colon' => __('Parent Section:', 'wp-audio-tracks'),
            'edit_item'         => __('Edit Section', 'wp-audio-tracks'),
            'update_item'       => __('Update Section', 'wp-audio-tracks'),
            'add_new_item'      => __('Add New Section', 'wp-audio-tracks'),
            'new_item_name'     => __('New Section Name', 'wp-audio-tracks'),
            'menu_name'         => __('Sections', 'wp-audio-tracks'),
        );

        $args = array(
            'hierarchical'      => true,
            'labels'            => $labels,
            'show_ui'           => true,
            'show_admin_column' => true,
            'query_var'         => true,
            'rewrite'           => array('slug' => 'section', 'hierarchical' => true),
            'show_in_rest'      => true,
        );

        register_taxonomy('section', array('recording'), $args);
        
        // Add default terms
        $this->add_default_terms();
    }
    
    public function add_default_terms() {
        // Define hierarchical structure
        $terms_structure = array(
            'Main Sections' => array(
                'Seven',
                '72',
                '72+'
            ),
            'Community' => array(
                'CAM',
                'Israel',
                'LT',
                'KG'
            ),
            'Projects' => array(
                'Elijah Project'
            )
        );
        
        foreach ($terms_structure as $parent_name => $children) {
            // Create parent term if it doesn't exist
            $parent_term = term_exists($parent_name, 'section');
            if (!$parent_term) {
                $parent_result = wp_insert_term($parent_name, 'section');
                if (!is_wp_error($parent_result)) {
                    $parent_term_id = $parent_result['term_id'];
                }
            } else {
                $parent_term_id = $parent_term['term_id'];
            }
            
            // Create child terms
            if (isset($parent_term_id)) {
                foreach ($children as $child_name) {
                    if (!term_exists($child_name, 'section')) {
                        wp_insert_term($child_name, 'section', array('parent' => $parent_term_id));
                    }
                }
            }
        }
        
        // Also create any standalone terms that might exist
        $standalone_terms = array('Seven', '72', '72+', 'CAM', 'Israel', 'Community', 'LT', 'KG', 'Elijah Project');
        
        foreach ($standalone_terms as $term) {
            if (!term_exists($term, 'section')) {
                wp_insert_term($term, 'section');
            }
        }
    }
    
    public function add_meta_boxes() {
        add_meta_box(
            'recording_details',
            __('Recording Details', 'wp-audio-tracks'),
            array($this, 'recording_details_callback'),
            'recording',
            'normal',
            'high'
        );
    }
    
    public function recording_details_callback($post) {
        wp_nonce_field('recording_details_nonce', 'recording_details_nonce');
        
        $session = get_post_meta($post->ID, '_recording_session', true);
        $speaker = get_post_meta($post->ID, '_recording_speaker', true);
        $recording_file = get_post_meta($post->ID, '_recording_file', true);
        ?>
        <table class="form-table">
            <tr>
                <th scope="row">
                    <label for="recording_session"><?php _e('Session', 'wp-audio-tracks'); ?></label>
                </th>
                <td>
                    <input type="text" id="recording_session" name="recording_session" value="<?php echo esc_attr($session); ?>" class="regular-text" />
                    <p class="description"><?php _e('Enter the session information for this recording.', 'wp-audio-tracks'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="recording_speaker"><?php _e('Speaker', 'wp-audio-tracks'); ?></label>
                </th>
                <td>
                    <input type="text" id="recording_speaker" name="recording_speaker" value="<?php echo esc_attr($speaker); ?>" class="regular-text" />
                    <p class="description"><?php _e('Enter the name of the speaker for this recording.', 'wp-audio-tracks'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="recording_file"><?php _e('Recording File', 'wp-audio-tracks'); ?></label>
                </th>
                <td>
                    <input type="text" id="recording_file" name="recording_file" value="<?php echo esc_attr($recording_file); ?>" class="regular-text" readonly />
                    <button type="button" class="button" id="upload_recording_button"><?php _e('Upload Audio File', 'wp-audio-tracks'); ?></button>
                    <button type="button" class="button" id="remove_recording_button" style="<?php echo empty($recording_file) ? 'display:none;' : ''; ?>"><?php _e('Remove', 'wp-audio-tracks'); ?></button>
                    <p class="description"><?php _e('Upload an audio file for this recording. Supported formats: MP3, WAV, OGG.', 'wp-audio-tracks'); ?></p>
                    <?php if (!empty($recording_file)): ?>
                        <div id="recording_preview">
                            <audio controls style="width: 100%; max-width: 400px;">
                                <source src="<?php echo esc_url($recording_file); ?>" type="audio/mpeg">
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                    <?php endif; ?>
                </td>
            </tr>
        </table>
        <?php
    }
    
    public function add_templates() {
        add_filter('single_template', array($this, 'single_recording_template'));
        add_filter('archive_template', array($this, 'section_archive_template'));
    }
    
    public function single_recording_template($template) {
        global $post;
        
        if ($post->post_type === 'recording') {
            $plugin_template = WP_AUDIO_TRACKS_PLUGIN_DIR . 'templates/single-recording.php';
            if (file_exists($plugin_template)) {
                return $plugin_template;
            }
        }
        
        return $template;
    }
    
    public function section_archive_template($template) {
        if (is_tax('section')) {
            $plugin_template = WP_AUDIO_TRACKS_PLUGIN_DIR . 'templates/taxonomy-section.php';
            if (file_exists($plugin_template)) {
                return $plugin_template;
            }
        }
        
        return $template;
    }
    
    /**
     * Featured image data for social previews (Facebook, WhatsApp, Twitter, etc.).
     *
     * @param int $post_id Recording post ID.
     * @return array|null Keys: url, width, height, mime, alt — or null if no image.
     */
    private function get_recording_og_image_data($post_id) {
        $thumbnail_id = get_post_thumbnail_id($post_id);
        if (!$thumbnail_id) {
            return null;
        }
        
        $image = wp_get_attachment_image_src($thumbnail_id, 'full');
        if (!$image || empty($image[0])) {
            return null;
        }
        
        $url = set_url_scheme($image[0], is_ssl() ? 'https' : 'http');
        $alt = get_post_meta($thumbnail_id, '_wp_attachment_image_alt', true);
        $mime = get_post_mime_type($thumbnail_id);
        
        return array(
            'url'    => $url,
            'width'  => (int) $image[1],
            'height' => (int) $image[2],
            'mime'   => $mime ? $mime : 'image/jpeg',
            'alt'    => $alt !== '' ? $alt : get_the_title($post_id),
        );
    }
    
    /**
     * Tell SEO plugins to use the recording featured image for Open Graph.
     */
    public function filter_recording_og_image($image) {
        if (!is_singular('recording')) {
            return $image;
        }
        
        $data = $this->get_recording_og_image_data(get_queried_object_id());
        return $data ? $data['url'] : $image;
    }
    
    /**
     * All in One SEO: set og:image from featured image.
     */
    public function filter_aioseo_facebook_tags($tags) {
        if (!is_singular('recording') || !is_array($tags)) {
            return $tags;
        }
        
        $data = $this->get_recording_og_image_data(get_queried_object_id());
        if ($data) {
            $tags['og:image'] = $data['url'];
            if ($data['width']) {
                $tags['og:image:width'] = $data['width'];
            }
            if ($data['height']) {
                $tags['og:image:height'] = $data['height'];
            }
        }
        
        return $tags;
    }
    
    /**
     * Output Open Graph and Twitter Card meta for single recording pages.
     * og:title = recording title; og:description = session; og:image = featured image.
     */
    public function output_recording_social_meta() {
        if (!is_singular('recording')) {
            return;
        }
        
        $post_id = get_queried_object_id();
        if (!$post_id) {
            return;
        }
        
        $post_title = get_the_title($post_id);
        $post_url = get_permalink($post_id);
        $session = get_post_meta($post_id, '_recording_session', true);
        $site_name = get_bloginfo('name');
        
        $og_description = !empty($session) ? $session : '';
        if ($og_description === '') {
            $excerpt = get_post_field('post_excerpt', $post_id);
            if (!empty($excerpt)) {
                $og_description = wp_strip_all_tags($excerpt);
            }
        }
        if ($og_description === '') {
            $og_description = $site_name;
        }
        
        if (strlen($og_description) > 200) {
            $og_description = substr($og_description, 0, 197) . '...';
        }
        
        $image_data = $this->get_recording_og_image_data($post_id);
        
        echo '<meta name="description" content="' . esc_attr($og_description) . '" />' . "\n";
        echo '<meta property="og:type" content="article" />' . "\n";
        echo '<meta property="og:title" content="' . esc_attr($post_title) . '" />' . "\n";
        echo '<meta property="og:description" content="' . esc_attr($og_description) . '" />' . "\n";
        echo '<meta property="og:url" content="' . esc_url($post_url) . '" />' . "\n";
        echo '<meta property="og:site_name" content="' . esc_attr($site_name) . '" />' . "\n";
        
        if ($image_data) {
            echo '<meta property="og:image" content="' . esc_url($image_data['url']) . '" />' . "\n";
            echo '<meta property="og:image:secure_url" content="' . esc_url(set_url_scheme($image_data['url'], 'https')) . '" />' . "\n";
            if ($image_data['width'] > 0) {
                echo '<meta property="og:image:width" content="' . esc_attr($image_data['width']) . '" />' . "\n";
            }
            if ($image_data['height'] > 0) {
                echo '<meta property="og:image:height" content="' . esc_attr($image_data['height']) . '" />' . "\n";
            }
            echo '<meta property="og:image:type" content="' . esc_attr($image_data['mime']) . '" />' . "\n";
            echo '<meta property="og:image:alt" content="' . esc_attr($image_data['alt']) . '" />' . "\n";
        }
        
        $twitter_card = $image_data ? 'summary_large_image' : 'summary';
        echo '<meta name="twitter:card" content="' . esc_attr($twitter_card) . '" />' . "\n";
        echo '<meta name="twitter:title" content="' . esc_attr($post_title) . '" />' . "\n";
        echo '<meta name="twitter:description" content="' . esc_attr($og_description) . '" />' . "\n";
        if ($image_data) {
            echo '<meta name="twitter:image" content="' . esc_url($image_data['url']) . '" />' . "\n";
        }
        
        // Helps some crawlers discover the preview image explicitly.
        if ($image_data) {
            echo '<link rel="image_src" href="' . esc_url($image_data['url']) . '" />' . "\n";
        }
    }
    
    public function maybe_serve_secure_audio() {
        $request_uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
        if (strpos($request_uri, '/secure-audio/') !== false) {
            $this->dispatch_secure_audio_request();
        }
    }
    
    public function handle_secure_audio() {
        if (isset($_GET['secure_audio']) && isset($_GET['id'])) {
            $this->dispatch_secure_audio_request();
        }
    }
    
    private function dispatch_secure_audio_request() {
        $request_uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
        
        if (strpos($request_uri, '/secure-audio/') !== false) {
            if (strpos($request_uri, '/metadata') !== false) {
                preg_match('/\/secure-audio\/(\d+)\/metadata/', $request_uri, $matches);
                if (!empty($matches[1])) {
                    $_GET['id'] = intval($matches[1]);
                    $this->handle_audio_metadata();
                }
                return;
            }
            
            if (strpos($request_uri, '/chunk/') !== false) {
                preg_match('/\/secure-audio\/(\d+)\/chunk\/(\d+)/', $request_uri, $matches);
                if (!empty($matches[1]) && isset($matches[2])) {
                    $_GET['id'] = intval($matches[1]);
                    $_GET['chunk'] = intval($matches[2]);
                    $this->handle_audio_chunk();
                }
                return;
            }
            
            preg_match('/\/secure-audio\/(\d+)\/?/', $request_uri, $matches);
            if (!empty($matches[1])) {
                $_GET['id'] = intval($matches[1]);
                $this->handle_full_audio();
            }
            return;
        }
        
        $type = isset($_GET['type']) ? $_GET['type'] : 'full';
        
        switch ($type) {
            case 'metadata':
                $this->handle_audio_metadata();
                break;
            case 'chunk':
                $this->handle_audio_chunk();
                break;
            case 'full':
            default:
                $this->handle_full_audio();
                break;
        }
    }
    
    private function clean_output_buffers() {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
    }
    
    private function disable_compression() {
        if (function_exists('apache_setenv')) {
            @apache_setenv('no-gzip', '1');
        }
        @ini_set('zlib.output_compression', '0');
    }
    
    private function get_audio_mime_type($file_path) {
        $file_extension = strtolower(pathinfo($file_path, PATHINFO_EXTENSION));
        
        switch ($file_extension) {
            case 'wav':
                return 'audio/wav';
            case 'ogg':
                return 'audio/ogg';
            case 'm4a':
                return 'audio/mp4';
            case 'mp3':
            default:
                return 'audio/mpeg';
        }
    }
    
    private function send_audio_stream_headers() {
        header('X-Content-Type-Options: nosniff');
        header('Accept-Ranges: bytes');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        header('X-Frame-Options: DENY');
    }
    
    public function handle_audio_metadata() {
        $post_id = intval($_GET['id']);
        $post = get_post($post_id);
        
        if (!$post || $post->post_type !== 'recording') {
            status_header(404);
            wp_die('Invalid recording');
        }
        
        $recording_file = get_post_meta($post_id, '_recording_file', true);
        
        if (empty($recording_file)) {
            status_header(404);
            wp_die('No recording file found');
        }
        
        // Get file path from URL
        $upload_dir = wp_upload_dir();
        $file_path = str_replace($upload_dir['baseurl'], $upload_dir['basedir'], $recording_file);
        
        if (!file_exists($file_path)) {
            status_header(404);
            wp_die('File not found');
        }
        
        $file_size = filesize($file_path);
        $chunk_size = 8192; // 8KB chunks
        $total_chunks = ceil($file_size / $chunk_size);
        
        $duration = $this->get_audio_duration_seconds($file_path, $recording_file);
        
        $metadata = array(
            'duration' => $duration,
            'totalChunks' => $total_chunks,
            'chunkSize' => $chunk_size,
            'fileSize' => $file_size
        );
        
        $this->clean_output_buffers();
        $this->disable_compression();
        
        header('Content-Type: application/json');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        echo json_encode($metadata);
        exit;
    }
    
    public function handle_audio_chunk() {
        $post_id = intval($_GET['id']);
        $post = get_post($post_id);
        
        if (!$post || $post->post_type !== 'recording') {
            status_header(404);
            wp_die('Invalid recording');
        }
        
        $recording_file = get_post_meta($post_id, '_recording_file', true);
        if (empty($recording_file)) {
            status_header(404);
            wp_die('No recording file found');
        }
        
        // Get file path from URL
        $upload_dir = wp_upload_dir();
        $file_path = str_replace($upload_dir['baseurl'], $upload_dir['basedir'], $recording_file);
        
        if (!file_exists($file_path)) {
            status_header(404);
            wp_die('File not found');
        }
        
        // Get chunk index from URL parameter or URL pattern
        $chunk_index = null;
        
        if (isset($_GET['chunk'])) {
            $chunk_index = intval($_GET['chunk']);
        } else {
            // Fallback: extract from URL pattern
            preg_match('/\/chunk\/(\d+)\//', $_SERVER['REQUEST_URI'], $matches);
            if (isset($matches[1])) {
                $chunk_index = intval($matches[1]);
            }
        }
        
        if ($chunk_index === null) {
            status_header(400);
            wp_die('Invalid chunk request');
        }
        $chunk_size = 8192; // 8KB chunks
        $file_size = filesize($file_path);
        $total_chunks = ceil($file_size / $chunk_size);
        
        if ($chunk_index >= $total_chunks) {
            status_header(404);
            wp_die('Chunk not found');
        }
        
        $start = $chunk_index * $chunk_size;
        $end = min($start + $chunk_size - 1, $file_size - 1);
        $length = $end - $start + 1;
        
        // Read chunk from file
        $file = fopen($file_path, 'rb');
        fseek($file, $start);
        $chunk_data = fread($file, $length);
        fclose($file);
        
        // Obfuscate the chunk data
        $obfuscated_data = $this->obfuscate_chunk($chunk_data);
        
        $this->clean_output_buffers();
        $this->disable_compression();
        
        // Serve obfuscated chunk
        header('Content-Type: application/octet-stream');
        header('Content-Length: ' . strlen($obfuscated_data));
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        header('X-Chunk-Index: ' . $chunk_index);
        header('X-Total-Chunks: ' . $total_chunks);
        
        echo $obfuscated_data;
        exit;
    }
    
    public function handle_full_audio() {
        $post_id = intval($_GET['id']);
        $post = get_post($post_id);
        
        if (!$post || $post->post_type !== 'recording') {
            status_header(404);
            wp_die('Invalid recording');
        }
        
        $recording_file = get_post_meta($post_id, '_recording_file', true);
        if (empty($recording_file)) {
            status_header(404);
            wp_die('No recording file found');
        }
        
        // Get file path from URL
        $upload_dir = wp_upload_dir();
        $file_path = str_replace($upload_dir['baseurl'], $upload_dir['basedir'], $recording_file);
        
        if (!file_exists($file_path)) {
            status_header(404);
            wp_die('File not found: ' . $file_path);
        }
        
        $file_size = filesize($file_path);
        $mime_type = $this->get_audio_mime_type($file_path);
        
        $this->clean_output_buffers();
        $this->disable_compression();
        $this->send_audio_stream_headers();
        
        if (!empty($_SERVER['HTTP_RANGE'])) {
            $this->serve_audio_range($file_path, $mime_type, $file_size);
        }
        
        header('Content-Type: ' . $mime_type);
        header('Content-Length: ' . $file_size);
        http_response_code(200);
        readfile($file_path);
        exit;
    }
    
    private function serve_audio_range($file_path, $mime_type, $file_size) {
        if (!preg_match('/bytes=(\d+)-(\d*)/', $_SERVER['HTTP_RANGE'], $matches)) {
            status_header(416);
            exit;
        }
        
        $start = (int) $matches[1];
        $end = $matches[2] !== '' ? (int) $matches[2] : $file_size - 1;
        $end = min($end, $file_size - 1);
        
        if ($start > $end || $start >= $file_size) {
            status_header(416);
            header('Content-Range: bytes */' . $file_size);
            exit;
        }
        
        $length = $end - $start + 1;
        
        http_response_code(206);
        header('Content-Type: ' . $mime_type);
        header('Content-Length: ' . $length);
        header('Content-Range: bytes ' . $start . '-' . $end . '/' . $file_size);
        
        $handle = fopen($file_path, 'rb');
        if ($handle === false) {
            status_header(500);
            exit;
        }
        
        fseek($handle, $start);
        
        $bytes_remaining = $length;
        $chunk_size = 8192;
        
        while ($bytes_remaining > 0 && !feof($handle)) {
            $read_size = min($chunk_size, $bytes_remaining);
            $buffer = fread($handle, $read_size);
            
            if ($buffer === false) {
                break;
            }
            
            echo $buffer;
            $bytes_remaining -= strlen($buffer);
        }
        
        fclose($handle);
        exit;
    }
    
    public function add_test_endpoint() {
        // Add a simple test endpoint to verify rewrite rules
        add_rewrite_rule('^audio-test/?$', 'index.php?audio_test=1', 'top');
    }
    
    public function handle_test_endpoint() {
        if (get_query_var('audio_test')) {
            header('Content-Type: application/json');
            echo json_encode(array(
                'status' => 'success',
                'message' => 'Rewrite rules are working',
                'timestamp' => time()
            ));
            exit;
        }
    }
    
    private function obfuscate_chunk($chunk_data) {
        // Simple XOR obfuscation with a rotating key
        $key = 'wp-audio-tracks-secure-key-2024';
        $key_length = strlen($key);
        $data_length = strlen($chunk_data);
        $obfuscated = '';
        
        for ($i = 0; $i < $data_length; $i++) {
            $obfuscated .= chr(ord($chunk_data[$i]) ^ ord($key[$i % $key_length]));
        }
        
        return $obfuscated;
    }
    
    /**
     * Get accurate audio duration in seconds (WordPress media meta, getID3, then estimate).
     */
    private function get_audio_duration_seconds($file_path, $recording_url = '') {
        if (!empty($recording_url)) {
            $attachment_id = attachment_url_to_postid($recording_url);
            if ($attachment_id) {
                $meta = wp_get_attachment_metadata($attachment_id);
                if (!empty($meta['length']) && is_numeric($meta['length'])) {
                    return max(1, (int) round((float) $meta['length']));
                }
            }
        }
        
        if (!function_exists('wp_read_audio_metadata')) {
            require_once ABSPATH . 'wp-admin/includes/media.php';
        }
        
        if (function_exists('wp_read_audio_metadata')) {
            $audio_meta = wp_read_audio_metadata($file_path);
            if (!empty($audio_meta['length']) && is_numeric($audio_meta['length'])) {
                return max(1, (int) round((float) $audio_meta['length']));
            }
        }
        
        return $this->estimate_audio_duration($file_path);
    }
    
    private function estimate_audio_duration($file_path) {
        $file_size = filesize($file_path);
        
        // Fallback: assume ~96kbps (common for speech/long recordings) ≈ 12KB/s
        $estimated_duration = $file_size / 12000;
        
        return max(1, (int) round($estimated_duration));
    }
    
    public function track_recording_play() {
        // Verify nonce for security
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'wp_audio_tracks_nonce')) {
            wp_send_json_error(array('message' => 'Security check failed'));
            return;
        }
        
        if (!isset($_POST['recording_id'])) {
            wp_send_json_error(array('message' => 'No recording ID provided'));
            return;
        }
        
        $recording_id = intval($_POST['recording_id']);
        
        // Verify the recording exists and is of correct post type
        $post = get_post($recording_id);
        if (!$post || $post->post_type !== 'recording') {
            wp_send_json_error(array('message' => 'Invalid recording'));
            return;
        }
        
        // Get current play count
        $current_count = get_post_meta($recording_id, '_recording_play_count', true);
        $current_count = $current_count ? intval($current_count) : 0;
        
        // Increment play count
        $new_count = $current_count + 1;
        update_post_meta($recording_id, '_recording_play_count', $new_count);
        
        // Log play event with timestamp (optional - for detailed analytics)
        $play_logs = get_post_meta($recording_id, '_recording_play_logs', true);
        if (!is_array($play_logs)) {
            $play_logs = array();
        }
        
        // Keep only last 100 play events to prevent database bloat
        if (count($play_logs) >= 100) {
            $play_logs = array_slice($play_logs, -99);
        }
        
        $play_logs[] = array(
            'timestamp' => current_time('mysql'),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
        );
        
        update_post_meta($recording_id, '_recording_play_logs', $play_logs);
        
        // Return success response
        wp_send_json_success(array(
            'play_count' => $new_count,
            'message' => 'Play tracked successfully'
        ));
    }
    
    public function add_admin_columns() {
        // Add play count column to recordings list
        add_filter('manage_recording_posts_columns', array($this, 'add_recording_columns'));
        add_action('manage_recording_posts_custom_column', array($this, 'display_recording_columns'), 10, 2);
        add_filter('manage_edit-recording_sortable_columns', array($this, 'make_recording_columns_sortable'));
    }
    
    public function add_recording_columns($columns) {
        // Insert play count column before date
        $new_columns = array();
        foreach ($columns as $key => $value) {
            if ($key === 'date') {
                $new_columns['play_count'] = __('Plays', 'wp-audio-tracks');
            }
            $new_columns[$key] = $value;
        }
        return $new_columns;
    }
    
    public function display_recording_columns($column, $post_id) {
        if ($column === 'play_count') {
            $play_count = get_post_meta($post_id, '_recording_play_count', true);
            $play_count = $play_count ? intval($play_count) : 0;
            echo '<strong>' . number_format($play_count) . '</strong>';
            
            // Show last play time if available
            $play_logs = get_post_meta($post_id, '_recording_play_logs', true);
            if (is_array($play_logs) && !empty($play_logs)) {
                $last_play = end($play_logs);
                if (isset($last_play['timestamp'])) {
                    $last_play_time = strtotime($last_play['timestamp']);
                    echo '<br><small style="color: #666;">Last: ' . human_time_diff($last_play_time) . ' ago</small>';
                }
            }
        }
    }
    
    public function make_recording_columns_sortable($columns) {
        $columns['play_count'] = 'play_count';
        return $columns;
    }
    
    public function handle_recording_sorting($query) {
        if (!is_admin() || !$query->is_main_query()) {
            return;
        }
        
        if (isset($_GET['post_type']) && $_GET['post_type'] === 'recording' && isset($_GET['orderby']) && $_GET['orderby'] === 'play_count') {
            $query->set('meta_key', '_recording_play_count');
            $query->set('orderby', 'meta_value_num');
            $query->set('order', isset($_GET['order']) ? $_GET['order'] : 'DESC');
        }
    }
}

// Initialize the plugin
new WPAudioTracks();

// Save meta box data
add_action('save_post', 'save_recording_details');
function save_recording_details($post_id) {
    if (!isset($_POST['recording_details_nonce']) || !wp_verify_nonce($_POST['recording_details_nonce'], 'recording_details_nonce')) {
        return;
    }
    
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }
    
    if (!current_user_can('edit_post', $post_id)) {
        return;
    }
    
    if (isset($_POST['recording_session'])) {
        update_post_meta($post_id, '_recording_session', sanitize_text_field($_POST['recording_session']));
    }
    
    if (isset($_POST['recording_speaker'])) {
        update_post_meta($post_id, '_recording_speaker', sanitize_text_field($_POST['recording_speaker']));
    }
    
    if (isset($_POST['recording_file'])) {
        update_post_meta($post_id, '_recording_file', esc_url_raw($_POST['recording_file']));
    }
}

// Add rewrite rules for secure audio serving
add_action('init', 'add_secure_audio_rewrite_rules');
function add_secure_audio_rewrite_rules() {
    // Audio metadata (must come first - most specific pattern)
    add_rewrite_rule('^secure-audio/([0-9]+)/metadata/?$', 'index.php?secure_audio=1&id=$matches[1]&type=metadata', 'top');
    
    // Audio chunks (second most specific)
    add_rewrite_rule('^secure-audio/([0-9]+)/chunk/([0-9]+)/?$', 'index.php?secure_audio=1&id=$matches[1]&chunk=$matches[2]&type=chunk', 'top');
    
    // Full audio file (least specific - fallback)
    add_rewrite_rule('^secure-audio/([0-9]+)/?$', 'index.php?secure_audio=1&id=$matches[1]&type=full', 'top');
    
    // Debug: Add a more specific metadata rule
    add_rewrite_rule('^secure-audio/([0-9]+)/metadata$', 'index.php?secure_audio=1&id=$matches[1]&type=metadata', 'top');
}

// Add query vars
add_filter('query_vars', 'add_secure_audio_query_vars');
function add_secure_audio_query_vars($vars) {
    $vars[] = 'secure_audio';
    $vars[] = 'id';
    $vars[] = 'type';
    $vars[] = 'chunk';
    $vars[] = 'audio_test';
    return $vars;
}

// Handle test endpoint
add_action('template_redirect', 'handle_audio_test_endpoint');
function handle_audio_test_endpoint() {
    if (get_query_var('audio_test')) {
        header('Content-Type: application/json');
        echo json_encode(array(
            'status' => 'success',
            'message' => 'Rewrite rules are working',
            'timestamp' => time(),
            'query_vars' => $_GET
        ));
        exit;
    }
}

// Flush rewrite rules on activation
register_activation_hook(__FILE__, 'wp_audio_tracks_activate');
function wp_audio_tracks_activate() {
    // Register post type and taxonomy
    $plugin = new WPAudioTracks();
    $plugin->register_post_type();
    $plugin->register_taxonomy();
    
    // Add rewrite rules
    add_secure_audio_rewrite_rules();
    
    // Flush rewrite rules
    flush_rewrite_rules();
}

// Flush rewrite rules on deactivation
register_deactivation_hook(__FILE__, 'wp_audio_tracks_deactivate');
function wp_audio_tracks_deactivate() {
    flush_rewrite_rules();
}
