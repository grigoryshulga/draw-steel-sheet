// Preserve prose on either side of the printed Basics section, including
// the separate master-class note in the Summoner edition.
export function englishClassBasics(source: string) {
  const heading = /^### Basics\s*$/m.exec(source);
  if (!heading) return undefined;
  const body = source.slice(heading.index + heading[0].length).trim();
  const next = /^#{1,3} /m.exec(body)?.index ?? body.length;
  const basics = body.slice(0, next).trim();
  const number = (field: string) => {
    const line = basics.split("\n").find(line => line.startsWith(`**${field}:** `));
    return line?.split("** ").at(-1)?.trim();
  };
  return {
    introduction: source.slice(0, heading.index).trim(),
    basics,
    stamina: number("Starting Stamina at 1st Level"),
    growth: number("Stamina Gained at 2nd and Higher Levels"),
    recoveries: number("Recoveries"),
    afterword: body.slice(next).trim(),
  };
}
