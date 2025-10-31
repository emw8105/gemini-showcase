# 🖼️ Background Image Setup Guide

## Quick Start

1. **Add your image** to this folder (`/delphi/public/`)
   - Recommended formats: `.jpg`, `.png`, `.webp`
   - Recommended size: 1920x1080 or larger for best quality
   - Name it something like: `background.jpg`

2. **Update the CSS** file: `/delphi/app/globals.css`
   
   Find these sections (lines ~90, ~113, ~126):
   ```css
   /* url('/background.jpg'), */
   ```
   
   **Uncomment** that line and replace `background.jpg` with your image filename:
   ```css
   url('/your-image-name.jpg'),
   ```

3. **Done!** Your image will appear as the background with the golden waves overlay on top.

## Example

If your image is named `luxury-bg.jpg`, update the CSS like this:

```css
background-image: 
  url('/luxury-bg.jpg'),  /* <-- Uncommented with your filename */
  linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, ...);
```

## Notes

- The gradient overlay provides a subtle white tint so text remains readable
- The golden waves animation will appear on top of your image
- Images in `/public/` are served from the root path (e.g., `/image.jpg`)
- The gradient will be used as a fallback if the image doesn't load
