import React from 'react';
import { Inline, Lozenge } from '@forge/react';

// Times follow the time zone in the viewer's Jira profile, as the rest of Jira does.
export const when = (iso, timeZone) => new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

export const span = (m) => (m < 60 ? `${m} min` : m < 600 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.floor(m / 1440)} days`);

const BAND = { strong: ['removed', 'Strong suspect'], possible: ['moved', 'Possible'], weak: ['default', 'Weak'] };

export function Band({ band }) {
  const [appearance, label] = BAND[band] || BAND.weak;
  return <Inline><Lozenge appearance={appearance}>{label}</Lozenge></Inline>;
}
