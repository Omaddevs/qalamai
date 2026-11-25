// An <img> for design pictures: `asset:` references are drawn from this device's storage
// (src/assets.js); a picture that isn't on this device shows a quiet placeholder instead.
import { ImageBroken } from '@phosphor-icons/react'
import { useAsset } from '../assets.js'
import { t } from '../i18n/index.js'

export default function AssetImg({ src, alt = '', style, className, ...rest }) {
  const { url, missing } = useAsset(src)
  if (missing) {
    return (
      <span className={`asset-missing ${className ?? ''}`} title={t('as.missing')} role="img" aria-label={t('as.missing')}>
        <ImageBroken weight="duotone" />
        <small>{t('as.missingShort')}</small>
      </span>
    )
  }
  // while loading: an empty image of the same box, so nothing jumps
  return <img src={url ?? undefined} alt={alt} style={style} className={className} {...rest} />
}
