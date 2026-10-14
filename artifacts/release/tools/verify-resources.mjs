import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const lock=JSON.parse(await fs.readFile('RESOURCE_LOCK.json','utf8'));
for(const item of lock.installedAssets){
  const data=await fs.readFile(item.path);
  const hash=crypto.createHash('sha256').update(data).digest('hex');
  if(data.length!==item.bytes || hash!==item.sha256)throw new Error(`Resource changed: ${item.path}`);
}
console.log(`Verified ${lock.installedAssets.length} local resource files.`);
