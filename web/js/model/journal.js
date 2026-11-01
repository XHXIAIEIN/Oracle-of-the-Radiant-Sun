/* 跨局记录 */

import { text } from './i18n.js';

const KEY = 'ors.journal.v1';

/* { topic, topics: { [topic]: [{ at, method, question, cards: [{ pos, page }] }] } }
   默认话题的键是空字符串，显示名才随语言取 */
function load() {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) return JSON.parse(raw);
	} catch {} // 隐私窗口或禁用存储时抛错，跳过
	return { topic: '', topics: {} };
}

function save(data) {
	try {
		localStorage.setItem(KEY, JSON.stringify(data));
	} catch {} // 隐私窗口或禁用存储时抛错，跳过
}

// 当前局在话题记录中的下标
let active = { seq: -1, topic: '', index: -1 };

export const topicLabel = topic => topic || text('journal.defaultTopic');

export function currentTopic() {
	return load().topic;
}

export function setTopic(name) {
	const data = load();
	data.topic = name.trim();
	save(data);
	active = { seq: -1, topic: '', index: -1 };
}

export function clearTopic() {
	const data = load();
	delete data.topics[data.topic];
	save(data);
	active = { seq: -1, topic: '', index: -1 };
}

export function topicCount() {
	const data = load();
	return data.topics[data.topic]?.length ?? 0;
}

export function record(seq, method, question, pos, page) {
	const data = load();
	const topic = data.topic;
	const list = (data.topics[topic] ??= []);
	if (active.seq !== seq || active.topic !== topic || !list[active.index]) {
		list.push({ at: new Date().toISOString(), method, question, cards: [] });
		active = { seq, topic, index: list.length - 1 };
	}
	list[active.index].cards.push({ pos, page });
	save(data);
}

// 此牌在当前话题中此前的出现
export function priorSightings(page) {
	const data = load();
	const topic = data.topic;
	const out = [];
	(data.topics[topic] ?? []).forEach((reading, i) => {
		// 同一局内的牌不算重复
		if (active.topic === topic && i === active.index) return;
		for (const c of reading.cards) if (c.page === page) out.push({ at: reading.at, method: reading.method, question: reading.question, pos: c.pos });
	});
	return out;
}
