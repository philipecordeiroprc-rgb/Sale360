export const dynamic = 'force-dynamic';

import { TutoriaisClient } from './TutoriaisClient';
import fs from 'fs';
import path from 'path';

export default function TutoriaisPage() {
  const manualDir = path.resolve(process.cwd(), '..', '..', 'manual');

  let manualHtml = '';
  let guiasHtml = '';

  try {
    manualHtml = fs.readFileSync(path.join(manualDir, 'Manual_Sale360.html'), 'utf-8');
  } catch {
    manualHtml = '<html><body><p style="color:white;text-align:center;padding:2rem">Manual não encontrado.</p></body></html>';
  }

  try {
    guiasHtml = fs.readFileSync(path.join(manualDir, 'guias.html'), 'utf-8');
  } catch {
    guiasHtml = '<html><body><p style="color:white;text-align:center;padding:2rem">Guia prático não encontrado.</p></body></html>';
  }

  // Fix relative image paths → absolute so they work inside iframe
  const fixPaths = (html: string) =>
    html.replace(/src="screenshots\//g, 'src="/manual/screenshots/');

  return (
    <TutoriaisClient
      manualHtml={fixPaths(manualHtml)}
      guiasHtml={fixPaths(guiasHtml)}
    />
  );
}
