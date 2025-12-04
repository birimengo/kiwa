const fs = require('fs');
const path = require('path');

// Ensure dist directory exists
const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy sitemap.xml
const sitemapSource = path.join(__dirname, '../public/sitemap.xml');
const sitemapDest = path.join(distDir, 'sitemap.xml');

if (fs.existsSync(sitemapSource)) {
  fs.copyFileSync(sitemapSource, sitemapDest);
  console.log('✅ sitemap.xml copied successfully!');
} else {
  console.log('⚠️  sitemap.xml not found in public folder');
}

// Copy robots.txt
const robotsSource = path.join(__dirname, '../public/robots.txt');
const robotsDest = path.join(distDir, 'robots.txt');

if (fs.existsSync(robotsSource)) {
  fs.copyFileSync(robotsSource, robotsDest);
  console.log('✅ robots.txt copied successfully!');
} else {
  console.log('⚠️  robots.txt not found in public folder');
}

console.log('🎉 SEO files generation complete!');