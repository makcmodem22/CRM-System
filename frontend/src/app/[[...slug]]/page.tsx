'use client'

import dynamic from 'next/dynamic'

const StudioApp = dynamic(() => import('@/App'), { ssr: false })

export default function HomePage() {
  return <StudioApp />
}
