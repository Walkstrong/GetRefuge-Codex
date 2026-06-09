import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
import { LandingPage } from '../../components/landing/LandingPage'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'GetRefuge | Secure humanitarian M&E system' },
      {
        name: 'description',
        content:
          'GetRefuge is a secure humanitarian Monitoring and Evaluation system with offline encrypted field capture, private on-device AI briefings, and safer HQ analysis.',
      },
    ],
  }),
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: LandingPage,
})
