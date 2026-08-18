import { redirect } from 'next/navigation'

/** The prototype opens on the shipper persona (ui-2.html bootstrap). */
export default function Root() {
  redirect('/shipper')
}
