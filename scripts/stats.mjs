// Writes stats.json: per widget, the total downloads of widget.zip across all its releases and
// when its newest stable release was published. Run daily by .github/workflows/stats.yml, which
// publishes the file on the stats branch.
//
//   GITHUB_TOKEN=... node scripts/stats.mjs
//
// A repo that errors is logged and left out, so one broken repo does not hold back the others.

import { readFileSync, writeFileSync } from 'node:fs';

const widgets = JSON.parse(readFileSync(new URL('../widgets.json', import.meta.url), 'utf8'));
const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const stats = { updated: new Date().toISOString(), widgets: {} };
for (const { id, repo } of widgets) {
	try {
		let downloads = 0;
		let released = null; // Stays null while the repo has no stable release.
		for (const release of await releases(repo)) {
			for (const asset of release.assets) {
				if (asset.name === 'widget.zip') downloads += asset.download_count;
			}
			const stable = !release.draft && !release.prerelease && release.published_at;
			if (stable && (!released || release.published_at > released)) {
				released = release.published_at;
			}
		}
		stats.widgets[id] = { downloads, released };
	} catch (e) {
		console.error(`${id} (${repo}): ${e.cause?.message ?? e.message}`);
	}
}

// Every repo failing means GitHub or the token is broken: fail, so the published stats stay.
if (widgets.length && !Object.keys(stats.widgets).length) {
	console.error('No repo could be read; stats.json not written.');
	process.exit(1);
}

writeFileSync(new URL('../stats.json', import.meta.url), JSON.stringify(stats, null, '\t') + '\n');
console.log(`stats.json: ${Object.keys(stats.widgets).length} of ${widgets.length} widgets.`);

async function releases(repo) {
	const all = [];
	let url = `https://api.github.com/repos/${repo}/releases?per_page=100`;
	while (url) {
		const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
		if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
		all.push(...(await res.json()));
		url = res.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
	}
	return all;
}
