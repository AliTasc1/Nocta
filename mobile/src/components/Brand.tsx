import React from 'react';

import { SerifTitle } from './ui';

/** "noc<i>ta</i>" logotipi */
export function Logo({ size = 34 }: { size?: number }) {
  return <SerifTitle text="noc" accent="ta" v="h2" center style={{ fontSize: size, lineHeight: size * 1.15 }} />;
}
