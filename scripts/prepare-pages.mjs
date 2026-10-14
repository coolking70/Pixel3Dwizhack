import { copyFile, writeFile } from 'node:fs/promises';

// Keep the historical M01 entry reachable; only the hosted preview gets a new landing page.
await copyFile('dist-pages/index.html', 'dist-pages/mine.html');
await writeFile('dist-pages/index.html', `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>星落远征 · Fallen Star</title><meta http-equiv="refresh" content="0;url=./alpha6.html">
<script>location.replace('./alpha6.html'+location.search+location.hash)</script></head>
<body><a href="./alpha6.html">开始游戏 / Play Fallen Star</a></body></html>\n`);
await writeFile('dist-pages/.nojekyll', '');
console.log('Pages preview: alpha6.html; historical M01: mine.html');
