# Portfolio Website

Personal portfolio website showcasing work, experience, and technical skills.

## Project Structure

- `index.html` - Main portfolio page with three sections: Experience, Tools, and Experiments
- `skills-data.json` - Data file containing detailed information about skills and tools
- `work/` - Individual project pages (Carmen, Ashes, etc.)
- `gfx/` - Graphics and decorative elements (lale.png, animated GIFs)
- `fonts/` - Univers font family

## Features

- Interactive navigation with three sections
- Expandable accordion items for experience and capabilities
- Clickable skill tags with detail panels
- Animated flower trail cursor effect
- Garden canvas effect in Experiments section
- Responsive design

## Sections

1. **Experience** - Professional work history with expandable details and skill tags
2. **Tools** - Technical capabilities organized by category (Creative, Web, Programming, Currently Exploring)
3. **Experiments** - Creative projects and experimental work

## Branching Strategy

- **`main`** - Production branch (published to GitHub Pages)
  - Only contains Experience and Tools sections
  - Experiments tab is hidden/commented out
  - Ready for public viewing

- **`portfolio`** - Development branch
  - Full version with all three sections including Experiments
  - Work in progress features
  - Merge to `main` when ready to publish

## Deployment (GitHub Pages)

### Initial Setup

1. Push the `main` branch to GitHub:
   ```bash
   git push origin main
   ```

2. Enable GitHub Pages:
   - Go to repository Settings → Pages
   - Under "Source", select branch `main` and folder `/ (root)`
   - Click Save
   - Site will be published at: `https://[username].github.io/cv-website/`

### Publishing Updates

1. Work on the `portfolio` branch:
   ```bash
   git checkout portfolio
   # Make your changes
   git add .
   git commit -m "Your changes"
   ```

2. When ready to publish:
   ```bash
   git checkout main
   git merge portfolio
   # Hide Experiments section if needed (already done)
   git push origin main
   ```

3. GitHub Pages will automatically deploy within a few minutes

### Custom Domain (Optional)

1. Add a `CNAME` file to the repository root with your domain
2. Configure DNS settings with your domain provider
3. In GitHub Settings → Pages, add your custom domain

## To-Do

- [ ] make trust me into digital postcard (mailto:me)
- [ ]
- [ ]

## Notes

- Site uses custom Univers font family
- Color scheme: violet (#ff6de2), olive (#9bba6f), black, white
- Zoom set to 0.67 for layout scaling
