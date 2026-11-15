/** A double edge/bane changes the tier rather than adding another numeric bonus. */
export function powerRollModifiers(edges = 0, banes = 0) {
  const net = Math.max(0, edges) - Math.max(0, banes);
  if (net >= 2) return { net, edgeBonus: 0, tierShift: 1, note: "Двойное преимущество: +1 тир" };
  if (net <= -2) return { net, edgeBonus: 0, tierShift: -1, note: "Двойная помеха: −1 тир" };
  if (net === 1) return { net, edgeBonus: 2, tierShift: 0, note: "Преимущество: +2" };
  if (net === -1) return { net, edgeBonus: -2, tierShift: 0, note: "Помеха: −2" };
  return { net, edgeBonus: 0, tierShift: 0, note: "" };
}
