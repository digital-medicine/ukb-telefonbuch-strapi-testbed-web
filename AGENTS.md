# Agent Instructions

`SYSTEM.md` is this repository's technical long-term memory. Before any substantial change, read it, apply its architectural decisions and maintenance rules, and check whether the planned work violates an existing assumption.

After every change, ask: “Does this affect architecture, functional requirements, components, configuration, deployment, persistence, interfaces, security, operations, central dependencies, maintenance, technical debt, or known risks?” If yes, update only the affected parts of `SYSTEM.md` in the same work item, remove stale facts, and add a Change Log entry for a material architectural, deployment, operational, or central-behavior change. If no, do not make cosmetic documentation edits just to create a diff.

Documentation is part of the definition of done: work is not complete if it leaves `SYSTEM.md` demonstrably stale. If implementation and documentation disagree, investigate the discrepancy; code is authoritative until clarified, after which correct the documentation.

For this project especially, preserve server-only handling of Strapi and LDAP secrets, enforce authorization in route handlers rather than UI, and review `SYSTEM.md` before changing identity, Strapi relations, LDAP ownership, organization hierarchy or deployment assumptions.
