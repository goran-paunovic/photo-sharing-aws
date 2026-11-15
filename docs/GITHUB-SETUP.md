# GitHub repository setup

## 1. Create a public repository

Create an **empty** public repository named `photo-sharing-app` on GitHub. Do not initialize it with a README, `.gitignore`, or license because this project already contains those files.

## 2. Check the working tree before publishing

From the project root:

```powershell
git status --short
```

Confirm that no `.env` files, credentials, certificates, local build output, `node_modules`, Maven `target`, Python caches, or AWS configuration files are staged.

## 3. Generate npm lockfiles

Run once in each npm project and commit the resulting lockfiles:

```powershell
cd frontend
npm install
cd ..\infrastructure
npm install
cd ..
```

The CI workflow intentionally uses `npm ci`; it requires the committed lockfiles.

## 4. Initialize and push

Run from the project root:

```powershell
git init
git branch -M main
git add .
git status --short
git commit -m "Initial photo-sharing application"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/photo-sharing-app.git
git push -u origin main
```

Replace `YOUR_GITHUB_USERNAME` with your GitHub username. If Git reports that `origin` already exists, inspect it with `git remote -v` rather than adding a second remote.

## 5. Configure repository protections

In **Settings → Rules → Rulesets** (or branch protection settings), protect `main`:

- Require pull requests before merging.
- Require the CI checks (`Frontend · lint and build`, `Backend · Maven verify`, `Thumbnail Lambda · Python tests`, and `Infrastructure · compile and synthesize`) to pass.
- Block force pushes and branch deletion.
- Require approval if another collaborator will review changes.

For a solo portfolio repository, requiring an independent approving review may block your own merges. Keep required CI checks, and enable approvals when collaborators are involved.

Enable Dependabot alerts and, if available, private vulnerability reporting and secret scanning/push protection.

## 6. First CI run

Open the repository's **Actions** tab. The initial push to `main` should start the CI workflow. Fix any failed job before enabling branch rules that require it.

The infrastructure synthesis job uses Docker-based Lambda asset bundling. GitHub-hosted Ubuntu runners provide Docker, but the CDK bundling command and the Python 3.14 image still need to be validated by the first real workflow run.

## 7. License decision

Before presenting the repository as open source, choose a license (for example MIT or Apache-2.0) and add its full license text as `LICENSE`. Do not add a license without deciding which reuse rights you want to grant.
