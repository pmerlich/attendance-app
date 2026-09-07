# AGENTS.md — Universal Codex Project Protocol

## Purpose

This repository uses a comprehensive engineering rule set adapted for OpenAI Codex.

This file is the main instruction map for Codex.

The complete detailed rules are stored under:

`docs/codex-rules/source-rules/`

Do not assume every rule is relevant to every task.
Before changing code, identify the task type and read the relevant detailed rule files.

---

## 1. Instruction Priority

When instructions conflict, use this priority:

1. Direct user instructions for the current task.
2. This `AGENTS.md`.
3. Project-specific documentation and established working behavior.
4. Relevant detailed rules under `docs/codex-rules/source-rules/`.
5. Generic examples contained inside rule files.

Generic examples are guidance, not mandatory technology choices.

Never replace a working project architecture merely because a rule file contains a different example.

---

## 2. Existing Project Protection

This is especially important for projects that are already substantially built.

DO NOT use these rules as justification for unnecessary rewrites.

For an existing project:

- Inspect before editing.
- Understand the existing architecture first.
- Preserve working behavior.
- Preserve backward compatibility.
- Prefer targeted fixes over broad rewrites.
- Follow existing framework and repository conventions where safe.
- Do not replace libraries merely because another library appears in a rule example.
- Do not introduce unnecessary infrastructure.
- Do not introduce unnecessary abstractions.
- Do not introduce dependencies without a concrete reason.
- Do not perform large refactors unrelated to the requested task.
- Do not silently change public APIs.
- Do not silently change database behavior.
- Do not silently change authentication behavior.
- Do not silently change storage formats.
- Do not silently change deployment behavior.

Before destructive or irreversible operations, require explicit user approval.

This includes, where applicable:

- deleting data
- deleting files
- database resets
- destructive migrations
- force pushes
- destructive Git operations
- production deployments
- credential changes
- production configuration changes
- removing storage/volumes
- irreversible infrastructure operations

Never expose secrets.

Never place credentials, API keys, tokens, passwords or private secrets into:

- source code
- Git
- logs
- reports
- screenshots
- documentation intended for sharing

---

# 3. Always-Active Core Rules

For every substantial coding task, read and apply the relevant parts of:

`docs/codex-rules/source-rules/master-protocol.mdc`

`docs/codex-rules/source-rules/31-project-continuity.mdc`

`docs/codex-rules/source-rules/38-audit-ready-code.mdc`

`docs/codex-rules/source-rules/39-ship-with-confidence.mdc`

These are the core project rules.

### Important adaptation

Some original files were written for another coding-agent environment.

Interpret agent-specific references according to the current Codex environment.

Do not blindly execute instructions that only make sense for another agent/tool.

Preserve the engineering intent.

---

# 4. Rule Routing

Read the following files whenever the task touches their area.

## Project-specific information

`00-project-info.mdc`

WARNING:

This file may contain information belonging to the original AssistLynk project.

Do NOT apply AssistLynk-specific:

- paths
- servers
- repositories
- credentials
- infrastructure
- project names
- environment assumptions

to another project.

Use this file only when actually working on the project it describes.

---

## Security

`01-security-fortress.mdc`

Use for:

- input validation
- sanitization
- XSS
- CSRF
- authentication
- authorization
- sessions
- encryption
- API security
- rate limiting
- uploads
- security headers
- secure error handling

---

## SEO

`02-seo-excellence.mdc`

Use for public/indexable web pages involving:

- metadata
- schema
- sitemap
- robots
- search indexing
- Core Web Vitals
- internal linking
- SEO performance

Do not force SEO requirements onto internal tools where they are irrelevant.

---

## Assets

`03-global-assets-organization.mdc`

Use for:

- CSS organization
- JavaScript organization
- static assets
- design tokens
- image/font loading
- frontend asset architecture

---

## Configuration & Secrets

`04-config-security-management.mdc`

Use for:

- environment variables
- `.env`
- secrets
- API keys
- credentials
- config management
- secret rotation

---

## URLs & Routing

`05-clean-url-structure.mdc`

Use for:

- routing
- clean URLs
- redirects
- route structure
- web server routing

---

## Responsive Web

`06-mobile-responsive-design.mdc`

Use for:

- mobile-first design
- breakpoints
- touch targets
- responsive layouts
- responsive images
- PWA
- mobile navigation

---

## Project Organization

`07-project-organization.mdc`

Use when:

- creating new modules
- reorganizing code
- evaluating folder structure
- creating a new project

For existing projects, do NOT reorganize everything merely to match an example.

---

## AI Communication

`08-ai-communication-style.mdc`

Use for:

- communication style
- migrations
- feature documentation
- implementation explanations

---

## Design System

`09-design-system.mdc`

Use for:

- colors
- typography
- spacing
- components
- UI consistency
- reusable design tokens

---

## Local Development

`10-local-development-environment.mdc`

Use for:

- development setup
- Docker development
- Node
- Python
- Java
- PHP
- local databases
- environment setup
- debugging local setup

---

## Accessibility

`11-accessibility-wcag.mdc`

Use for:

- semantic HTML
- keyboard navigation
- screen readers
- ARIA
- contrast
- focus
- forms
- accessible media
- reduced motion

---

## Error Handling & UX

`12-error-handling-ux.mdc`

Use for:

- error pages
- API/user errors
- loading states
- empty states
- form validation
- network failures
- user-friendly errors

Never expose raw sensitive stack traces to end users.

---

## API Design

`13-api-design-standards.mdc`

Use for:

- REST APIs
- HTTP methods
- status codes
- JSON responses
- authentication
- CORS
- pagination
- validation
- API versioning
- endpoint lifecycle

---

## Database

`14-database-design.mdc`

Use for:

- schemas
- migrations
- indexes
- constraints
- relationships
- SQL
- NoSQL
- Redis
- database backups
- query performance

Never perform destructive database operations merely to satisfy a style preference.

---

## Git

`15-git-workflow.mdc`

Use for:

- branches
- commits
- `.gitignore`
- merge strategy
- repository hygiene

Never force-push or perform destructive Git operations without explicit approval.

---

## Guided Setup

`16-guided-setup-assistance.mdc`

Use when helping with:

- external services
- deployment
- environment setup
- developer tools
- server setup
- troubleshooting

When human interaction is required, work step-by-step and verify before continuing.

---

## Testing

`17-testing-strategy.mdc`

Use for:

- unit tests
- integration tests
- E2E tests
- security tests
- performance tests
- regression testing

Do not claim a test passed unless it was actually executed successfully.

---

## Performance

`18-performance-optimization.mdc`

Use for:

- frontend performance
- backend performance
- caching
- database performance
- CDN
- Core Web Vitals
- memory
- network optimization

Optimize based on evidence where possible.

Avoid premature architecture rewrites.

---

## Code Quality

`19-code-quality-standards.mdc`

Use for:

- readability
- naming
- DRY
- linting
- formatting
- complexity
- maintainability
- code review

Do not perform unrelated cleanup during a focused bug fix unless necessary.

---

## Logging & Monitoring

`20-logging-monitoring.mdc`

Use for:

- structured logs
- log levels
- monitoring
- alerts
- health checks
- metrics
- tracing
- SLO/SLI
- operational visibility

Never log secrets or sensitive credentials.

---

## CI/CD

`21-ci-cd-pipeline.mdc`

Use for:

- CI
- CD
- automated tests
- deployment pipelines
- staging
- production
- feature flags
- rollback

---

## Backup & Disaster Recovery

`22-backup-disaster-recovery.mdc`

Use for:

- backups
- restore
- integrity verification
- RPO
- RTO
- disaster recovery
- storage failure
- recovery procedures

A backup is not considered reliable solely because files were copied.

Restore capability and integrity should be verifiable.

---

## Internationalization

`23-internationalization.mdc`

Use for:

- i18n
- l10n
- RTL
- translations
- dates
- numbers
- currency
- pluralization

---

## Incident Management

`24-incident-management.mdc`

Use for:

- production incidents
- severity classification
- response procedures
- runbooks
- postmortems
- operational recovery

---

## Privacy

`25-data-privacy-compliance.mdc`

Use for:

- PII
- user data
- consent
- retention
- deletion
- privacy controls
- breach handling

Apply specific legal/compliance frameworks only where they actually apply.

Never claim legal certification based only on source-code review.

---

## Supply Chain Security

`26-supply-chain-security.mdc`

Use for:

- dependencies
- lockfiles
- vulnerability scanning
- package integrity
- dependency updates
- SBOM

---

## Infrastructure as Code

`27-infrastructure-as-code.mdc`

Use for:

- Docker
- Docker Compose
- Kubernetes
- Terraform
- infrastructure configuration
- environment parity

Do not introduce Kubernetes/Terraform merely because the rule describes them.

---

## Threat Modeling

`28-threat-modeling.mdc`

Use for:

- STRIDE
- attack surface
- OWASP
- threat analysis
- trust boundaries
- abuse cases
- defense in depth

---

## Architecture Decisions

`29-architecture-decisions.mdc`

Use for:

- ADRs
- architecture documentation
- major technical decisions
- technical debt
- system diagrams

Do not generate unnecessary documentation for trivial decisions.

---

## Scalability

`30-scalability-patterns.mdc`

Use for:

- horizontal scaling
- vertical scaling
- load balancing
- caching
- queues
- asynchronous jobs
- database scaling
- connection pooling
- circuit breakers
- reliability

Do not introduce enterprise-scale complexity without demonstrated need.

---

## Project Continuity

`31-project-continuity.mdc`

Use to preserve:

- current project state
- previous decisions
- active work
- implementation continuity
- known blockers
- next steps

Adapt references to agent-specific files to the actual Codex/project documentation.

---

## Cross Platform

`32-cross-platform-development.mdc`

Use for:

- React Native
- Expo
- Android
- iOS
- web sharing
- monorepos
- platform-specific code

---

## Mobile Design

`33-mobile-app-design.mdc`

Use for:

- Material Design
- Apple HIG
- mobile navigation
- touch targets
- RTL
- dark mode
- safe areas
- haptics

---

## App Store Deployment

`34-app-store-deployment.mdc`

Use for:

- Google Play
- Apple App Store
- APK
- AAB
- signing
- certificates
- OTA
- mobile release workflows

---

## Mobile Architecture

`35-mobile-app-architecture.mdc`

Use for:

- navigation
- state management
- offline behavior
- push notifications
- deep linking
- local storage

---

## Native Device APIs

`36-native-device-apis.mdc`

Use for:

- camera
- location
- biometrics
- secure storage
- permissions
- haptics
- audio
- video

---

## Real-Time Sync

`37-real-time-sync.mdc`

Use for:

- real-time updates
- shared backend
- offline queues
- synchronization
- reconnect behavior
- conflict resolution

---

## Audit Ready Code

`38-audit-ready-code.mdc`

Apply relevant secure engineering requirements.

IMPORTANT:

Do not falsely claim:

- certification
- compliance
- audit approval
- OWASP compliance
- CASA approval
- Google approval
- Meta approval
- Apple approval

unless such approval was actually obtained.

Source review can identify readiness and issues; it cannot itself grant certification.

---

## Ship With Confidence

`39-ship-with-confidence.mdc`

"Done" means actual working functionality.

Do not present as finished:

- TODOs
- placeholders
- fake implementations
- incomplete mocks
- unconnected UI
- unverified endpoints
- stubs pretending to be production features

Verify end-to-end where feasible.

---

# 5. Web Design Reference

For substantial website creation or visual redesign, also read:

`master-web-design-prompt.mdc`

Use it as design guidance.

Do not allow visual experimentation to override:

- accessibility
- usability
- performance
- project requirements
- existing brand/design requirements

---

# 6. Mandatory Workflow Before Editing

Before changing code:

1. Inspect repository structure.
2. Identify languages and frameworks.
3. Read existing project documentation.
4. Understand existing architecture.
5. Identify relevant rule files.
6. Read those rule files.
7. Inspect existing implementation.
8. Check Git status when Git is available.
9. Identify the smallest safe change.
10. Determine possible compatibility risks.

If ambiguity materially changes implementation, ask the user.

Otherwise proceed with the safest compatible interpretation.

---

# 7. Mandatory Workflow While Editing

While changing code:

1. Preserve unrelated working behavior.
2. Follow established repository conventions.
3. Validate at trust boundaries.
4. Keep secrets outside source code.
5. Handle errors safely.
6. Avoid unrelated refactors.
7. Add or update tests when behavior changes.
8. Keep database/schema/migrations synchronized.
9. Keep API contracts synchronized.
10. Keep configuration/documentation synchronized where necessary.
11. Consider backward compatibility.
12. Consider security implications.
13. Consider data-loss implications.
14. Consider deployment implications.

---

# 8. Definition of Done

Before saying a task is complete:

1. Review the actual diff.
2. Check for accidental changes.
3. Run relevant tests where available.
4. Run lint where relevant.
5. Run type checking where relevant.
6. Run build where relevant.
7. Verify database/migration implications.
8. Verify configuration/environment implications.
9. Exercise the changed user path end-to-end where feasible.
10. Check for untracked accidental files.
11. Check for obvious security regressions.
12. Report what was actually verified.
13. Report what could not be verified.

Never say something passed if it was not actually tested.

Never hide failed verification.

---

# 9. EXISTING PROJECT AUDIT MODE

When the user asks:

- audit the project
- review the project
- check whether the project follows the rules
- check production readiness
- check whether the project is built correctly

enter AUDIT MODE.

## Phase 1 is READ-ONLY

During the first audit phase:

DO NOT modify files.

DO NOT auto-fix.

DO NOT install packages.

DO NOT upgrade dependencies.

DO NOT deploy.

DO NOT change database state.

DO NOT run destructive commands.

DO NOT rewrite architecture.

First inspect and report.

---

# 10. Full Audit Coverage

Evaluate every applicable category:

1. Architecture
2. Project organization
3. Security
4. Secrets/configuration
5. Authentication
6. Authorization
7. Input validation
8. Output handling
9. API design
10. Database design
11. Schema
12. Migrations
13. Indexes
14. Error handling
15. User experience
16. Accessibility
17. Responsive design
18. Design system
19. Assets
20. SEO where applicable
21. Internationalization
22. RTL where applicable
23. Testing
24. Performance
25. Code quality
26. Logging
27. Monitoring
28. Git hygiene
29. CI/CD
30. Backup
31. Disaster recovery
32. Privacy/data handling
33. Dependency security
34. Supply-chain security
35. Infrastructure
36. Infrastructure as Code
37. Threat model
38. Architecture documentation
39. Technical debt
40. Scalability
41. Reliability
42. Cross-platform architecture where applicable
43. Mobile architecture where applicable
44. Native APIs where applicable
45. App-store readiness where applicable
46. Real-time synchronization where applicable
47. Offline behavior where applicable
48. Security-review readiness
49. End-to-end ship readiness

Do not skip a category silently.

Mark irrelevant categories as N/A.

---

# 11. Audit Severity

Use:

## CRITICAL

Immediate:

- security risk
- data-loss risk
- severe production failure
- release blocker

## HIGH

Serious problem likely to cause:

- security weakness
- incorrect behavior
- major reliability issue
- production failure

## MEDIUM

Meaningful weakness that should be scheduled.

## LOW

Maintainability, polish, future hardening or improvement.

## PASS

Verified healthy.

## N/A

Not applicable.

---

# 12. Required Audit Finding Format

For every non-PASS finding include:

- Finding ID
- Severity
- Category
- Exact file/path/component
- Evidence
- Problem
- Why it matters
- Recommended fix
- Compatibility risk
- Verification required after fixing

Distinguish:

**Confirmed defect**

from:

**Recommendation**

Never present assumptions as confirmed defects.

---

# 13. Required Audit Report

The final audit report must contain:

## 1. Executive Summary

Overall project health.

## 2. Detected Project Stack

Languages, frameworks, databases, infrastructure and services actually detected.

## 3. Architecture Map

Major components and relationships.

## 4. Release Blockers

CRITICAL/HIGH findings affecting release.

## 5. Findings

Sorted:

CRITICAL → HIGH → MEDIUM → LOW.

## 6. Complete Coverage Matrix

Every audit category must have:

- PASS
- CRITICAL
- HIGH
- MEDIUM
- LOW
- N/A
- NOT VERIFIED

## 7. Verification Performed

List actual:

- tests
- builds
- lint
- type checks
- security checks
- runtime checks

that were executed.

## 8. Verification Not Performed

State what could not be verified and why.

## 9. Remediation Plan

Safest recommended order.

After producing the audit report:

STOP.

Wait for explicit user approval before remediation.

---

# 14. Remediation Mode

After the user approves fixes:

Fix in this order:

1. CRITICAL
2. HIGH
3. MEDIUM
4. LOW when useful/requested

Use small reviewable changes.

After each group:

- review diff
- run relevant tests
- verify affected functionality
- update audit status

Do not mark a finding resolved without evidence.

---

# 15. Project Continuity

Use existing project documentation where available, such as:

- `README.md`
- `ARCHITECTURE.md`
- `docs/PROGRESS.md`
- `docs/DECISIONS.md`
- `docs/INFRASTRUCTURE.md`
- `docs/PROJECT_STATE.md`

Do not automatically create all of these.

Create documentation only when justified by:

- project complexity
- continuity needs
- important decisions
- user request

Never overwrite useful existing documentation without understanding it first.

---

# 16. Communication Rules

Be concise and concrete.

When performing work, clearly distinguish:

- what was changed
- what was verified
- what was not verified
- blockers
- next step

For interactive setup involving external tools/services:

Give one actionable step at a time when user interaction is required.

Wait for the result before continuing when the next step depends on it.

Do not overwhelm the user with unnecessary commands.

---

# 17. Final Principle

The goal is not to make every project look identical.

The goal is to produce software that is:

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

Apply rules intelligently and proportionally.

Evidence is more important than assumptions.

Working behavior is more important than stylistic conformity.

Security and data integrity are more important than convenience.

Never claim completion without verification.