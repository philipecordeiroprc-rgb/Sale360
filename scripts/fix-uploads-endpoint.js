const fs = require('fs');
const fp = 'C:/Users/rafac/Documents/GitHub/Sale360/packages/api/src/index.ts';
let c = fs.readFileSync(fp, 'utf8');

// Find the specific section
const oldSection = `  // Serve uploaded files (logos, banners, products) — public
  const uploadDir = path.resolve(process.cwd(), '../uploads');
  app.get('/api/public/uploads/*', async (request, reply) => {
    const requestedPath = (request.params as Record<string, string>)['*'] || '';
    // Prevent path traversal
    if (requestedPath.includes('..')) {
      return reply.status(400).send({ error: 'Invalid path' });
    }
    const filePath = path.resolve(uploadDir, requestedPath);
    if (!filePath.startsWith(path.resolve(uploadDir))) {
      return reply.status(400).send({ error: 'Invalid path' });
    }
    try {
      await fsSync.promises.access(filePath);
    } catch {
      return reply.status(404).send({ error: 'File not found' });
    }
    const ext = path.extname(requestedPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
    };
    reply.type(mimeTypes[ext] || 'application/octet-stream');
    return reply.send(fsSync.createReadStream(filePath));
  });`;

const newSection = `  // Serve uploaded files (logos, banners, products) — public
  const uploadDir = path.resolve(process.cwd(), '../uploads');
  const uploadSubdirs = ['logos', 'banners', 'products'];
  app.get('/api/public/uploads/*', async (request, reply) => {
    const requestedPath = (request.params as Record<string, string>)['*'] || '';
    // Prevent path traversal
    if (requestedPath.includes('..')) {
      return reply.status(400).send({ error: 'Invalid path' });
    }
    let filePath = path.resolve(uploadDir, requestedPath);
    if (!filePath.startsWith(path.resolve(uploadDir))) {
      return reply.status(400).send({ error: 'Invalid path' });
    }
    // Check if file exists; if not, try subdirectories (backward compat)
    try {
      await fsSync.promises.access(filePath);
    } catch {
      let found = false;
      for (const sub of uploadSubdirs) {
        const altPath = path.resolve(uploadDir, sub, path.basename(requestedPath));
        if (!altPath.startsWith(path.resolve(uploadDir))) continue;
        try {
          await fsSync.promises.access(altPath);
          filePath = altPath;
          found = true;
          break;
        } catch { /* keep trying */ }
      }
      if (!found) {
        return reply.status(404).send({ error: 'File not found' });
      }
    }
    const ext = path.extname(requestedPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
    };
    reply.type(mimeTypes[ext] || 'application/octet-stream');
    return reply.send(fsSync.createReadStream(filePath));
  });`;

if (c.includes(oldSection)) {
  c = c.replace(oldSection, newSection);
  console.log('Uploads endpoint updated with backward compatibility');
} else {
  console.log('Old section not found. Checking if already updated...');
  if (c.includes('uploadSubdirs')) {
    console.log('Already updated');
  } else {
    // Try finding the section by search term
    const idx = c.indexOf('Serve uploaded files');
    if (idx >= 0) {
      console.log('Section found at index', idx);
      console.log('Context:', JSON.stringify(c.substring(idx, idx + 100)));
    }
  }
}

fs.writeFileSync(fp, c, 'utf8');
console.log('Done');
