import { readdir, readFile } from 'node:fs/promises';
const paths = ['src/core', 'src/content', 'src/session'];
let checked = 0;
for (const directory of paths) {
  for (const name of await readdir(directory)) {
    if (!name.endsWith('.ts')) continue;
    const file = `${directory}/${name}`;
    const text = await readFile(file, 'utf8');
    const forbidden = [
      /\b(?:window|document|localStorage|requestAnimationFrame|setTimeout|setInterval)\b/,
      /\b(?:Date\.now|performance\.now|Math\.random)\s*\(/,
      /from\s+['"](?:vue|three|.*\/(?:ui|character-lab|room|adventure|alpha|alpha2)\/)/,
    ];
    if (directory !== 'src/session') forbidden.push(/from\s+['"].*\/session\//);
    for (const pattern of forbidden) {
      if (pattern.test(text)) throw new Error(`Dependency or time boundary violated: ${file} (${pattern})`);
    }
    checked++;
  }
}
for (const directory of ['src/ui', 'src/room', 'src/adventure', 'src/alpha', 'src/alpha2']) for (const name of await readdir(directory)) {
  if (!/\.(ts|vue)$/.test(name)) continue;
  const text = await readFile(`${directory}/${name}`, 'utf8');
  if (/from\s+['"].*\/(?:content\/|core\/simulation)/.test(text)) {
    throw new Error(`Presentation must read the public view, not hidden content or simulation: ${name}`);
  }
}
for(const directory of ['src/character-lab','src/combat-lab']) for (const name of await readdir(directory)) {
  if (!/\.(ts|vue)$/.test(name)) continue;
  const text = await readFile(`${directory}/${name}`, 'utf8');
  if (/from\s+['"].*\/(?:content|core|session|ui)\//.test(text)) throw new Error(`Character lab must remain independent of game state: ${name}`);
}
console.log(`Checked ${checked} files: simulation, content and session remain headless; character lab is isolated.`);
// New presentation modules are recursive, unlike the historical flat folders.
async function walk(directory) {
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const file=`${directory}/${entry.name}`;
    if(entry.isDirectory())files.push(...await walk(file));else if(/\.(ts|vue)$/.test(file))files.push(file);
  }
  return files;
}
for(const directory of ['src/game-ui','src/visual','src/interaction'])for(const file of await walk(directory)) {
  const text=await readFile(file,'utf8');
  if(/from\s+['"][^'"]*\/(?:content\/|core\/(?!types['"]|alpha2-types['"]|alpha-types['"]|action-types['"]|alpha3-types['"]|alpha5-types['"])|session\/)/.test(text))throw new Error(`M16 presentation must only consume public projections: ${file}`);
}
for(const file of [...await walk('src/balance'),...await walk('src/balance3'),...await walk('src/balance4'),...await walk('src/balance5')]) {
  const text=await readFile(file,'utf8');
  if(/from\s+['"](?:three|vue|[^'"]*\/(?:room|visual|game-ui|alpha2|character-lab)\/)/.test(text))throw new Error(`Balance must remain headless: ${file}`);
}
