# CLAUDE.md — Project Engineering Protocol

## Purpose

This repository uses the complete engineering rule set located at:

`docs/codex-rules/source-rules/`

Although the directory is named `codex-rules`, the `.mdc` files inside it are the original engineering rules and are authoritative for this project.

The directory contains 42 rule files:
- `00-project-info.mdc` through `39-ship-with-confidence.mdc`
- `master-protocol.mdc`
- `master-web-design-prompt.mdc`

Do not silently ignore applicable rules.

---

## Instruction Priority

When instructions conflict, follow this order:

1. The user's explicit instruction for the current task.
2. This `CLAUDE.md`.
3. Existing project requirements, documentation, architecture, and working behavior.
4. Applicable rules under `docs/codex-rules/source-rules/`.
5. Generic examples inside the rule files.

Examples in rule files are examples, not mandatory technology choices.

---

## Existing Project Protection

This is an EXISTING project that is already substantially developed and may be close to release.

Before making changes:

- Inspect the existing implementation.
- Understand the current architecture.
- Preserve working behavior.
- Preserve backward compatibility.
- Prefer targeted changes over broad rewrites.
- Follow existing repository conventions where safe.
- Do not replace frameworks or libraries merely because a rule contains another example.
- Do not reorganize the entire project merely to match a suggested folder structure.
- Do not introduce unnecessary infrastructure.
- Do not introduce unnecessary dependencies.
- Do not perform unrelated refactoring.
- Do not silently change APIs, authentication, database behavior, storage formats, or deployment behavior.

A difference between the existing implementation and an example in a rule file is NOT automatically a defect.

Require explicit user approval before destructive or high-risk operations.

Never expose secrets, credentials, tokens, passwords, or API keys.

---

## Mandatory Core Rules

For substantial work, always consider and apply the relevant requirements from:

- `master-protocol.mdc`
- `31-project-continuity.mdc`
- `38-audit-ready-code.mdc`
- `39-ship-with-confidence.mdc`

For substantial web/UI design work, also consider:

- `master-web-design-prompt.mdc`

---

## Rule Selection

Before implementing a task:

1. Determine which engineering areas the task affects.
2. Read the corresponding `.mdc` files.
3. Apply all relevant requirements.
4. Consider interactions with other applicable rules.

The complete rule set covers:

- project information
- security
- SEO
- assets
- configuration and secrets
- URLs/routing
- responsive design
- project organization
- communication
- design system
- local development
- accessibility
- error handling and UX
- API design
- database design
- Git
- guided setup
- testing
- performance
- code quality
- logging and monitoring
- CI/CD
- backup/disaster recovery
- internationalization
- incident management
- privacy
- supply-chain security
- infrastructure as code
- threat modeling
- architecture decisions
- scalability
- project continuity
- cross-platform development
- mobile design
- app-store deployment
- mobile architecture
- native device APIs
- real-time synchronization
- audit readiness
- ship readiness

---

## Important Rule 00 Exception

`00-project-info.mdc` may contain project-specific information from the environment where the rule package was originally created.

Do not automatically apply project-specific:

- names
- paths
- repositories
- servers
- IP addresses
- infrastructure
- credentials
- deployment assumptions

unless they actually belong to this repository.

General engineering principles from the file may still be considered where relevant.

---

## Before Editing

Before changing code:

1. Inspect repository structure.
2. Detect the actual languages/frameworks.
3. Read relevant existing documentation.
4. Understand the architecture.
5. Inspect the existing implementation.
6. Read applicable rule files.
7. Check Git status where available.
8. Identify the smallest safe change.
9. Identify compatibility/security/data risks.
10. Then implement.

Do not make assumptions that repository evidence can answer.

---

## While Editing

During implementation:

- Preserve unrelated behavior.
- Follow existing conventions.
- Validate trust boundaries.
- Keep secrets outside source code.
- Handle errors safely.
- Avoid unrelated refactors.
- Update tests when behavior changes.
- Keep schema/migrations synchronized when applicable.
- Keep API contracts synchronized.
- Maintain backward compatibility where required.
- Consider security.
- Consider data-loss risk.
- Consider deployment impact.

---

## Definition of Done

Do not claim a task is complete merely because code was written.

Where applicable:

1. Review the actual diff.
2. Check for accidental modifications.
3. Run relevant tests.
4. Run lint without auto-fixing unrelated code.
5. Run type checking.
6. Run the relevant build.
7. Verify database/migration implications.
8. Verify configuration implications.
9. Exercise the affected flow end-to-end where feasible.
10. Check Git status.
11. Check for obvious security regressions.
12. Report what was actually verified.
13. Report what could not be verified.

Never claim that a test/check passed unless it actually ran successfully.

---

# AUDIT MODE

When the user requests a project audit, production-readiness review, or asks to check the existing project against these rules, enter AUDIT MODE.

The audit instructions are located at:

`docs/codex-rules/EXISTING_PROJECT_AUDIT_PROMPT.md`

Read that file completely before starting the audit.

## Phase 1 — Read-Only

During Phase 1:

- Do not modify existing project files.
- Do not auto-fix.
- Do not format project files.
- Do not install or upgrade packages.
- Do not modify dependencies or lockfiles.
- Do not create or execute migrations.
- Do not modify database state.
- Do not modify environment configuration.
- Do not deploy.
- Do not perform destructive Git operations.
- Do not delete files/data.
- Do not begin remediation.

Safe read-only inspection and verification may be performed.

---

## Audit Reports Exception

During an explicitly requested full audit, the ONLY files Claude is allowed to create/write are:

`docs/codex-rules/AUDIT_REPORT_HE.md`

and:

`docs/codex-rules/AUDIT_REPORT_EN.md`

No other project files may be modified during Phase 1.

### Hebrew report

`AUDIT_REPORT_HE.md` must contain the COMPLETE audit in professional Hebrew.

Technical identifiers such as paths, commands, class/function names, API routes, package names, and code identifiers should remain in their original form where appropriate.

### English report

`AUDIT_REPORT_EN.md` must contain the same complete audit in English.

Both reports must contain identical:

- Finding IDs
- severity classifications
- evidence
- conclusions
- release blockers
- coverage statuses
- verification results
- remediation recommendations

The English report is a language version of the same audit, not a separate audit.

---

## Audit Evidence

Audit conclusions must be evidence-based.

Do not:

- invent vulnerabilities
- infer defects solely from missing example patterns
- mark PASS without verification
- claim formal certification
- claim external audit approval

Clearly distinguish:

- confirmed defect
- security issue
- release risk
- maintainability issue
- recommendation
- N/A
- NOT VERIFIED

When evidence is insufficient, use `NOT VERIFIED`.

---

## Audit Completion

After completing the audit:

1. Write the complete Hebrew report.
2. Write the complete English report.
3. Verify that all 42 rule files were considered.
4. Verify that all applicable audit categories were evaluated.
5. Verify that no existing project files were modified.
6. Report the number of CRITICAL/HIGH/MEDIUM/LOW findings.
7. STOP.

Do NOT begin fixing findings.

Wait for explicit user approval.

---

## Remediation

Only after explicit approval:

1. CRITICAL
2. HIGH
3. MEDIUM
4. LOW where useful/requested

Use small, reviewable changes.

After each group:

- inspect the diff
- test affected behavior
- verify the fix
- check for regressions

Do not mark a finding resolved without verification.

---

## Communication

Be concise and concrete.

Clearly distinguish:

- changed
- verified
- not verified
- blocked
- next step

For interactive external setup/troubleshooting, provide one actionable step at a time when the next step depends on user feedback.

---

## Final Principle

The objective is not to force every project into the same architecture.

The objective is software that is:

- secure
- correct
- maintainable
- testable
- recoverable
- observable
- performant
- accessible where applicable
- scalable where required
- compatible with existing behavior
- genuinely ready to ship

Evidence is more important than assumptions.

Working behavior is more important than stylistic conformity.

Security and data integrity are more important than convenience.

Never claim completion without verification.