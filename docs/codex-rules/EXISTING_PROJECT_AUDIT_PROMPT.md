# Existing Project — Full Codex Audit

Perform a FULL READ-ONLY audit of this existing project.

The project is already substantially built and may be close to release.

Your job in this phase is NOT to rewrite or improve the project automatically.

Your job is to inspect it carefully, compare it against the project's Codex instructions and every applicable engineering rule, identify real issues, and produce an evidence-based audit report.

---

# 1. Required Instruction Sources

Before auditing the project:

1. Read the root `AGENTS.md` completely.
2. Read the relevant project documentation.
3. Inspect the repository structure and existing architecture.
4. Review ALL rule files under:

`docs/codex-rules/source-rules/`

This directory contains the complete original engineering rule set.

Do not silently skip rule files.

Determine which rules are applicable to this project.

If a rule is not applicable, mark the corresponding audit area as `N/A`.

Pay special attention to the always-active core rules:

- `master-protocol.mdc`
- `31-project-continuity.mdc`
- `38-audit-ready-code.mdc`
- `39-ship-with-confidence.mdc`

Use `master-web-design-prompt.mdc` when the project contains a relevant web/UI design surface.

IMPORTANT:

`00-project-info.mdc` may contain AssistLynk-specific information.

Do not apply its project-specific paths, servers, repositories, infrastructure or assumptions unless this repository is actually that project.

---

# 2. PHASE 1 IS STRICTLY READ-ONLY

During this audit:

DO NOT modify any file.

DO NOT create fixes.

DO NOT auto-fix lint issues.

DO NOT format files.

DO NOT install packages.

DO NOT upgrade packages.

DO NOT change dependencies.

DO NOT modify lockfiles.

DO NOT create migrations.

DO NOT execute migrations.

DO NOT change database state.

DO NOT seed or reset databases.

DO NOT change environment variables.

DO NOT modify credentials or secrets.

DO NOT deploy anything.

DO NOT change production infrastructure.

DO NOT force-push.

DO NOT run destructive Git commands.

DO NOT delete files or data.

DO NOT rewrite the architecture.

DO NOT make cleanup commits.

The purpose of Phase 1 is inspection and reporting only.

Read-only verification commands may be run when safe.

If a verification command could modify project state, do not run it during this phase.

---

# 3. Existing Architecture Must Be Respected

This is an existing project.

Do not treat differences from example implementations in the rule files as defects by themselves.

Preserve the project's established:

- frameworks
- libraries
- architecture
- API contracts
- database design
- naming conventions
- folder structure
- deployment model
- authentication model
- storage model

unless there is concrete evidence that something is unsafe, broken, incorrect or materially harmful.

Do not recommend replacing a library/framework simply because a rule file contains another example.

Do not recommend enterprise-scale infrastructure unless this project's actual requirements justify it.

Distinguish clearly between:

- confirmed defects
- security vulnerabilities
- release blockers
- maintainability problems
- optional recommendations
- future improvements

---

# 4. First Build a Project Map

Before evaluating compliance/readiness, determine what actually exists.

Identify:

- repository structure
- applications/services
- frontend
- backend
- APIs
- databases
- caches
- queues
- workers
- authentication
- authorization
- file/storage systems
- external integrations
- Docker/container configuration
- deployment configuration
- CI/CD
- tests
- monitoring/logging
- mobile components
- real-time components
- offline behavior
- documentation

Detect the actual technology stack from repository evidence.

Do not assume the stack from documentation alone if the code says otherwise.

---

# 5. Full Audit Coverage

Audit EVERY applicable area below.

Do not silently omit categories.

1. Architecture
2. Project organization
3. Security
4. Secrets and configuration
5. Authentication
6. Authorization and permissions
7. Input validation
8. Output encoding/handling
9. API design
10. Database design
11. Database constraints
12. Database indexes
13. Database migrations
14. Data integrity
15. Error handling
16. User-facing error UX
17. Loading and empty states
18. Accessibility
19. Keyboard accessibility
20. Responsive design
21. Mobile web behavior
22. Design-system consistency
23. Asset organization
24. SEO where applicable
25. Internationalization
26. RTL where applicable
27. Unit testing
28. Integration testing
29. End-to-end testing
30. Regression protection
31. Performance
32. Frontend performance
33. Backend performance
34. Database performance
35. Caching
36. Code quality
37. Maintainability
38. Logging
39. Monitoring
40. Health checks
41. Git hygiene
42. CI
43. CD/deployment safety
44. Backup
45. Restore capability
46. Disaster recovery
47. Privacy/data handling
48. Data retention/deletion
49. Dependency security
50. Supply-chain security
51. Infrastructure
52. Infrastructure as Code where applicable
53. Threat modeling
54. Architecture documentation
55. Important technical decisions/ADRs
56. Technical debt
57. Scalability
58. Reliability
59. Concurrency where applicable
60. Cross-platform behavior where applicable
61. Mobile architecture where applicable
62. Native device APIs where applicable
63. Mobile permissions where applicable
64. App-store readiness where applicable
65. Real-time synchronization where applicable
66. Reconnection behavior where applicable
67. Offline behavior where applicable
68. Conflict resolution where applicable
69. Audit/security-review readiness
70. End-to-end ship readiness

Mark irrelevant areas as `N/A`.

Mark areas that cannot be verified as `NOT VERIFIED`.

---

# 6. Evidence Rules

Evidence is mandatory.

Do NOT mark something as `PASS` merely because no problem was immediately visible.

For each conclusion, inspect the relevant implementation.

When reporting a problem, provide:

- exact file path
- relevant component/module/function
- evidence from the implementation
- why it is a problem
- real impact
- recommended remediation

Use line numbers when practical.

Do not invent vulnerabilities.

Do not infer that a vulnerability exists solely because a specific library, pattern or control from an example is absent.

Evaluate the actual implementation.

If something is uncertain, label it clearly as:

`NOT VERIFIED`

or

`REQUIRES RUNTIME VERIFICATION`

instead of guessing.

---

# 7. Severity Classification

Use the following severity levels.

## CRITICAL

Immediate release blocker or serious risk involving areas such as:

- exploitable security vulnerability
- serious authentication/authorization bypass
- data-loss risk
- severe corruption risk
- exposed production secrets
- catastrophic production failure

## HIGH

Serious issue likely to cause:

- security weakness
- incorrect behavior
- major reliability problem
- significant production failure
- major privacy/data-integrity problem

## MEDIUM

Meaningful weakness that should be addressed but is not necessarily a release blocker.

## LOW

Maintainability, hardening, polish or future improvement.

## PASS

Verified healthy.

## N/A

Not applicable to this project.

## NOT VERIFIED

Applicable, but available evidence was insufficient to verify it safely.

---

# 8. Finding Format

Every finding must include:

**Finding ID:**  
Unique identifier.

**Severity:**  
CRITICAL / HIGH / MEDIUM / LOW

**Category:**  
Audit category.

**Type:**  
Confirmed Defect / Security Issue / Release Risk / Maintainability / Recommendation

**Location:**  
Exact file/path/component.

**Evidence:**  
What was actually observed.

**Problem:**  
What is wrong.

**Why It Matters:**  
Actual technical/business/security impact.

**Recommended Fix:**  
The safest compatible remediation.

**Compatibility Risk:**  
What existing behavior could be affected by the fix.

**Verification After Fix:**  
How the fix should be proven.

Do not combine unrelated problems into one finding merely to shorten the report.

---

# 9. Verification

Run safe READ-ONLY verification where appropriate and available.

Examples may include:

- existing test commands
- type checking
- lint checks that do not auto-fix
- builds that do not modify tracked project files
- dependency inspection
- static analysis
- Git status/diff inspection

Before executing a command, consider whether it can alter repository, database, external service or production state.

Do not run unsafe verification during Phase 1.

For every command executed, record:

- command/check
- result
- whether it passed or failed

Never claim a check passed unless it was actually executed successfully.

---

# 10. Required Final Report

Produce a structured report with the following sections.

## A. Executive Summary

Summarize:

- overall health
- release readiness
- largest risks
- number of findings by severity

Do not claim certification or formal compliance.

---

## B. Detected Project Stack

List technologies actually detected from repository evidence.

---

## C. Architecture Map

Explain:

- major applications/services
- data flow
- important integrations
- storage/database
- authentication
- deployment/runtime architecture

---

## D. Release Blockers

List all CRITICAL findings.

Also list HIGH findings that should reasonably block release.

If there are none, explicitly say so.

---

## E. Findings

Order findings:

1. CRITICAL
2. HIGH
3. MEDIUM
4. LOW

Use the complete finding format defined above.

---

## F. Complete Coverage Matrix

Create a table covering EVERY audit category.

For each category provide:

- status
- evidence/location
- short note

Allowed statuses:

- PASS
- CRITICAL
- HIGH
- MEDIUM
- LOW
- N/A
- NOT VERIFIED

No audit category may disappear from the matrix.

---

## G. Verification Actually Performed

List all commands/checks actually executed and their results.

---

## H. Verification Not Performed

List checks that would be useful but could not safely or practically be performed during the read-only audit.

Explain why.

---

## I. Remediation Plan

Create a proposed remediation sequence:

1. CRITICAL
2. HIGH
3. MEDIUM
4. LOW

Prefer:

- smallest safe changes
- backward compatibility
- preserving architecture
- testable changes
- reviewable batches

Identify dependencies between fixes where relevant.

DO NOT implement the remediation plan yet.

---

# 11. Compliance / Certification Claims

A source-code audit does NOT automatically prove formal compliance or certification.

Do not claim that the project is:

- certified
- officially compliant
- audit approved
- OWASP certified
- CASA approved
- Google approved
- Meta approved
- Apple approved

unless actual evidence of that external approval exists.

You may instead state that an implementation appears:

- aligned
- partially aligned
- audit-ready
- not audit-ready
- requiring additional verification

when supported by evidence.

---

# 12. Final Stop Condition

After completing the report:

STOP.

Do not fix anything.

Do not edit anything.

Do not begin remediation.

Wait for explicit user approval before making any project changes.