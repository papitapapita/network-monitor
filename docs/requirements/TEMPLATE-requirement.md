# REQ-XXX: [Feature Name]

## Metadata

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-XXX |
| **Sprint** | Sprint X |
| **Priority** | [High/Medium/Low] |
| **Status** | [Planned/In Progress/Completed/Blocked] |
| **Created** | YYYY-MM-DD |
| **Last Updated** | YYYY-MM-DD |
| **Epic** | [Epic Name] |
| **Estimated Story Points** | [Points] |

---

## Feature Overview

### Summary
[Brief 2-3 sentence description of the feature and its core functionality]

### Business Value
[Explain why this feature matters to the business and users]
- [Key benefit 1]
- [Key benefit 2]
- [Key benefit 3]

---

## Domain Context

### Affected Bounded Contexts
- **[Context Name]** (Primary)
- **[Context Name]** (Supporting)

### Involved Aggregates
- **[Aggregate Name]** ([Context Name])
  - [Root Entity]
  - [Child Entities]

### Key Domain Concepts
- **[Concept 1]**: [Definition]
- **[Concept 2]**: [Definition]

---

## User Stories

### Primary User Story
```
[Original user story in user's language if applicable]
```

**Translation**: *[English translation]*

### Decomposed User Stories

#### US-XXX.1: [Story Title]
**As a** [role]
**I want** [feature]
**So that** [benefit]

#### US-XXX.2: [Story Title]
**As a** [role]
**I want** [feature]
**So that** [benefit]

---

## Acceptance Criteria

### AC-XXX.1: [Criterion Title]
- **Given** [context]
- **When** [action]
- **Then** [expected outcome]
- **And** [additional expectation]

### AC-XXX.2: [Criterion Title]
- **Given** [context]
- **When** [action]
- **Then** [expected outcome]

---

## Functional Requirements

### FR-XXX.1: [Requirement Title]
[Detailed description of functional requirement]

### FR-XXX.2: [Requirement Title]
[Detailed description of functional requirement]

---

## Non-Functional Requirements

### Performance Requirements

#### NFR-XXX.1: [Performance Metric]
[Specific, measurable performance requirement]

### Reliability Requirements

#### NFR-XXX.2: [Reliability Metric]
[Specific reliability requirement]

### Usability Requirements

#### NFR-XXX.3: [Usability Requirement]
[User experience requirement]

---

## Technical Constraints

### TC-XXX: [Constraint Title]
[Description of technical constraint or limitation]

---

## Dependencies

### Internal Dependencies
- **[Component/Service]**: [Why it's needed]

### External Dependencies
- **[External System/API]**: [Why it's needed]

---

## Assumptions

### Business Assumptions
- [Assumption about business rules or user behavior]

### Technical Assumptions
- [Assumption about system behavior or technical environment]

---

## Risk Analysis

### Risk 1: [Risk Name]
**Severity**: [High/Medium/Low]
**Probability**: [High/Medium/Low]
**Description**: [Detailed risk description]

**Indicators**:
- [How to detect this risk]

**Mitigation**:
- [Strategy to prevent or reduce impact]

---

## Alternative Solutions Considered

### Alternative 1: [Solution Name]
**Description**: [What this alternative involves]

**Pros**:
- [Advantage]

**Cons**:
- [Disadvantage]

**Decision**: [Why chosen or not chosen]

---

## Security Considerations

### SEC-XXX: [Security Requirement]
**Requirement**: [Security need]
**Implementation**: [How to address it]

---

## User Roles & Permissions

| Role | [Permission 1] | [Permission 2] | [Permission 3] |
|------|----------------|----------------|----------------|
| **[Role Name]** | ✓/✗ | ✓/✗ | ✓/✗ |

---

## Audit & Logging Requirements

### [Log Category] Logs
**Retention**: [Duration]

**Required Fields**:
- [Field 1]
- [Field 2]

**Example**:
```json
{
  "field1": "value1",
  "field2": "value2"
}
```

---

## Testing Requirements

### Unit Testing
- [Test requirement 1]
- **Coverage Target**: > X%

### Integration Testing
- [Test requirement 1]

### Performance Testing
- [Performance test scenario]
- **Target**: [Specific metric]

---

## Integration Requirements

### INT-XXX: [Integration Name]
[Description of integration requirement]

**Integration Points**:
- [Point 1]

---

## Failover & Redundancy

### FAIL-XXX: [Failover Mechanism]
[Description of how system handles failures]

---

## Maintenance & Support Requirements

### Error Reporting
[Requirements for error messages and logging]

### Diagnostic Tools
[Tools needed for troubleshooting]

### Documentation
- [Required documentation]

---

## Definition of Done

This requirement is considered complete when:

- [ ] All acceptance criteria met and verified
- [ ] [Specific completeness criterion]
- [ ] Unit tests written with > X% coverage
- [ ] Integration tests pass
- [ ] Code reviewed and approved
- [ ] Documentation completed
- [ ] Deployed to staging
- [ ] UAT passed
- [ ] Production deployment approved

---

## Related Documents

- [ARCHITECTURE.md](/docs/ARCHITECTURE.md)
- [DOMAIN-MODEL.md](/docs/DOMAIN-MODEL.md)
- [Other related docs]

---

## Notes

### Open Questions
1. [Question that needs answering]
   - **Proposal**: [Suggested answer]

### Future Enhancements
- [Potential future improvement]
