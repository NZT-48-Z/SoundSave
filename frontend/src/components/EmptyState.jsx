import { bg, text } from '../theme'

// Shared empty-state block (dotted backdrop + icon + copy).
// Pass the icon's inner SVG elements as children.
export default function EmptyState({ title, subtitle, children }) {
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 0 180px', gap: 14, textAlign: 'center', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle, ${bg.dot} 1px, transparent 1px)`,
        backgroundSize: '28px 28px',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 75% at 50% 50%, black 20%, transparent 80%)',
        maskImage: 'radial-gradient(ellipse 80% 75% at 50% 50%, black 20%, transparent 80%)',
        pointerEvents: 'none',
      }} />
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={text.muted} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative' }}>
        {children}
      </svg>
      <div style={{ position: 'relative' }}>
        <p style={{ fontSize: 15, color: text.muted, fontWeight: 500, marginBottom: subtitle ? 6 : 0 }}>{title}</p>
        {subtitle && (
          <p style={{ fontSize: 13, color: text.muted, opacity: 0.7, maxWidth: 320, lineHeight: 1.6, margin: '0 auto' }}>{subtitle}</p>
        )}
      </div>
    </div>
  )
}
