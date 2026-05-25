/**
 * InvoicePro Icon Generator
 * Run: node generate-icons.mjs
 * Requires: npm install sharp (run once)
 *
 * Generates all required PNG icons for PWA + App Store + Play Store
 */

import { createCanvas } from 'canvas'
import fs from 'fs'
import path from 'path'

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const outputDir = './public/icons'

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

function drawIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const r = size * 0.2 // border radius

  // Background: dark #1a1814
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(size - r, 0)
  ctx.quadraticCurveTo(size, 0, size, r)
  ctx.lineTo(size, size - r)
  ctx.quadraticCurveTo(size, size, size - r, size)
  ctx.lineTo(r, size)
  ctx.quadraticCurveTo(0, size, 0, size - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
  ctx.fillStyle = '#1a1814'
  ctx.fill()

  const u = size / 200 // scale unit

  // White lines (invoice lines)
  ctx.fillStyle = 'white'
  ctx.beginPath(); ctx.roundRect(40*u, 36*u, 90*u, 10*u, 5*u); ctx.fill()
  ctx.globalAlpha = 0.5
  ctx.beginPath(); ctx.roundRect(40*u, 58*u, 68*u, 10*u, 5*u); ctx.fill()
  ctx.beginPath(); ctx.roundRect(40*u, 80*u, 76*u, 10*u, 5*u); ctx.fill()
  ctx.globalAlpha = 1

  // Green circle
  ctx.fillStyle = '#a3e635'
  ctx.beginPath()
  ctx.arc(148*u, 154*u, 36*u, 0, Math.PI * 2)
  ctx.fill()

  // Checkmark
  ctx.strokeStyle = '#1a1814'
  ctx.lineWidth = 5 * u
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(136*u, 154*u)
  ctx.lineTo(144*u, 162*u)
  ctx.lineTo(162*u, 144*u)
  ctx.stroke()

  return canvas
}

console.log('Generating icons...')
for (const size of sizes) {
  const canvas = drawIcon(size)
  const buffer = canvas.toBuffer('image/png')
  const filePath = path.join(outputDir, `icon-${size}.png`)
  fs.writeFileSync(filePath, buffer)
  console.log(`✅ Created icon-${size}.png`)
}

// Also create apple-touch-icon (180x180)
const appleCanvas = drawIcon(180)
fs.writeFileSync('./public/apple-touch-icon.png', appleCanvas.toBuffer('image/png'))
console.log('✅ Created apple-touch-icon.png')

console.log('\n🎉 All icons generated! Run: npm run build && npx cap sync')
