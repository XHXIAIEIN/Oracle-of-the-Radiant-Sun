const res = await fetch('data/catalog.json');
if (!res.ok) throw new Error('Unable to load catalog.json');

export const CATALOG = await res.json();
