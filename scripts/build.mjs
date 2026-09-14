import { mkdir, copyFile, cp } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/', root), { recursive: true });
for (const name of ['index.html', 'styles.css', 'intro.css', 'app.js', 'invitation.config.js']) {
  await copyFile(new URL(name, root), new URL('dist/' + name, root));
}
await cp(new URL('backg/', root), new URL('dist/backg/', root), { recursive: true });
console.log('Готово: dist/ — сайт с исходными изображениями и видео.');
