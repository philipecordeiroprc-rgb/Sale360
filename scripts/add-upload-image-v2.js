const fs = require('fs');
const filePath = 'C:/Users/rafac/Documents/GitHub/Sale360/apps/web/src/lib/api.ts';
let content = fs.readFileSync(filePath, 'utf8');

if (content.includes('uploadImage(productId')) {
  console.log('uploadImage already exists');
  process.exit(0);
}

// Find the deleteVariation function and insert uploadImage after it
const searchFor = 'deleteVariation(productId: string, variationId: string)';
const idx = content.indexOf(searchFor);
if (idx < 0) {
  console.log('Could not find deleteVariation');
  process.exit(1);
}

// Find the closing of the products section (next "}," after deleteVariation's return)
const afterDelete = content.indexOf('method: \'DELETE\'', idx);
const endOfFn = content.indexOf('  },\n', afterDelete);

if (endOfFn < 0) {
  console.log('Could not find end of products section');
  // Try with \r\n
  const altEnd = content.indexOf('  },\r\n', afterDelete);
  if (altEnd >= 0) {
    const insertAt = altEnd + '  },\r\n'.length;
    const insertText = '    uploadImage(productId: string, file: File) {\r\n      const formData = new FormData();\r\n      formData.append(\'file\', file);\r\n      return upload(`/api/products/${productId}/image`, formData);\r\n    },\r\n';
    content = content.slice(0, insertAt) + insertText + content.slice(insertAt);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('uploadImage added (CRLF)');
    process.exit(0);
  }
  console.log('Could not find insertion point');
  process.exit(1);
}

const insertAt = endOfFn + '  },\n'.length;
const insertText = '    uploadImage(productId: string, file: File) {\n      const formData = new FormData();\n      formData.append(\'file\', file);\n      return upload(`/api/products/${productId}/image`, formData);\n    },\n';
content = content.slice(0, insertAt) + insertText + content.slice(insertAt);
fs.writeFileSync(filePath, content, 'utf8');
console.log('uploadImage added (LF)');
