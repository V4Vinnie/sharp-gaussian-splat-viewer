# Setting Up GitHub Repository

Follow these steps to create a new GitHub repository for this project:

## Step 1: Create the Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `sharp-gaussian-splat-viewer` (or your preferred name)
3. Description: "Web application for generating and viewing 3D Gaussian splats from images using Sharp model"
4. Choose **Public** or **Private**
5. **DO NOT** initialize with README, .gitignore, or license (we'll add our own)
6. Click "Create repository"

## Step 2: Initialize Git and Push Code

Run these commands in your terminal from the **parent directory** (one level up from `webapp`):

```bash
# Navigate to the sharp directory (if not already there)
cd /Users/vandevi/sharp

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Sharp Gaussian Splat Web Viewer"

# Add your GitHub repository as remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/sharp-gaussian-splat-viewer.git

# Rename main branch (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

## Step 3: Update README (Optional)

After pushing, you can:
1. Rename `webapp/README_GITHUB.md` to `README.md` in the root directory if you want
2. Edit it to add your deployment URL, screenshots, etc.

## Step 4: Add GitHub Topics/Tags (Optional)

On your GitHub repository page, click on the gear icon ⚙️ next to "About" and add topics like:
- `gaussian-splatting`
- `3d-rendering`
- `webgl`
- `fastapi`
- `threejs`
- `computer-vision`

## Alternative: Push Only the Webapp Directory

If you want to create a separate repository with just the web app (without the full Sharp codebase):

```bash
# Create a new directory for the webapp-only repo
cd ~
mkdir sharp-gaussian-splat-viewer
cd sharp-gaussian-splat-viewer

# Copy webapp files
cp -r /Users/vandevi/sharp/webapp/* .
cp /Users/vandevi/sharp/webapp/README_GITHUB.md README.md

# Initialize git
git init
git add .
git commit -m "Initial commit: Sharp Gaussian Splat Web Viewer"

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/sharp-gaussian-splat-viewer.git
git branch -M main
git push -u origin main
```

**Note**: If you do this, users will need to have the Sharp codebase installed separately, or you'll need to include the necessary Sharp code in your repo.

## Recommended Approach

I recommend **keeping everything in one repo** (the full Sharp directory) because:
- The webapp depends on the Sharp model code
- Users can clone one repo and have everything
- Easier to maintain dependencies

Just make sure to update the `.gitignore` to exclude large model files, temporary files, etc.

