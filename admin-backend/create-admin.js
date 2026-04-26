// Run: node create-admin.js your@email.com Password123 "Your Name"
const bcrypt = require('bcryptjs')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.admin' })

async function main() {
  const email = process.argv[2]
  const password = process.argv[3]
  const name = process.argv[4] || 'Admin'

  if (!email || !password) {
    console.error('Usage: node create-admin.js email password "Full Name"')
    process.exit(1)
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const hash = await bcrypt.hash(password, 12)

  const { data, error } = await supabase.from('admin_users').insert({
    email, password_hash: hash, full_name: name, role: 'super_admin', is_active: true
  }).select().single()

  if (error) { console.error('Error:', error.message); process.exit(1) }

  console.log('✅ Admin created successfully!')
  console.log(`   Email: ${email}`)
  console.log(`   Password: ${password}`)
  console.log(`   Role: super_admin`)
  console.log('\nOpen: http://localhost:3002')
}

main()
