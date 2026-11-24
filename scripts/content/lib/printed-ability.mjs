// The reader keeps the source Markdown alongside this display projection.
const plain = value => value.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replaceAll("**", "").trim();

function printedDistance(text) {
  const parts = [];
  let offset = 0;
  for (const match of text.matchAll(/\b(melee|ranged|within) (\d+)/gi)) {
    const number = match.index + match[0].length - match[2].length;
    parts.push(text.slice(offset, number), { mode: match[1].toLowerCase(), value: Number(match[2]) });
    offset = number + match[2].length;
  }
  if (offset < text.length) parts.push(text.slice(offset));
  return parts;
}

function tier(line) {
  const value = line.replace(/^[-*] \*\*[^*]+\*\*\s*/, "");
  const damage = /^(\d+(?:d\d+)?(?:\s*\+\s*(?:\d+|(?:\*\*)?[MARIP](?:\*\*)?)(?:(?:,\s*(?:or\s+)?|\s+or\s+)(?:\*\*)?[MARIP](?:\*\*)?)*)*)\s+(?:(acid|cold|corruption|fire|holy|lightning|poison|psychic|sonic)\s+)?damage(?:[;,]\s*|$)/i.exec(value);
  const effect = damage ? value.slice(damage[0].length) : value;
  const richEffect = /\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|(?<!\*)\*[^*]+\*|`[^`]+`|~~[^~]+~~/.test(effect);
  return { ...(damage && { damage: { value: damage[1].replaceAll("**", ""), ...(damage[2] && { type: damage[2].toLowerCase() }) } }), effect, ...(richEffect && { richEffect: true }) };
}

export function compilePrintedAbility(markdown) {
  const parts = markdown.trim().split(/\r?\n\s*\r?\n/);
  const card = { blocks: [] };
  const isRoll = i => /^\*\*Power Roll\b[^\n]*\*\*$/i.test(parts[i] || "") &&
    /^(?:[-*] \*\*≤11:\*\*[^\n]*\r?\n)(?:[-*] \*\*12-16:\*\*[^\n]*\r?\n)(?:[-*] \*\*17\+:\*\*[^\n]*)$/.test(parts[i + 1] || "");
  const firstRoll = parts.findIndex((_, i) => isRoll(i));
  let bodyStarted = false;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const lines = part.split(/\r?\n/);
    if (i === 0 && /^\*[^*].*\*$/.test(part)) {
      card.flavor = part.slice(1, -1);
    } else if (!card.facts && lines.length === 3 && lines[0].startsWith("|") && /^\|[\s|:-]+\|$/.test(lines[1]) && lines[2].includes("📏") && lines[2].includes("🎯")) {
      const cells = line => line.trim().slice(1, -1).split("|").map(plain);
      const [keywords, action] = cells(lines[0]);
      const [distance, target] = cells(lines[2]);
      card.facts = { action, distance: printedDistance(distance.replace(/^📏\s*/, "")), target: target.replace(/^🎯\s*/, ""), keywords: keywords === "-" ? [] : keywords.split(/,\s*/) };
    } else if (isRoll(i)) {
      const title = plain(part).replace(/:$/, "");
      const characteristic = /^Power Roll \+ (Might|Agility|Reason|Intuition|Presence)$/i.exec(title)?.[1].toLowerCase();
      const roll = { title, ...(characteristic && { characteristic }), tiers: parts[++i].split("\n").map(tier) };
      if (!card.roll) card.roll = roll;
      else card.blocks.push({ roll });
      bodyStarted = true;
    } else if (!bodyStarted && !card.trigger && part.startsWith("**Trigger:**")) {
      card.trigger = part.slice("**Trigger:**".length).trim();
    } else if (firstRoll >= 0 && i < firstRoll) {
      card.beforeRoll = [card.beforeRoll, part].filter(Boolean).join("\n\n");
      bodyStarted = true;
    } else if (!card.blocks.length && !card.effect && /^\*\*Effect:\*\* [^\n*_\x60\[]+$/.test(part)) {
      card.effect = part.slice("**Effect:**".length).trim();
      bodyStarted = true;
    } else if (part) {
      const previous = card.blocks.at(-1);
      if (previous?.text) previous.text += "\n\n" + part;
      else card.blocks.push({ text: part });
      bodyStarted = true;
    }
  }
  return card;
}
