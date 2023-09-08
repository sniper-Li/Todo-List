const fs = require('fs');

fs.readFile('.env', 'utf8', (err, data) => {
  if (err) {
    console.error(err);
    return;
  }

  const newContent = data.split('\n').map(line => {
    const [key, value] = line.split('=');
    return value !== undefined ? `${key}=` : line;
  }).join('\n');

  fs.writeFile('.env', newContent, 'utf8', err => {
    if (err) {
      console.error(err);
    } else {
      console.log('.env file values have been cleared.');
    }
  });
});
