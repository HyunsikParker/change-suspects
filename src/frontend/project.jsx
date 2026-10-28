import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Button, Code, DynamicTable, EmptyState, Heading, Link, Lozenge, SectionMessage, Spinner, Stack, Text,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { Band, when } from './common.jsx';

function Incidents({ incidents, timeZone }) {
  return (
    <DynamicTable
      head={{ cells: [
        { key: 'i', content: 'Incident' }, { key: 's', content: 'Started' }, { key: 't', content: 'Most likely change' }, { key: 'm', content: 'Cause marked' },
      ] }}
      rows={incidents.map((i) => ({
        key: i.key,
        cells: [
          { key: 'i', content: <Stack space="space.0"><Link href={i.url}>{i.key}</Link><Text>{i.summary}</Text></Stack> },
          { key: 's', content: when(i.startedAt, timeZone) },
          { key: 't', content: i.top ? (
            <Stack space="space.050"><Band band={i.top.band} /><Link href={i.top.url}>{`${i.top.key} ${i.top.summary}`}</Link></Stack>
          ) : <Text>No change in the window</Text> },
          { key: 'm', content: i.marked.length ? <Lozenge appearance="success">{i.marked.join(', ')}</Lozenge> : <Lozenge>Not yet</Lozenge> },
        ],
      }))}
    />
  );
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const [sample, setSample] = useState(null);
  useEffect(() => {
    invoke('getProject').then(setData).catch((e) => setError(String(e)));
  }, [version]);
  if (error) return <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage>;
  if (!data) return <Spinner label="Reading recent incidents" />;
  const load = async () => {
    setSample({ busy: true });
    const r = await invoke('loadSample').catch((e) => ({ ok: false, error: String(e) }));
    setSample(r);
    if (r.ok) { setData(null); setVersion((v) => v + 1); }
  };
  return (
    <Stack space="space.250">
      <Text>{`Incidents created in ${data.projectKey} in the last 30 days, each with the change most likely involved among those in the ${data.windowText} before it started. Open an incident to see every suspect and the evidence.`}</Text>
      {data.incidents.length > 0 ? <Incidents incidents={data.incidents} timeZone={data.timeZone} /> : (
        <EmptyState
          header="No incidents in the last 30 days"
          description="Work items count as incidents when their type is Incident or they carry the incident label. Load a fictional web shop with two incidents and the changes around them to see how it works."
          primaryAction={!data.hasSample && <Button appearance="primary" isDisabled={sample?.busy} onClick={load}>{sample?.busy ? 'Creating work items…' : 'Load sample incidents'}</Button>}
        />
      )}
      {sample && sample.ok === false && <SectionMessage appearance="error"><Text>{sample.error}</Text></SectionMessage>}
      <Stack space="space.100">
        <Heading size="small">Recording deploy times</Heading>
        <Text>A change counts from when it was resolved. When your pipeline knows the exact deploy time, store it on the work item as the issue property change-suspects, for example from an Automation rule with the Set entity property action or from a REST call:</Text>
        <Code>{`PUT /rest/api/3/issue/${data.projectKey}-14/properties/change-suspects  {"deployedAt": "2026-10-28T13:13:00Z"}`}</Code>
      </Stack>
    </Stack>
  );
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
