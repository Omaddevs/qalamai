// Miniature of a logo / link-in-bio / resume, sized to whatever box it sits in.
import { useEffect, useRef, useState } from 'react'
import LogoArt from './LogoArt.jsx'
import { BioPage } from './BioPhone.jsx'
import CvPage from './CvPage.jsx'
import { paletteOf } from './logo.js'
import './creators.css'

/** Renders children at a fixed design size and scales them to fit the box. */
export function Scaled({ width, height, children, className = '', top = false }) {
  const box = useRef(null)
  const [k, setK] = useState(0)
  useEffect(() => {
    const el = box.current
    const fit = () => setK(top ? el.clientWidth / width : Math.min(el.clientWidth / width, el.clientHeight / height))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width, height, top])
  return (
    <div ref={box} className={`kt-scaled ${className}`}>
      {k > 0 && (
        <div className="kt-scaled-inner" style={{ width, height, transform: top ? `translateX(-50%) scale(${k})` : `translate(-50%, -50%) scale(${k})` }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function KitThumb({ type, data }) {
  if (type === 'logo') {
    return (
      <div className="kt kt-logo" style={{ background: paletteOf(data).bg }}>
        <LogoArt model={data} background={false} />
      </div>
    )
  }
  if (type === 'bio') {
    return (
      <div className="kt kt-bio">
        <Scaled width={300} height={600} top>
          <div className="kt-phone">
            <BioPage data={data} compact />
          </div>
        </Scaled>
      </div>
    )
  }
  return (
    <div className="kt kt-cv">
      <Scaled width={794} height={1123} top>
        <CvPage cv={data} />
      </Scaled>
    </div>
  )
}
