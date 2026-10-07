import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/States'

export default function NotFoundPage() {
  return (
    <EmptyState
      className="min-h-[60vh]"
      icon={<Compass className="size-6" />}
      title="Sayfa bulunamadı"
      description="Aradığınız sayfa yörüngeden çıkmış olabilir."
      action={
        <Link to="/dashboard">
          <Button variant="primary">Genel bakışa dön</Button>
        </Link>
      }
    />
  )
}
