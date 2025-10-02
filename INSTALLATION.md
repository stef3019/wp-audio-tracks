# WP Audio Tracks - Installation Guide

## Quick Installation

1. **Upload Plugin Files**
   - Upload the entire `wp-audio-tracks` folder to your WordPress `/wp-content/plugins/` directory
   - Ensure all files and folders are uploaded correctly

2. **Activate Plugin**
   - Go to your WordPress admin dashboard
   - Navigate to **Plugins** → **Installed Plugins**
   - Find "WP Audio Tracks" and click **Activate**

3. **Verify Installation**
   - You should see a new "Recordings" menu item in your admin sidebar
   - The plugin will automatically create the Section taxonomy with default terms

## Post-Installation Setup

### 1. Check Permalinks
After activation, go to **Settings** → **Permalinks** and click **Save Changes** to ensure the custom post type URLs work correctly.

### 2. Create Your First Recording
1. Go to **Recordings** → **Add New Recording**
2. Fill in the required fields:
   - Title: Enter a descriptive title
   - Description: Add detailed information using the WordPress editor
   - Session: Enter session details
   - Recording: Upload an audio file (MP3, WAV, or OGG)
   - Section: Select one or more sections from the available options
3. Click **Publish**

### 3. Test Frontend Display
- Visit your new recording on the frontend
- Verify the audio player works and security measures are active
- Test the section archive page by clicking on a section link

## Default Sections Created

The plugin automatically creates these sections:
- Seven
- 72
- 72+
- CAM
- Israel
- Community
- LT
- KG
- Elijah Project

## Troubleshooting

### Audio Files Not Playing
- Check that the audio file was uploaded successfully
- Verify the file format (MP3, WAV, OGG)
- Ensure the file size is under 50MB

### Permalinks Not Working
- Go to **Settings** → **Permalinks**
- Select any permalink structure other than "Plain"
- Click **Save Changes**

### Security Features Not Working
- Clear any caching plugins
- Check that JavaScript is enabled in your browser
- Verify that no other plugins are conflicting

## File Permissions

Ensure your WordPress uploads directory has proper permissions:
- `/wp-content/uploads/` should be writable (755 or 775)

## Server Requirements

- PHP 7.4 or higher
- WordPress 5.0 or higher
- MySQL 5.6 or higher
- Sufficient disk space for audio file uploads

## Support

If you encounter any issues during installation, please check:
1. WordPress error logs
2. Plugin compatibility with your theme
3. Server configuration for file uploads

For additional support, contact your plugin developer.
