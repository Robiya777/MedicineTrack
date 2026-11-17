import { Link } from '@tanstack/react-router'
import { Activity, ArrowLeft, ArrowRight, CircleCheck, Columns2, GitCompareArrows, HeartPulse, LayoutDashboard, Moon, PanelsTopLeft } from 'lucide-react'
import { screens, variantIds, variants } from './catalog'
import type { VariantId } from './catalog'
import './design.css'
import './medicinetrack/preview.css'

const icons = { medicinetrack: HeartPulse, clinical: LayoutDashboard, operations: Columns2, portal: PanelsTopLeft, night: Moon, guided: CircleCheck }

export function DesignGallery() {
  return <div className="d-gallery">
    <header className="d-gallery-bar">
      <Link to="/" className="d-brand"><span><Activity size={21} aria-hidden /></span> MedicineTrack</Link>
      <Link to="/" className="d-back"><ArrowLeft size={17} aria-hidden /> Bosh sahifa</Link>
    </header>
    <main className="d-gallery-main">
      <div className="d-gallery-intro">
        <div>
          <h1>Web dizayn variantlari</h1>
          <p>MedicineTrack uchun dizayn variantlarini ko‘rib chiqing. Kelishilgan teal va mint yo‘nalishida koordinator preview’si tayyor.</p>
        </div>
        <div className="d-gallery-count"><GitCompareArrows size={20} aria-hidden /><span>{variantIds.length} variant<br /><strong>{Object.keys(screens).length} ta ekran</strong></span></div>
      </div>
      <div className="d-gallery-grid">
        {variantIds.map((id) => {
          const variant = variants[id]
          const Icon = icons[id]
          return <article className="d-gallery-card" key={id}>
            <Link to="/design/$variant/$screen" params={{ variant: id, screen: variant.startScreen }} aria-label={variant.name + ' variantini ochish'} className="d-card-link">
              <Thumbnail variant={id} />
              <div className="d-card-body">
                <span className="d-card-icon"><Icon size={20} aria-hidden /></span>
                <div><h2>{variant.name}</h2><p>{variant.description}</p></div>
                <ArrowRight className="d-card-arrow" size={20} aria-hidden />
              </div>
            </Link>
          </article>
        })}
      </div>
      <p className="d-gallery-foot">Dizayn sinovi · Sintetik ma’lumot</p>
    </main>
  </div>
}

function Thumbnail({ variant }: { variant: VariantId }) {
  return <div className="d-thumbnail" data-variant={variant} aria-hidden="true">
    <div className="d-thumb-window">
      <div className="d-thumb-rail">
        <span><Activity size={11} /> MedicineTrack</span>
        <i /><i /><i />
      </div>
      <div className="d-thumb-content">
        <span className="d-thumb-title">{variant === 'guided' ? 'Chiqarish formasi' : variant === 'portal' ? 'Bugungi kuzatuv' : 'Chaqiruv navbati'}</span>
        <div className="d-thumb-metrics">
          {(variant === 'guided' ? ['1', '2', '3'] : variant === 'portal' ? ['Aloqa', 'Holat', 'Dorilar'] : ['3', '1', '50%']).map((item) => <b key={item}>{item}</b>)}
        </div>
        <div className="d-thumb-work"><div><i /><i /><i /></div><div><i /><i /></div></div>
      </div>
    </div>
  </div>
}
