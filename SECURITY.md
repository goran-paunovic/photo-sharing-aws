# Security Policy

## Supported versions

This repository is an actively developed portfolio project. Security fixes are applied to the current `main` branch; older snapshots may not receive updates.

## Reporting a vulnerability

Please do not report security vulnerabilities in public GitHub issues or pull requests.

If GitHub private vulnerability reporting is enabled for this repository, use the **Security → Report a vulnerability** workflow. Otherwise, contact the repository owner privately through GitHub to arrange a secure disclosure channel.

Please include the affected component, impact, reproduction steps, and any suggested mitigation. Do not include real user data, credentials, access tokens, or private images in a report.

## Secret handling

Never commit AWS credentials, Cognito secrets, private keys, `.env` files, production data, or access tokens. If a credential is exposed, revoke or rotate it immediately; deleting it from the latest commit is not sufficient.
