import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Button, DatePicker, DynamicTable, EmptyState, Inline, Link, Lozenge, SectionMessage, Select, Spinner, Stack, Strong, Text, TimePicker,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { Band, span, when } from './common.jsx';
import { zonedParts, zonedToIso } from '../core/time.js';

const WINDOWS = [{ label: '24 hours', value: 24 }, { label: '3 days', value: 72 }, { label: '7 days', value: 168 }];
function StartEditor({ startedAt, timeZone, onSaved, onCancel }) {
  const initial = zonedParts(startedAt, timeZone);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [state, setState] = useState(null);
  const save = async () => {
    setState({ busy: true });
    const r = await invoke('setStart', { startedAt: zonedToIso(date, time, timeZone) }).catch((e) => ({ ok: false, error: String(e) }));
    if (r.ok) onSaved(); else setState(r);
  };
  return (
    <Stack space="space.100">
      <Inline space="space.100" alignBlock="end">
        <DatePicker value={date} onChange={setDate} label="Date" />
        <TimePicker value={time} onChange={setTime} label="Time" />
        <Button appearance="primary" isDisabled={state?.busy || !date || !time} onClick={save}>Save start</Button>
        <Button appearance="subtle" onClick={onCancel}>Cancel</Button>
      </Inline>
      <Text size="small">{`Time zone: ${timeZone}, as in your Jira profile.`}</Text>
      {state?.error && <SectionMessage appearance="error"><Text>{state.error}</Text></SectionMessage>}
    </Stack>
  );
}

function Suspects({ rows, marked, busyKey, onMark, timeZone }) {
  return (
    <DynamicTable
      head={{ cells: [{ key: 'c', content: 'Change' }, { key: 'y', content: 'Why it is here' }, { key: 'a', content: '' }] }}
      rows={rows.map((c) => ({
        key: c.key,
        cells: [
          { key: 'c', content: (
            <Stack space="space.050">
              <Inline space="space.100" alignBlock="center"><Band band={c.band} /><Link href={c.url}>{c.key}</Link></Inline>
              <Text>{c.summary}</Text>
              <Text size="small">{`${c.timeSource === 'deployed' ? 'Deployed' : 'Resolved'} ${span(c.minutesBefore)} before the start (${when(c.changedAt, timeZone)})`}</Text>
            </Stack>
          ) },
          { key: 'y', content: <Stack space="space.0">{c.why.slice(1).map((w) => <Text key={w}>{w}</Text>)}{c.why.length === 1 && <Text>Only the timing</Text>}</Stack> },
          { key: 'a', content: marked.includes(c.key) ? <Lozenge appearance="removed" isBold>Marked</Lozenge> : <Button appearance="subtle" isDisabled={!!busyKey} onClick={() => onMark(c.key)}>{busyKey === c.key ? 'Linking…' : 'Mark as cause'}</Button> },
        ],
      }))}
    />
  );
}

function Timeline({ windowHours }) {
  const [state, setState] = useState(null);
  const post = async () => {
    setState({ busy: true });
    setState(await invoke('postTimeline', { windowHours }).catch((e) => ({ ok: false, error: String(e) })));
  };
  return (
    <Inline space="space.100" alignBlock="center">
      <Button isDisabled={state?.busy || state?.ok} onClick={post}>Post timeline as a comment</Button>
      {state?.ok && <Text>{`Posted ${state.events} entries, times in ${state.timeZone}.`}</Text>}
      {state && state.ok === false && <Text>{state.error}</Text>}
    </Inline>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [windowOpt, setWindowOpt] = useState(WINDOWS[1]);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState(false);
  const [showWeak, setShowWeak] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  useEffect(() => {
    invoke('getPanel', { windowHours: windowOpt.value }).then(setData).catch((e) => setError(String(e)));
  }, [version, windowOpt]);
  const reload = () => setVersion((v) => v + 1);
  if (error) return <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage>;
  if (!data) return <Spinner label="Looking for changes before the start" />;
  const { incident, suspects, after, marked } = data;
  const markOne = async (changeKey, verb) => {
    setBusyKey(changeKey);
    const r = await invoke(verb, { changeKey }).catch((e) => ({ ok: false, error: String(e) }));
    setBusyKey(null);
    if (r.ok) reload(); else setError(r.error);
  };
  const strongOrPossible = suspects.filter((c) => c.band !== 'weak');
  const weak = suspects.filter((c) => c.band === 'weak');
  const shown = showWeak ? suspects : strongOrPossible;
  const markedRows = suspects.filter((c) => marked.includes(c.key));
  return (
    <Stack space="space.200">
      {!incident.isIncident && (
        <SectionMessage appearance="information"><Text>This work item has no Incident type or incident label. The changes below are ranked against it anyway.</Text></SectionMessage>
      )}
      <Inline space="space.100" alignBlock="center" shouldWrap>
        <Text><Strong>{`Started ${when(incident.startedAt, data.timeZone)}`}</Strong></Text>
        <Text>{incident.startSource === 'set' ? '(set by the team)' : '(when it was created; set the real start if it began earlier)'}</Text>
        {!editing && <Button appearance="link" onClick={() => setEditing(true)}>Change start</Button>}
      </Inline>
      {editing && <StartEditor startedAt={incident.startedAt} timeZone={data.timeZone} onSaved={() => { setEditing(false); reload(); }} onCancel={() => setEditing(false)} />}
      {markedRows.map((c) => (
        <SectionMessage key={c.key} appearance="warning" title={`Suspected cause: ${c.key}`}>
          <Text>{`${c.summary}. Linked to this work item with "${data.linkType.name}".`}</Text>
          <Button appearance="link" isDisabled={!!busyKey} onClick={() => markOne(c.key, 'unmark')}>Remove the mark</Button>
        </SectionMessage>
      ))}
      <Inline space="space.100" alignBlock="center">
        <Text>{`Changes in the`}</Text>
        <Select options={WINDOWS} value={windowOpt} onChange={(o) => { setData(null); setWindowOpt(o); }} />
        <Text>{`before the start: ${suspects.length}, ${strongOrPossible.length} worth a look.`}</Text>
      </Inline>
      {suspects.length === 0 ? (
        <EmptyState header={`No changes in the ${data.windowText} before the start`} description="Changes count from their recorded deploy time, or from when they were resolved. Try a longer window or check the start time." />
      ) : (
        <Stack space="space.100">
          {shown.length > 0 ? <Suspects rows={shown} marked={marked} busyKey={busyKey} timeZone={data.timeZone} onMark={(k) => markOne(k, 'mark')} /> : <Text>No change shares a component, label or wording with this work item.</Text>}
          {weak.length > 0 && <Inline><Button appearance="subtle" onClick={() => setShowWeak(!showWeak)}>{showWeak ? 'Hide weak matches' : `Show ${weak.length} weak match${weak.length === 1 ? '' : 'es'}`}</Button></Inline>}
        </Stack>
      )}
      {after.length > 0 && (
        <Stack space="space.050">
          <Text><Strong>{`After the start (${after.length})`}</Strong></Text>
          {after.map((c) => (
            <Text key={c.key}><Link href={c.url}>{c.key}</Link>{` ${c.summary}, ${c.timeSource} ${span(c.minutesAfter)} after the start`}</Text>
          ))}
        </Stack>
      )}
      <Timeline windowHours={windowOpt.value} />
      <Text size="small">Ranked by how close to the start each change went in, a shared component or label, shared words in the two descriptions, and change risk when one is recorded. A change counts from its recorded deploy time, otherwise from when it was resolved.</Text>
    </Stack>
  );
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
