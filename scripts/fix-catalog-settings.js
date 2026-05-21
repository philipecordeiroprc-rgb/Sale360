const fs = require('fs');
const filePath = 'C:/Users/rafac/Documents/GitHub/Sale360/packages/api/src/routes/catalog-settings/index.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix logo upload: store 'logos/filename' in DB instead of just 'filename'
const logoOld = `    const filename = \`\${request.tenantId}_\${Date.now()}\${ext}\`;
    const filepath = path.join(logosDir, filename);

    await fs.writeFile(filepath, await file.toBuffer());

    // Remove old logo if exists
    const current = await prisma.catalogSettings.findUnique({ where: { tenantId: request.tenantId } });
    if (current?.logoPath) {
      const oldPath = path.join(logosDir, current.logoPath);
      fs.unlink(oldPath).catch(() => {});
    }

    await prisma.catalogSettings.upsert({
      where: { tenantId: request.tenantId },
      create: { tenantId: request.tenantId, logoPath: filename },
      update: { logoPath: filename },
    });

    return { logoPath: filename };`;

const logoNew = `    const filename = \`\${request.tenantId}_\${Date.now()}\${ext}\`;
    const filepath = path.join(logosDir, filename);

    await fs.writeFile(filepath, await file.toBuffer());

    // Remove old logo if exists
    const current = await prisma.catalogSettings.findUnique({ where: { tenantId: request.tenantId } });
    if (current?.logoPath) {
      const oldPath = path.join(uploadDir, current.logoPath);
      fs.unlink(oldPath).catch(() => {});
    }

    const logoPath = \`logos/\${filename}\`;
    await prisma.catalogSettings.upsert({
      where: { tenantId: request.tenantId },
      create: { tenantId: request.tenantId, logoPath },
      update: { logoPath },
    });

    return { logoPath };`;

if (content.includes(logoOld)) {
  content = content.replace(logoOld, logoNew);
  console.log('Logo fix applied');
} else {
  console.log('Logo old text not found - may already be fixed or different');
}

// Fix banner upload: store 'banners/filename' in DB
const bannerOld = `    const filename = \`\${request.tenantId}_\${Date.now()}\${ext}\`;
    const filepath = path.join(bannersDir, filename);
    await fs.writeFile(filepath, await file.toBuffer());

    // Get linkUrl from fields (multipart fields come separately)
    // We'll read it from the query or just save without linkUrl for now
    const catalog = await prisma.catalogSettings.findUnique({ where: { tenantId: request.tenantId } });
    if (!catalog) {
      await prisma.catalogSettings.create({ data: { tenantId: request.tenantId } });
    }

    const existing = await prisma.catalogSettings.findUnique({ where: { tenantId: request.tenantId } });

    const maxSort = await prisma.catalogBanner.aggregate({
      where: { catalogId: existing!.id },
      _max: { sortOrder: true },
    });

    const banner = await prisma.catalogBanner.create({
      data: {
        catalogId: existing!.id,
        imagePath: filename,`;

const bannerNew = `    const filename = \`\${request.tenantId}_\${Date.now()}\${ext}\`;
    const filepath = path.join(bannersDir, filename);
    await fs.writeFile(filepath, await file.toBuffer());

    // Get linkUrl from fields (multipart fields come separately)
    // We'll read it from the query or just save without linkUrl for now
    const catalog = await prisma.catalogSettings.findUnique({ where: { tenantId: request.tenantId } });
    if (!catalog) {
      await prisma.catalogSettings.create({ data: { tenantId: request.tenantId } });
    }

    const existing = await prisma.catalogSettings.findUnique({ where: { tenantId: request.tenantId } });

    const maxSort = await prisma.catalogBanner.aggregate({
      where: { catalogId: existing!.id },
      _max: { sortOrder: true },
    });

    const bannerPath = \`banners/\${filename}\`;
    const banner = await prisma.catalogBanner.create({
      data: {
        catalogId: existing!.id,
        imagePath: bannerPath,`;

if (content.includes(bannerOld)) {
  content = content.replace(bannerOld, bannerNew);
  console.log('Banner fix applied');
} else {
  console.log('Banner old text not found - may already be fixed or different');
}

// Also fix the banner delete - it uses path.join(bannersDir, banner.imagePath)
// Since imagePath now includes 'banners/' prefix, we need to use uploadDir instead
const bannerDeleteOld = `    // Delete file
    const filepath = path.join(bannersDir, banner.imagePath);`;
const bannerDeleteNew = `    // Delete file
    const filepath = path.join(uploadDir, banner.imagePath);`;

if (content.includes(bannerDeleteOld)) {
  content = content.replace(bannerDeleteOld, bannerDeleteNew);
  console.log('Banner delete path fix applied');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('All fixes applied to catalog-settings/index.ts');
