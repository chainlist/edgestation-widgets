// Checks widgets.json. Run by .github/workflows/validate.yml on pull requests.
//
//   node scripts/validate.mjs [base-ref]
//
// Entries that are new or changed versus base-ref (such as origin/main) also get their latest
// release checked online. Without base-ref, every entry is checked online.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BUILT_IN = ['clock', 'launcher', 'logs-timeline', 'media', 'performance', 'todo', 'url', 'youtube'];
const ID = /^[a-z0-9][a-z0-9-]*$/;
const REPO = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
const VERSION = /^\d+\.\d+\.\d+$/;

const base = process.argv[2];
const errors = [];

let widgets;
try {
	widgets = JSON.parse(readFileSync(new URL('../widgets.json', import.meta.url), 'utf8'));
} catch (e) {
	fail(`widgets.json: ${e.message}`);
}
if (!Array.isArray(widgets)) fail('widgets.json: must be an array');

const before = base
	? JSON.parse(execFileSync('git', ['show', `${base}:widgets.json`], { encoding: 'utf8' }))
	: [];
const unchanged = new Set(before.map((w) => `${w.id} ${w.repo}`));

const seen = new Set();
const toCheck = [];
widgets.forEach((w, i) => {
	const at = `widgets.json[${i}]`;
	if (typeof w !== 'object' || w === null || Array.isArray(w)) {
		errors.push(`${at}: must be an object { "id", "repo" }`);
		return;
	}
	const label = typeof w.id === 'string' ? `${at} (${w.id})` : at;
	const errorsBefore = errors.length;
	const keys = Object.keys(w).sort().join(',');
	if (keys !== 'id,repo') errors.push(`${label}: must have exactly the keys "id" and "repo"`);

	if (typeof w.id !== 'string' || !ID.test(w.id)) {
		errors.push(`${label}: id must match ${ID.source}`);
	} else if (BUILT_IN.includes(w.id)) {
		errors.push(`${label}: id "${w.id}" is a built-in widget`);
	} else if (seen.has(w.id)) {
		errors.push(`${label}: id "${w.id}" is listed more than once`);
	}
	seen.add(w.id);

	if (typeof w.repo !== 'string' || !REPO.test(w.repo)) {
		errors.push(`${label}: repo must look like "owner/name"`);
	}

	if (errors.length === errorsBefore && !unchanged.has(`${w.id} ${w.repo}`)) {
		toCheck.push({ label, repo: w.repo });
	}
});

for (const { label, repo } of toCheck) {
	const latest = `https://github.com/${repo}/releases/latest/download`;
	try {
		const res = await fetch(`${latest}/manifest.json`, { signal: AbortSignal.timeout(30000) });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const manifest = JSON.parse(await res.text());
		if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
			throw new Error('not a JSON object');
		}
		if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
			throw new Error('"name" must be a non-empty string');
		}
		if (typeof manifest.version !== 'string' || !VERSION.test(manifest.version)) {
			throw new Error('"version" must look like 1.2.3');
		}
	} catch (e) {
		errors.push(`${label}: latest release manifest.json: ${e.cause?.message ?? e.message}`);
	}
	try {
		// A one-byte ranged GET: proves the asset exists without downloading it.
		const res = await fetch(`${latest}/widget.zip`, {
			headers: { Range: 'bytes=0-0' },
			signal: AbortSignal.timeout(30000)
		});
		await res.body?.cancel();
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
	} catch (e) {
		errors.push(`${label}: latest release widget.zip: ${e.cause?.message ?? e.message}`);
	}
}

if (errors.length) fail(...errors);
console.log(`widgets.json is valid: ${widgets.length} entries, ${toCheck.length} checked online.`);

function fail(...messages) {
	for (const m of messages) console.error(`error: ${m}`);
	process.exit(1);
}
