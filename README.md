# Change Suspects

What changed just before this broke? For an incident tracked in Jira, Change Suspects lists the changes that went in
before it started, ranked by how likely they are involved, with the evidence for each. Responders see where to look
first without searching across projects, and the team can mark the suspected cause, link it and post a timeline.

Built on Atlassian Forge for Codegeist 2026 (category: Apps for Software Teams).

## How it works

- **Incidents** are work items whose type is Incident (Jira Service Management's "[System] Incident" included) or that
  carry the `incident` label. The panel works on any work item, so a bug can be treated the same way.
- **The start** of an incident is the time the team sets in the panel, otherwise the creation time of the work item.
- **Changes** are work items resolved, or recorded as deployed, in the window before the start (24 hours, 3 days or
  7 days) in every project the person can see. In service projects only change requests count. A change counts from
  its deploy time when one is recorded, otherwise from its resolution time.
- **Ranking** multiplies how recent the change is (1 just before the start, 0.5 at six hours, 0.2 at a day) by how
  related it is: a shared component or label, the words their summaries and descriptions share (rarer words count for more), and
  change risk when the site records it. The result is shown as Strong suspect, Possible or Weak, with the reasons in
  words, never as a bare score.

Deploy times can come from your pipeline: store them as the issue property `change-suspects` on the change, for
example with an Automation rule ("Set entity property") or a REST call. Write times in whole seconds; Jira's property
index skips ISO times that carry milliseconds.

```http
PUT /rest/api/3/issue/SHOP-14/properties/change-suspects
{"deployedAt": "2026-10-28T13:13:00Z", "risk": "High"}
```

## What you get

- **Change suspects panel** on the work item: the start (editable, in your Jira time zone), the ranked changes with
  their evidence, changes made after the start (rollbacks and hotfixes), and a button to mark a change as the suspected
  cause. Marking links the two work items with "causes / is caused by" when the site has that link type (Jira Service
  Management's Problem/Incident), otherwise "relates to".
- **Timeline comment**: one click posts the changes worth a look, the start, later changes and the report time as a
  comment, in the time zone of the person who posts it, ready for the post-incident review.
- **Change suspects project page**: incidents from the last 30 days with the most likely change for each and whether a
  cause has been marked; **Load sample incidents** creates a fictional web shop with two incidents and the changes
  around them.
- **Rovo agent "Change Suspects"** with three actions, `list-suspect-changes`, `mark-suspect-change` (asks for
  confirmation before it changes Jira) and `list-recent-incidents`, which the app also exposes as tools on the
  Atlassian MCP server. [`skills/change-suspects/SKILL.md`](skills/change-suspects/SKILL.md) tells a third-party agent
  how to use them.

## Try it

1. Install the app on a Jira site.
2. Open a project, choose **Change suspects** in the project's navigation and press **Load sample incidents**.
3. Open "Card payments time out at checkout" and open the Change suspects panel from the apps button.

## Architecture

- `src/core/`: plain JavaScript, no network: `time.js` (windows, spans, time zones), `text.js` (ADF to text, word
  statistics), `rank.js` (ranking and reasons), `adapt.js` (Jira issue to incident and change), `timeline.js` (comment
  body), `sample.js` and `seed.js` (fictional sample).
- `src/jira.js`: Jira REST calls, all as the current user (`asUser`), so people only see work items they can open.
- `src/index.js`: Forge resolvers and the Rovo actions.
- `src/frontend/`: UI Kit issue panel and project page.
- No LLM calls in the app. The Rovo agent uses Rovo's own model on the site that runs it.

## Development

```sh
npm install
npm test          # node --test, core logic
forge lint
forge deploy -e development
forge install --site <your-site>.atlassian.net -p Jira -e development
```

## Credits

Built with help from an AI coding assistant (Anthropic Claude). Sample data is fictional.

## Licence

MIT.
