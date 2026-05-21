const fs = require('fs');
const filePath = 'C:/Users/rafac/Documents/GitHub/Sale360/apps/web/src/app/c/[slug]/CatalogPageClient.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Update Product type interface - imagePath → imageUrl
content = content.replace('imagePath: string | null;', 'imageUrl: string | null;');
console.log('Fix 1:', content.includes('imageUrl: string | null;') ? 'OK' : 'FAIL');

// Fix 2: Update productImage function to use imageUrl
let oldFn = `  const productImage = (product: Product): string | null => {
    if (product.imagePath) return \`\${API_URL}/api/public/uploads/\${product.imagePath}\`;
    return null;
  };`;
let newFn = `  const productImage = (product: Product): string | null => {
    if (product.imageUrl) return \`\${API_URL}/api/public/uploads/\${product.imageUrl}\`;
    return null;
  };`;
if (content.includes(oldFn)) {
  content = content.replace(oldFn, newFn);
  console.log('Fix 2: OK');
} else {
  // Try with different spacing
  if (content.includes('product.imagePath')) {
    content = content.replace(/product\.imagePath/g, 'product.imageUrl');
    console.log('Fix 2 (alt): replaced all product.imagePath');
  } else {
    console.log('Fix 2: no product.imagePath found');
  }
}

// Fix 3: Quick view modal uses quickViewProduct.imagePath
if (content.includes('quickViewProduct.imagePath')) {
  content = content.replace(/quickViewProduct\.imagePath/g, 'quickViewProduct.imageUrl');
  console.log('Fix 3: OK');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('All imagePath → imageUrl fixes applied');
