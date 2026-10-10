import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const iconDir = path.join(root,'icons');
await fs.mkdir(iconDir,{recursive:true});

// Render the existing e mark without a font, network request, or build dependency.
const teal = [23,200,150], ink = [0,38,27];
function pixel(x,y,maskable) {
  const inset = maskable ? 0 : 26, radius = maskable ? 0 : 105;
  const cx = Math.max(inset+radius,Math.min(512-inset-radius,x));
  const cy = Math.max(inset+radius,Math.min(512-inset-radius,y));
  if(!maskable && Math.hypot(x-cx,y-cy)>radius)return [0,0,0];
  const outer = ((x-250)/113)**2+((y-270)/120)**2 <= 1;
  const inner = ((x-250)/72)**2+((y-270)/77)**2 < 1;
  const opening = x>282 && y>278 && y<316;
  const bar = x>=168&&x<=363&&y>=250&&y<=284;
  const dot = (x-368)**2+(y-145)**2<=16**2;
  return ((outer&&!inner&&!opening)||bar||dot)?ink:teal;
}
function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function chunk(type,data) {
  const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);
  size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));
  return Buffer.concat([size,name,data,crc]);
}
function png(size,maskable=false) {
  const raw=Buffer.alloc((size*3+1)*size),scale=512/size,samples=4;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const sum=[0,0,0];
    for(let sy=0;sy<samples;sy++)for(let sx=0;sx<samples;sx++){
      const color=pixel((x+(sx+.5)/samples)*scale,(y+(sy+.5)/samples)*scale,maskable);
      for(let c=0;c<3;c++)sum[c]+=color[c];
    }
    for(let c=0;c<3;c++)raw[y*(size*3+1)+1+x*3+c]=Math.round(sum[c]/samples**2);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
for(const [file,size,maskable]of [['icon-192.png',192,false],['icon-512.png',512,false],['icon-maskable-512.png',512,true],['apple-touch-icon.png',180,false]])await fs.writeFile(path.join(iconDir,file),png(size,maskable));
await fs.writeFile(path.join(iconDir,'app-icon.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="120" fill="#17c896"/><path d="M340 321a93 99 0 1 1 4-53H167" fill="none" stroke="#00261b" stroke-width="41"/><circle cx="368" cy="145" r="16" fill="#00261b"/></svg>\n');

const html=await fs.readFile(path.join(root,'index.html'),'utf8');
const resources=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match=>match[1]).filter(value=>/^(?:[\w-]+\.(?:js|css|png)|manifest\.webmanifest|icons\/[\w-]+\.(?:png|svg))(?:\?[^#]*)?$/.test(value));
const shell=[...new Set([...resources,'offline.html','offline.css','offline.js','icons/icon-512.png','icons/icon-maskable-512.png'])].sort();
const swPath=path.join(root,'sw.js'),sw=await fs.readFile(swPath,'utf8');
const marker=/\/\/ BEGIN GENERATED PWA RELEASE[\s\S]*?\/\/ END GENERATED PWA RELEASE/;
if(!marker.test(sw))throw new Error('Missing service worker release block');
const digest=createHash('sha256').update(html).update(sw.replace(marker,''));
for(const asset of shell){digest.update(asset);digest.update(await fs.readFile(path.join(root,asset.split('?')[0])));}
const version=digest.digest('hex').slice(0,16);
await fs.writeFile(swPath,sw.replace(marker,`// BEGIN GENERATED PWA RELEASE\nconst RELEASE = '${version}';\nconst SHELL = ${JSON.stringify(shell,null,2)};\n// END GENERATED PWA RELEASE`));
console.log(`PWA release ${version}: ${shell.length} public assets prepared.`);
