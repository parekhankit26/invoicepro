export default function LandingPage() {
  // Redirect to the static landing page
  if (typeof window !== 'undefined') {
    window.location.replace('/index-landing.html')
  }
  return null
}
