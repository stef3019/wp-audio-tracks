# WP Audio Tracks Plugin

A comprehensive WordPress plugin for managing audio recordings with secure playback functionality that prevents unauthorized downloads.

## Features

- **Custom Post Type**: Create and manage audio recordings with custom fields
- **Section Taxonomy**: Organize recordings by sections (Seven, 72, 72+, CAM, Israel, Community, LT, KG, Elijah Project)
- **Secure Audio Playback**: Audio files can be listened to but cannot be downloaded
- **Responsive Design**: Mobile-friendly templates for all devices
- **Admin Interface**: Easy-to-use admin interface for managing recordings
- **Security Measures**: Multiple layers of protection against unauthorized access

## Installation

1. Upload the `wp-audio-tracks` folder to your `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. The plugin will automatically create the necessary database tables and default taxonomy terms

## Usage

### Creating Recordings

1. Go to **Recordings** in your WordPress admin menu
2. Click **Add New Recording**
3. Fill in the following fields:
   - **Title**: The name of your recording
   - **Description**: Detailed description (uses WordPress editor)
   - **Session**: Session information (text field)
   - **Recording**: Upload an audio file (MP3, WAV, OGG supported)
   - **Section**: Assign to one or more sections
4. Click **Publish**

### Managing Sections

The plugin automatically creates the following sections:
- Seven
- 72
- 72+
- CAM
- Israel
- Community
- LT
- KG
- Elijah Project

You can manage these sections under **Recordings > Sections** in the admin menu.

### Frontend Display

#### Single Recording Page
- Displays the recording title, description, and session information
- Shows a secure audio player that prevents downloads
- Includes navigation to other recordings in the same section

#### Section Archive Page
- Lists all recordings in a specific section
- Grid layout with thumbnails and descriptions
- Includes pagination for large numbers of recordings

## Security Features

The plugin implements multiple security measures to prevent unauthorized access to audio files:

### Download Prevention
- Audio files are served through a secure endpoint
- Right-click context menu is disabled
- Keyboard shortcuts for saving are blocked
- Developer tools detection
- Print screen prevention
- Text selection disabled during playback

### Technical Security
- Secure rewrite rules for audio file serving
- Nonce verification for all AJAX requests
- File type validation
- Access control checks
- Anti-hotlinking measures

## Customization

### Templates
The plugin uses custom templates that can be overridden by your theme:
- `single-recording.php` - Single recording display
- `taxonomy-section.php` - Section archive page

To override templates, copy them to your theme directory and modify as needed.

### Styling
All CSS is contained in `assets/css/style.css` and can be customized. The plugin uses a mobile-first responsive design approach.

### JavaScript
Frontend functionality is handled by `assets/js/script.js` and admin functionality by `assets/js/admin.js`.

## File Structure

```
wp-audio-tracks/
├── wp-audio-tracks.php          # Main plugin file
├── templates/                   # Custom templates
│   ├── single-recording.php     # Single recording template
│   └── taxonomy-section.php     # Section archive template
├── assets/                      # CSS and JavaScript files
│   ├── css/
│   │   └── style.css           # Frontend styles
│   └── js/
│       ├── script.js           # Frontend JavaScript
│       └── admin.js            # Admin JavaScript
└── README.md                   # This file
```

## Browser Compatibility

The plugin is compatible with all modern browsers:
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Security Considerations

While the plugin implements multiple security measures, please note:
- No security system is 100% foolproof
- Determined users with technical knowledge may still find ways to access files
- Consider additional server-level protections for highly sensitive content
- Regular security updates are recommended

## Support

For support and feature requests, please contact the plugin developer or submit an issue through the appropriate channels.

## Changelog

### Version 1.0.0
- Initial release
- Custom post type for recordings
- Section taxonomy with predefined terms
- Secure audio playback functionality
- Admin interface for managing recordings
- Responsive frontend templates
- Multiple security measures against unauthorized access

## License

This plugin is licensed under the GPL v2 or later.

## Credits

Developed for WordPress with security and user experience in mind.
