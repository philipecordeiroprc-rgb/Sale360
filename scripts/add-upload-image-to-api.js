const fs = require('fs');
const filePath = 'C:/Users/rafac/Documents/GitHub/Sale360/apps/web/src/lib/api.ts';
let content = fs.readFileSync(filePath, 'utf8');

const oldText = `    deleteVariation(productId: string, variationId: string) {
      return request<{ success: boolean }>(\`/api/products/\${productId}/variations/\${variationId}\`, { method: 'DELETE' });
    },
  },`;

const newText = `    deleteVariation(productId: string, variationId: string) {
      return request<{ success: boolean }>(\`/api/products/\${productId}/variations/\${variationId}\`, { method: 'DELETE' });
    },
    uploadImage(productId: string, file: File) {
      const formData = new FormData();
      formData.append('file', file);
      return upload(\`/api/products/\${productId}/image\`, formData);
    },
  },`;

if (content.includes(oldText)) {
  content = content.replace(oldText, newText);
  console.log('uploadImage added to API client');
} else if (content.includes('uploadImage(productId')) {
  console.log('uploadImage already exists');
} else {
  console.log('Old text not found. Searching for deleteVariation...');
  const idx = content.indexOf('deleteVariation');
  if (idx >= 0) {
    console.log('Context:', JSON.stringify(content.substring(idx, idx + 300)));
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');
