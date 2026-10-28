---
name: change-suspects
description: Answers "what changed just before this incident started?" for incidents tracked in Jira, using the Change Suspects tools on the Atlassian MCP server. Use when someone asks what changed before an outage or incident, which change is the likely culprit, or which recent incidents still have no suspected cause.
---

# Change Suspects

Change Suspects is a Forge app for Jira. For an incident work item it lists the changes that went in before the
incident started, ranked with the evidence for each: how long before the start the change was resolved or deployed,
the components and labels it shares with the incident, the words the two descriptions share and the change risk when
one is recorded. This skill tells an MCP client how to call the app's three tools and how to report what they return.

## Connect

1. A site admin installs Change Suspects and turns on "Expose tools to MCP-compatible apps" for its Jira installation:
   Atlassian Administration > Apps > Sites > your site > Connected apps > Change Suspects > app details. External MCP
   access is part of Atlassian's Early Access Program and is off by default.
2. Add `https://mcp.atlassian.com/forge/2b128bba-dd2d-401c-9d90-58e8679e0438` as a remote MCP server in your client and
   sign in. On the consent screen you choose the site. The tools run with your own Jira permissions.

## Tools

- `list-suspect-changes`, inputs `issueKey` and optional `windowHours` (24, 72 or 168; default 72): the incident's start
  time and where it comes from, the strong and possible suspects in ranked order with `why` (the evidence) and the
  time of the change, the number of weak matches not listed, changes made after the start, and changes already marked
  as the suspected cause.
- `mark-suspect-change`, inputs `incidentKey` and `changeKey`: links the change to the incident ("causes" when the site
  has that link type, otherwise Relates) and records the mark. It changes Jira, so call it only for a change the user
  named or confirmed.
- `list-recent-incidents`, input `projectKey`: incidents created in the project in the last 30 days, each with its most
  likely change and any suspected cause already marked.

## Answering

When the user asks what changed before an incident, call `list-suspect-changes` and report, in this order:

1. Strong suspects, then possible ones: key, summary, how long before the start, and the evidence in `why`.
2. Changes made after the start; a rollback or hotfix often shows up here.
3. Any change already marked as the suspected cause, and how many weak matches were left out.

When the user asks about recent incidents, call `list-recent-incidents` and point out the ones with no suspected cause.

## Limits

- Report only what the tools return. The ranking shows where to look first; it does not prove a cause.
- Call a change "the suspected cause" only after the team has marked it, and never mark one without the user's go-ahead.
