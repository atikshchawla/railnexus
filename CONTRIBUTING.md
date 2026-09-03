# GitHub Workflow Rules

This document outlines the standard Git and GitHub workflow for this repository. Please follow these rules carefully to ensure a smooth and conflict-free development process.

## Repository Branches

- **`main`**: The stable, production-ready branch. **Never commit directly to `main`.**
- **`dev`**: The active development branch. All new features and bug fixes are integrated here first. Only final, working code should end up in `dev`.

## Development Process

### 1. Update your local `dev` branch
Before starting any new work, always ensure your local `dev` branch is up to date with the remote repository:

```bash
git checkout dev
git pull origin dev
```

### 2. Create a feature branch
Never work directly on `dev` or `main`. Create a new feature branch branching off from `dev`. Use a descriptive name for your branch (e.g., `feat/login-ui`, `fix/navbar-bug`).

```bash
git checkout -b feat/your-feature-name
```

### 3. Make changes and commit
Do your work on this feature branch. When you are ready to save your progress, commit your changes. 

```bash
git add .
git commit -m "feat(scope): add description of the feature"
```

### 4. Push your feature branch
Push your branch to the remote repository.

```bash
git push origin feat/your-feature-name
```

### 5. Create a Pull Request (PR)
Go to GitHub and open a Pull Request.
- **Base branch:** `dev`
- **Compare branch:** `feat/your-feature-name`

Add a clear title and description explaining what changes you made and why. Wait for your PR to be reviewed and approved.

### 6. Merging to `dev`
Once your PR is reviewed and approved, it will be merged into the `dev` branch. 

### 7. Releasing to `main`
When the `dev` branch reaches a stable point and is ready for a release, a Pull Request will be created to merge `dev` into `main`. This ensures that only stable versions make it to the main branch. **Do not create PRs directly to `main` for regular features.**
