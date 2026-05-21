const fs = require('fs');
const fp = 'C:/Users/rafac/Documents/GitHub/Sale360/apps/web/src/app/c/[slug]/CatalogPageClient.tsx';
let c = fs.readFileSync(fp, 'utf8');

// Count fixes
let fixes = 0;

// Fix 1: productImage function - handle data URIs and full URLs
// Find the function
const pattern1 = /  const productImage = \(product: Product\): string \| null => \{\s*\n\s*if \(product\.imageUrl\) return `\$\{API_URL\}\/api\/public\/uploads\/\$\{product\.imageUrl\}`;\s*\n\s*return null;\s*\n\s*\};/;
if (pattern1.test(c)) {
  const replacement1 = `  const getImageUrl = (urlPath: string | null): string | null => {
    if (!urlPath) return null;
    // Already a full URL or data URI — use as-is
    if (urlPath.startsWith('http://') || urlPath.startsWith('https://') || urlPath.startsWith('data:')) return urlPath;
    return \`\${API_URL}/api/public/uploads/\${urlPath}\`;
  };

  const productImage = (product: Product): string | null => getImageUrl(product.imageUrl);`;
  c = c.replace(pattern1, replacement1);
  fixes++;
  console.log('Fix 1: productImage function updated');
} else {
  console.log('Fix 1: pattern not matched');
}

// Fix 2: Logo in header
const pattern2 = /src=\{`\$\{API_URL\}\/api\/public\/uploads\/\$\{store\.logoPath\}`\}/;
if (pattern2.test(c)) {
  c = c.replace(pattern2, "src={getImageUrl(store.logoPath) || ''}");
  fixes++;
  console.log('Fix 2: logo updated');
}

// Fix 3: Banner images (in the map)
const pattern3 = /src=\{`\$\{API_URL\}\/api\/public\/uploads\/\$\{banner\.imagePath\}`\}/g;
const matches3 = c.match(pattern3);
if (matches3) {
  c = c.replace(pattern3, "src={getImageUrl(banner.imagePath) || ''}");
  fixes++;
  console.log(`Fix 3: ${matches3.length} banner image(s) updated`);
}

// Fix 4: Quick view product image
const pattern4 = /src=\{`\$\{API_URL\}\/api\/public\/uploads\/\$\{quickViewProduct\.imageUrl\}`\}/;
if (pattern4.test(c)) {
  c = c.replace(pattern4, "src={getImageUrl(quickViewProduct.imageUrl) || ''}");
  fixes++;
  console.log('Fix 4: quick view image updated');
}

fs.writeFileSync(fp, c, 'utf8');
console.log(`Done. ${fixes} fixes applied.`);
