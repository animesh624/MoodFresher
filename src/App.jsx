import { useState, useMemo, useEffect, useRef } from 'react'
import './App.css'

import brandLogo from './resources/Logo.jpeg'
import itemsData from './data/items.json'

const WHATSAPP_NUMBER = '918736066574'

// Restaurant location
const RESTAURANT_LAT = 25.454273556578134
const RESTAURANT_LNG = 81.84516284402

const FREE_DELIVERY_KM = 3
const DELIVERY_CHARGE_PER_KM = 10

const MIN_ORDER_AMOUNT = 200

// Discount tiers — sorted by minAmount ascending
const DISCOUNT_TIERS = [
  { minAmount: 300, discountPercent: 10, label: '10% OFF', emoji: '🔥' },
  { minAmount: 500, discountPercent: 15, label: '15% OFF', emoji: '⚡' },
  { minAmount: 800, discountPercent: 20, label: '20% OFF', emoji: '💥' },
]

const menuImages = import.meta.glob('./resources/*.jpeg', { eager: true, query: '?url', import: 'default' })

const photoMap = {}
for (const [path, module] of Object.entries(menuImages)) {
  const filename = path.replace('./resources/', '')
  if (filename !== 'Logo.jpeg') {
    photoMap[filename] = module
  }
}

const MENU = itemsData.items.map(item => ({
  id: item.id,
  name: item.itemName,
  // `price` is required for single-price items. For half/full items it falls
  // back to priceFull/priceHalf so the item is always safe to render.
  price: item.price ?? item.priceFull ?? item.priceHalf ?? 0,
  priceHalf: item.priceHalf ?? null,
  priceFull: item.priceFull ?? null,
  hasHalfFull: !!(item.priceHalf != null && item.priceFull != null),
  desc: item.description,
  img: photoMap[item.photoName],
  category: item.category,
}))

const CONFIG = itemsData
const SHOP_OPEN = CONFIG.shopOpen
const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const calcDeliveryCharge = (distanceKm) => {
  if (distanceKm == null || distanceKm <= 0) return 0
  if (distanceKm <= FREE_DELIVERY_KM) return 0
  const extraKm = Math.round(distanceKm - FREE_DELIVERY_KM)
  if (extraKm <= 0) return 0
  return extraKm * DELIVERY_CHARGE_PER_KM
}

const isShopOperating = () => {
  if (!SHOP_OPEN) return false
  const config = CONFIG.operatingHours
  if (!config.enabled) return true
  const now = new Date()
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
  return config.days.includes(dayName) && currentTime >= config.openTime && currentTime < config.closeTime
}

const formatTime = (time24) => {
  const [h, m] = time24.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${m} ${ampm}`
}

const getClosedDaysList = (openDays) => {
  const closedDays = ALL_DAYS.filter(d => !openDays.includes(d))
  const dayLabels = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun'
  }
  return closedDays.map(d => dayLabels[d] || d)
}

const getClosureMessage = (shopOpen, config) => {
  const openTimeFormatted = formatTime(config.openTime)
  const closeTimeFormatted = formatTime(config.closeTime)
  if (!shopOpen) {
    return {
      icon: '🔒',
      title: 'Currently Offline',
      detail: "We're temporarily unavailable. Thank you for your patience. Please reach out to us via WhatsApp to enquire or pre-order."
    }
  }
  if (!config.enabled) return null
  const now = new Date()
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
  const isOperatingDay = config.days.includes(dayName)
  if (!isOperatingDay) {
    const closedList = getClosedDaysList(config.days)
    return {
      icon: '😴',
      title: `Closed on ${closedList.join(', ')}`,
      detail: closedList.includes(dayName.slice(0, 3))
        ? `We're closed today (${dayName}). Our operating hours are ${openTimeFormatted} - ${closeTimeFormatted}. See you on our next working day!`
        : `We're open ${openTimeFormatted} - ${closeTimeFormatted}. We're closed on ${closedList.join(', ')}.`
    }
  } else {
    return {
      icon: '⏰',
      title: "Not Open Yet",
      detail: `Our kitchen opens at ${openTimeFormatted} and closes at ${closeTimeFormatted}. Please visit us during operating hours.`
    }
  }
}

// Calculate discount info from subtotal
const getDiscountInfo = (subtotal) => {
  // Find the highest tier the subtotal qualifies for
  let activeTier = null
  for (const tier of DISCOUNT_TIERS) {
    if (subtotal >= tier.minAmount) {
      activeTier = tier
    }
  }
  if (!activeTier) return { tier: null, discountPercent: 0, discountAmount: 0 }

  const discountPercent = activeTier.discountPercent
  const discountAmount = Math.round((subtotal * discountPercent) / 100)
  return { tier: activeTier, discountPercent, discountAmount }
}

// Find next tier the user is aiming for
const getNextTier = (subtotal) => {
  for (const tier of DISCOUNT_TIERS) {
    if (subtotal < tier.minAmount) return tier
  }
  return null
}

// Calculate progress percentage — aligned with the ladder visual bar
// The bar spans from MIN_ORDER_AMOUNT (₹200) to max tier (₹800)
// Progress = (subtotal - MIN_ORDER) / (maxTier - MIN_ORDER) * 100
// This matches marker positions e.g. ₹300 → 16.7%, ₹500 → 50%, ₹800 → 100%
const getDiscountProgress = (subtotal) => {
  const maxTier = DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1].minAmount
  const range = maxTier - MIN_ORDER_AMOUNT
  if (subtotal >= maxTier) return 100
  if (subtotal <= MIN_ORDER_AMOUNT) return 0
  return Math.min(100, ((subtotal - MIN_ORDER_AMOUNT) / range) * 100)
}

const CATEGORIES = ['All', 'Chinese', 'Chaap Specials', 'Thali', 'Indian Gravy', 'Combos', 'Momos']

const buildInitQuantities = () => {
  const q = {}
  MENU.forEach(item => {
    if (item.hasHalfFull) {
      q[`${item.id}_half`] = 0
      q[`${item.id}_full`] = 0
    } else {
      q[`${item.id}`] = 0
    }
  })
  return q
}

const resolveItem = (key) => {
  const [idStr, variant] = key.includes('_') ? key.split('_') : [key, null]
  const id = parseInt(idStr)
  const item = MENU.find(m => m.id === id)
  if (!item) return null
  if (variant === 'half' && item.hasHalfFull) {
    return { ...item, displayPrice: item.priceHalf, displayName: `${item.name} (Half)`, badge: 'Half' }
  }
  if (variant === 'full' && item.hasHalfFull) {
    return { ...item, displayPrice: item.priceFull, displayName: `${item.name} (Full)`, badge: 'Full' }
  }
  return { ...item, displayPrice: item.price, displayName: item.name, badge: '' }
}

function App() {
  const [quantities, setQuantities] = useState(buildInitQuantities)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [mobile, setMobile] = useState('')
  const [instructions, setInstructions] = useState('')
  const [location, setLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [deliveryDistance, setDeliveryDistance] = useState(null)
  const [activeCat, setActiveCat] = useState('All')
  const [navOpen, setNavOpen] = useState(false)
  const [view, setView] = useState('menu')
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)
  const [isOpen, setIsOpen] = useState(isShopOperating())
  const [exploreMenu, setExploreMenu] = useState(false)
  const [celebratedTier, setCelebratedTier] = useState(null) // tracks which tier to celebrate
  const [showCelebration, setShowCelebration] = useState(false)
  const orderPanelRef = useRef(null)
  const catRowRef = useRef(null)
  const prevTierRef = useRef(null)

  const navigate = (newView) => {
    setView(newView)
    const path = newView === 'menu' ? '/' : `/${newView}`
    try { window.history.pushState({ view: newView }, '', path) } catch (e) { /* ignore */ }
  }

  useEffect(() => {
    const p = window.location.pathname.replace(/\/$/, '')
    if (p === '' || p === '/') setView('menu')
    else if (p.includes('contact')) setView('contact')
    else if (p.includes('about')) setView('about')
    else setView('menu')
    const onPop = (e) => {
      const state = (e.state && e.state.view) || window.location.pathname.replace(/\/$/, '')
      if (state === '' || state === '/' ) setView('menu')
      else if (typeof state === 'string' && state.includes('contact')) setView('contact')
      else if (typeof state === 'string' && state.includes('about')) setView('about')
      else setView('menu')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const inc = (key) => setQuantities(q => ({ ...q, [key]: (q[key] || 0) + 1 }))
  const dec = (key) => setQuantities(q => ({ ...q, [key]: Math.max(0, (q[key] || 0) - 1) }))
  const setQty = (key, val) => setQuantities(q => ({ ...q, [key]: Math.max(0, Number(val) || 0) }))

  const visibleMenu = useMemo(() => MENU.filter(m => activeCat === 'All' || m.category === activeCat), [activeCat])

  const orderLines = useMemo(() => {
    const lines = []
    for (const [key, qty] of Object.entries(quantities)) {
      if (!qty || qty <= 0) continue
      const info = resolveItem(key)
      if (info) {
        lines.push({ ...info, qty, lineTotal: qty * info.displayPrice })
      }
    }
    return lines
  }, [quantities])

  const subtotal = orderLines.reduce((s, it) => s + it.lineTotal, 0)
  const deliveryCharge = deliveryDistance != null ? calcDeliveryCharge(deliveryDistance) : 0

  // Discount logic
  const { tier: activeTier, discountPercent, discountAmount } = getDiscountInfo(subtotal)
  const nextTier = getNextTier(subtotal)
  const discountProgress = getDiscountProgress(subtotal)
  const meetsMinOrder = subtotal >= MIN_ORDER_AMOUNT
  const shortfallMin = Math.max(0, MIN_ORDER_AMOUNT - subtotal)
  const shortfallNext = nextTier ? Math.max(0, nextTier.minAmount - subtotal) : 0

  // Detect tier unlock for celebration
  useEffect(() => {
    const currentTierKey = activeTier ? activeTier.minAmount : 0
    if (currentTierKey !== prevTierRef.current) {
      if (currentTierKey > 0 && (prevTierRef.current === null || currentTierKey > prevTierRef.current)) {
        setCelebratedTier(activeTier)
        setShowCelebration(true)
        setTimeout(() => setShowCelebration(false), 6000)
      }
      prevTierRef.current = currentTierKey
    }
  }, [activeTier, subtotal])

  const totalBeforeDiscount = subtotal + deliveryCharge
  const total = totalBeforeDiscount - discountAmount

  const canPlace = name.trim() !== '' && address.trim() !== '' && mobile.trim() !== '' && subtotal > 0 && WHATSAPP_NUMBER && isOpen && meetsMinOrder

  const scrollToOrderPanel = () => {
    if (orderPanelRef.current) {
      orderPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const placeOrder = () => {
    if (!canPlace) {
      if (!meetsMinOrder) {
        alert(`Minimum order amount is ₹${MIN_ORDER_AMOUNT}. Please add items worth ₹${shortfallMin} more.`)
        return
      }
      alert('Please enter name, address and select at least one item before placing the order.')
      return
    }

    let msg = `Mood Fresher - New order from website\nName: ${name}\nMobile: ${mobile}\nAddress: ${address}\n\nItems:\n`
    orderLines.forEach(it => {
      msg += `${it.displayName} x ${it.qty} = ₹${it.lineTotal}\n`
    })
    msg += `\nSubtotal: ₹${subtotal}`
    if (deliveryCharge > 0) {
      const roundedKm = Math.round(deliveryDistance - FREE_DELIVERY_KM)
      msg += `\nDelivery Charge (${roundedKm} km beyond ${FREE_DELIVERY_KM}km): ₹${deliveryCharge}`
    } else if (deliveryDistance != null) {
      msg += `\nDelivery Charge: Free`
    }
    if (discountAmount > 0) {
      msg += `\nDiscount (${discountPercent}% OFF): -₹${discountAmount}`
    }
    msg += `\nTotal: ₹${total}`
    if (instructions && instructions.trim()) {
      msg += `\n\nInstructions: ${instructions.trim()}`
    }
    if (location) {
      msg += `\n\n📍 Live Location: ${location}`
    }
    const encoded = encodeURIComponent(msg)
    const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`
    window.open(waLink, '_blank')
  }

  const cartCount = orderLines.reduce((s, it) => s + it.qty, 0)

  const handleTouchStart = (e) => setTouchStart(e.targetTouches[0].clientX)
  const handleTouchEnd = (e) => {
    setTouchEnd(e.changedTouches[0].clientX)
    if (touchStart - e.changedTouches[0].clientX > 50) {
      setCarouselIdx(prev => (prev + 1) % 3)
    }
    if (e.changedTouches[0].clientX - touchStart > 50) {
      setCarouselIdx(prev => (prev - 1 + 3) % 3)
    }
  }

  useEffect(() => { document.title = 'MoodFresher — Cafe & Restaurant' }, [])

  useEffect(() => {
    const current = isShopOperating()
    setIsOpen(current)
    if (current) setExploreMenu(false)
    const timer = setInterval(() => {
      const newVal = isShopOperating()
      setIsOpen(newVal)
      if (newVal) setExploreMenu(false)
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => { setCarouselIdx(prev => (prev + 1) % 3) }, 3000)
    return () => clearInterval(timer)
  }, [])

  const closureInfo = !isOpen ? getClosureMessage(SHOP_OPEN, CONFIG.operatingHours) : null

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={brandLogo} alt="MoodFresher" />
          <div className="brand-text">
            <div className="logo">MoodFresher</div>
            <div className="tag">Cafe & Restaurant</div>
          </div>
        </div>
        <nav className="top-nav">
          <button className={view === 'menu' ? 'active' : ''} onClick={() => navigate('menu')}>Menu</button>
          <button className={view === 'contact' ? 'active' : ''} onClick={() => navigate('contact')}>Contact</button>
          <button className={view === 'about' ? 'active' : ''} onClick={() => navigate('about')}>About</button>
        </nav>
        <div className="top-actions">
          <div className="cart" title="Cart" onClick={() => { if (cartCount > 0) scrollToOrderPanel() }}>🛒<span className="cart-count">{cartCount}</span></div>
          <button className="hamburger" aria-label="Open menu" onClick={() => setNavOpen(true)}>☰</button>
        </div>
      </header>

      <div className={"nav-drawer" + (navOpen ? ' open' : '')} onClick={() => setNavOpen(false)}>
        <nav className="nav-inner" onClick={e => e.stopPropagation()}>
          <button className="nav-close" onClick={() => setNavOpen(false)}>✕</button>
          <div className="drawer-brand">MoodFresher</div>
          <div className="drawer-sub">Cafe & Restaurant</div>
          <ul>
            <li><button onClick={() => { navigate('menu'); setNavOpen(false); }}>🍽️ Menu</button></li>
            <li><button onClick={() => { navigate('contact'); setNavOpen(false); }}>📞 Contact</button></li>
            <li><button onClick={() => { navigate('about'); setNavOpen(false); }}>ℹ️ About</button></li>
          </ul>
        </nav>
      </div>

      {view === 'menu' && (
        <>
          <section className="hero-banner">
            <h2>Delicious Food, Delivered Fresh!</h2>
            <p>Order Direct & Save More</p>
            <div className="hero-actions">
              <button className="primary" onClick={() => { const el = document.querySelector('.menu-section'); if (el) el.scrollIntoView({ behavior: 'smooth' }) }}>Explore our menu</button>
              <button className="secondary" onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}`, '_blank')}>Call / WhatsApp</button>
            </div>
          </section>
          <section className="info-section">
            <div className="free-delivery-banner" onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}`, '_blank')}>
              <span className="fd-icon">🚚</span>
              <div className="fd-text">
                <div className="fd-title">FREE DELIVERY</div>
                <div className="fd-sub">Free within <strong>3 km</strong> • just <strong>₹10/km</strong> beyond</div>
              </div>
            </div>
            <div className="carousel-wrapper" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
              <div className="carousel-items" style={{ transform: `translateX(-${carouselIdx * 100}%)` }}>
                <div className="carousel-item">
                  <span className="carousel-icon">💰</span>
                  <h4>Best Prices</h4>
                  <p>Order direct and save more — no middlemen, just great value.</p>
                </div>
                <div className="carousel-item">
                  <span className="carousel-icon">🍳</span>
                  <h4>Freshly Prepared</h4>
                  <p>Made to order with fresh ingredients, every single time.</p>
                </div>
                <div className="carousel-item">
                  <span className="carousel-icon">🚗</span>
                  <h4>Fast Delivery</h4>
                  <p>Typical delivery time 30–45 minutes, right to your door.</p>
                </div>
              </div>
              <div className="carousel-dots">
                {[0, 1, 2].map(i => (
                  <button key={i} className={`dot ${i === carouselIdx ? 'active' : ''}`} onClick={() => setCarouselIdx(i)} aria-label={`Slide ${i + 1}`}></button>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {!isOpen && !exploreMenu && (
        <div className="shop-closed-overlay">
          <div className="shop-closed-card">
            <span className="closed-icon">{closureInfo?.icon || '🔒'}</span>
            <h2>{closureInfo?.title || 'Currently Unavailable'}</h2>
            <p>{closureInfo?.detail || ''}</p>
            <p style={{marginTop:-12, marginBottom:24, fontSize:14, color:'var(--text-muted)'}}>
              You can still explore our menu below, but ordering will not be available.
            </p>
            <div className="closed-actions">
              <button className="primary" onClick={() => setExploreMenu(true)}>Explore Menu</button>
              <button className="wa-btn" onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}`, '_blank')}>Message on WhatsApp</button>
              <button className="secondary" onClick={() => { navigate('contact'); }}>Contact Us</button>
            </div>
          </div>
        </div>
      )}

      <div className={`content-wrapper ${!isOpen && !exploreMenu ? 'blurred' : ''}`}>
        {view === 'menu' && (
          <div className="category-row" ref={catRowRef}>
            {CATEGORIES.map(cat => (
              <button key={cat} className={cat === activeCat ? 'cat active' : 'cat'} onClick={() => setActiveCat(cat)}>{cat}</button>
            ))}
            <button className="cat-arrow" onClick={() => { catRowRef.current?.scrollBy({ left: 200, behavior: 'smooth' }) }} aria-label="Scroll categories">›</button>
          </div>
        )}

        {view === 'menu' ? (
          <main className="content">
            <section className="menu-section">
              <h3>Explore our menu</h3>
              <div className="menu-grid">
                {visibleMenu.map(item => (
                  <article className="menu-card" key={item.id}>
                    <div className="food-img" aria-hidden style={{ backgroundImage: item.img ? `url(${item.img})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                    <div className="menu-info">
                      <div>
                        <div className="menu-title">{item.name}</div>
                        <div className="menu-desc">{item.desc}</div>
                      </div>
                      {item.hasHalfFull ? (
                        <div className="menu-footer half-full-footer">
                          <div className="variant-row">
                            <div className="variant-info">
                              <span className="variant-label half-label">½ Half</span>
                              <span className="variant-price">₹{item.priceHalf}</span>
                            </div>
                            <div className="qty-controls">
                              <button className="small" disabled={!isOpen} onClick={() => dec(`${item.id}_half`)}>-</button>
                              <input value={quantities[`${item.id}_half`] || 0} onChange={e => setQty(`${item.id}_half`, e.target.value)} disabled={!isOpen} />
                              <button className="small" disabled={!isOpen} onClick={() => inc(`${item.id}_half`)}>+</button>
                            </div>
                          </div>
                          <div className="variant-row">
                            <div className="variant-info">
                              <span className="variant-label full-label">Full</span>
                              <span className="variant-price">₹{item.priceFull}</span>
                            </div>
                            <div className="qty-controls">
                              <button className="small" disabled={!isOpen} onClick={() => dec(`${item.id}_full`)}>-</button>
                              <input value={quantities[`${item.id}_full`] || 0} onChange={e => setQty(`${item.id}_full`, e.target.value)} disabled={!isOpen} />
                              <button className="small" disabled={!isOpen} onClick={() => inc(`${item.id}_full`)}>+</button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="menu-footer">
                          <div className="price">₹{item.price}</div>
                          <div className="qty-controls">
                            <button className="small" disabled={!isOpen} onClick={() => dec(`${item.id}`)}>-</button>
                            <input value={quantities[item.id] || 0} onChange={e => setQty(`${item.id}`, e.target.value)} disabled={!isOpen} />
                            <button className="small" disabled={!isOpen} onClick={() => inc(`${item.id}`)}>+</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="order-panel" ref={orderPanelRef}>
              {/* Celebration overlay */}
              {showCelebration && celebratedTier && (() => {
                const nextTierAfter = getNextTier(celebratedTier.minAmount)
                const amtSaved = Math.round((subtotal * celebratedTier.discountPercent) / 100)
                return (
                  <div className="celebration-overlay">
                    <div className="celebration-content">
                      <div className="celebration-sparkles">✨🎉✨</div>
                      <div className="celebration-title">{celebratedTier.emoji} {celebratedTier.label} Unlocked!</div>
                      <div className="celebration-sub">You saved ₹{amtSaved} on this order! 🎊</div>
                      <div className="celebration-bar">
                        <div className="celebration-fill" style={{ width: '100%' }}></div>
                      </div>
                      {nextTierAfter && (
                        <div className="celebration-upsell">
                          <div className="upsell-divider"></div>
                          <div className="upsell-text">
                            ⬆️ Add <strong>₹{Math.max(0, nextTierAfter.minAmount - subtotal)}</strong> more to get <strong>{nextTierAfter.emoji} {nextTierAfter.label}</strong>
                          </div>
                        </div>
                      )}
                      {!nextTierAfter && (
                        <div className="celebration-upsell">
                          <div className="upsell-divider"></div>
                          <div className="upsell-text max">
                            🏆 Maximum discount achieved! You're saving big today.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              <h4>Order summary</h4>

              {/* Discount Ladder / Progress Bar — always visible when items are selected */}
              {subtotal > 0 && (
                <div className="discount-ladder">
                  <div className="ladder-header">
                    <span className="ladder-title">🎯 Discount Ladder</span>
                    {activeTier ? (
                      <span className="ladder-badge unlocked">{activeTier.emoji} {activeTier.label}</span>
                    ) : (
                      <span className="ladder-badge locked">No discount</span>
                    )}
                  </div>
                  <div className="ladder-track">
                    <div className="ladder-progress" style={{ width: `${discountProgress}%` }}></div>
                    {DISCOUNT_TIERS.map(tier => {
                      // Calculate position percentage
                      const idx = DISCOUNT_TIERS.indexOf(tier)
                      const prev = idx === 0 ? MIN_ORDER_AMOUNT : DISCOUNT_TIERS[idx - 1].minAmount
                      const next = tier.minAmount
                      const range = next - prev
                      // Approximate position on bar (0 to 100)
                      const pos = ((tier.minAmount - MIN_ORDER_AMOUNT) / (DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1].minAmount - MIN_ORDER_AMOUNT)) * 100
                      const isUnlocked = subtotal >= tier.minAmount
                      return (
                        <div
                          key={tier.minAmount}
                          className={`ladder-marker ${isUnlocked ? 'unlocked' : 'locked'}`}
                          style={{ left: `${Math.min(95, Math.max(5, pos))}%` }}
                        >
                          <div className="marker-dot">{isUnlocked ? '✓' : '🎯'}</div>
                          <div className="marker-label">{tier.emoji} {tier.label}</div>
                          <div className="marker-amount">₹{tier.minAmount}</div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="ladder-footer">
                    {subtotal < MIN_ORDER_AMOUNT && (
                      <div className="ladder-msg min-order-msg">
                        🚫 Add ₹{shortfallMin} more — min order ₹{MIN_ORDER_AMOUNT}
                      </div>
                    )}
                    {subtotal >= MIN_ORDER_AMOUNT && !activeTier && nextTier && (
                      <div className="ladder-msg unlock-msg">
                        🎯 Add ₹{shortfallNext} more to get {nextTier.emoji} {nextTier.label}
                      </div>
                    )}
                    {activeTier && nextTier && (
                      <div className="ladder-msg next-msg">
                        ⬆️ Add ₹{shortfallNext} more to get {nextTier.emoji} {nextTier.label}
                      </div>
                    )}
                    {activeTier && !nextTier && (
                      <div className="ladder-msg max-msg">
                        🏆 Max discount unlocked! You're saving {discountPercent}%
                      </div>
                    )}
                  </div>
                </div>
              )}

              {orderLines.length === 0 ? <div className="empty">No items selected</div> : (
                <div>
                  <ul className="order-lines">
                    {orderLines.map((it, idx) => (
                      <li key={idx}>
                        <span>
                          {it.displayName}
                          <span className="line-qty"> x {it.qty}</span>
                        </span>
                        <strong>₹{it.lineTotal}</strong>
                      </li>
                    ))}
                  </ul>
                  <div className="summary-row"><span>Subtotal</span><span>₹{subtotal}</span></div>
                  {deliveryDistance != null && (
                    <div className="summary-row delivery">
                      <span>
                        Delivery
                        <span className="delivery-distance">{deliveryDistance.toFixed(1)} km</span>
                      </span>
                      <span className={deliveryCharge > 0 ? '' : 'free-delivery'}>
                        {deliveryCharge > 0 ? `₹${deliveryCharge}` : 'FREE'}
                      </span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="summary-row discount-row">
                      <span>
                        Discount
                        <span className="discount-badge">{discountPercent}% OFF</span>
                      </span>
                      <span className="discount-amount">-₹{discountAmount}</span>
                    </div>
                  )}
                  <div className="summary-row total"><span>Total</span><span>₹{total}</span></div>
                  {deliveryDistance != null && deliveryCharge > 0 && (
                    <div className="delivery-note">
                      🚗 {FREE_DELIVERY_KM} km free, then ₹{DELIVERY_CHARGE_PER_KM}/km extra.
                      Beyond {FREE_DELIVERY_KM} km: {Math.round(deliveryDistance - FREE_DELIVERY_KM)} km
                    </div>
                  )}
                  {deliveryDistance != null && deliveryCharge === 0 && (
                    <div className="delivery-note free">
                      🚗 Free delivery within {FREE_DELIVERY_KM} km of our restaurant!
                    </div>
                  )}
                </div>
              )}

              <div className="cust-inputs">
                <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} disabled={!isOpen} />
                <input placeholder="Mobile number" value={mobile} onChange={e => setMobile(e.target.value)} style={{marginTop:8}} disabled={!isOpen} />
                <textarea placeholder="Delivery address" value={address} onChange={e => setAddress(e.target.value)} rows={3} disabled={!isOpen} />
                <textarea placeholder="Delivery instructions (optional)" value={instructions} onChange={e => setInstructions(e.target.value)} rows={2} disabled={!isOpen} />
                <button
                  className={`loc-btn ${location ? 'shared' : ''}`}
                  onClick={() => {
                    if (!navigator.geolocation) {
                      alert('Geolocation is not supported by your browser.')
                      return
                    }
                    setLocating(true)
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const lat = pos.coords.latitude
                        const lng = pos.coords.longitude
                        const dist = haversineDistance(RESTAURANT_LAT, RESTAURANT_LNG, lat, lng)
                        setDeliveryDistance(dist)
                        setLocation(`https://maps.google.com/?q=${lat},${lng}`)
                        setLocating(false)
                      },
                      (err) => {
                        alert('Could not get your location. Please enable location access and try again.')
                        setLocating(false)
                      },
                      { enableHighAccuracy: true, timeout: 10000 }
                    )
                  }}
                  disabled={!isOpen || locating}
                >
                  {locating ? '📍 Getting location...' : location ? '📍 Location shared ✓' : '📍 Share live location'}
                </button>
              </div>

              <button
                className={`place-btn ${canPlace ? 'enabled' : 'disabled'}`}
                onClick={canPlace ? placeOrder : () => {
                  if (!meetsMinOrder) {
                    alert(`Minimum order amount is ₹${MIN_ORDER_AMOUNT}. Please add items worth ₹${shortfallMin} more.`)
                    scrollToOrderPanel()
                  } else {
                    alert('Please enter name, address and select at least one item before placing the order.')
                  }
                }}
                disabled={false}
              >
                {!meetsMinOrder ? `Min ₹${MIN_ORDER_AMOUNT} order` : canPlace ? 'Place order' : 'Enter details to order'}
              </button>
            </aside>
          </main>
        ) : view === 'contact' ? (
          <main className="content contact-page">
            <section>
              <h3>Contact Us</h3>
              <p>Have a question or want to place a large/bulk order? Reach out using the details below or message us on WhatsApp.</p>
              <div className="contact-grid">
                <div className="contact-card">
                  <span className="contact-icon">📞</span>
                  <div className="contact-text">
                    <div className="contact-label">Phone</div>
                    <a className="contact-value" href={`tel:+${WHATSAPP_NUMBER}`}>+91 {WHATSAPP_NUMBER.slice(2)}</a>
                  </div>
                </div>
                <div className="contact-card">
                  <span className="contact-icon">📍</span>
                  <div className="contact-text">
                    <div className="contact-label">Address</div>
                    <div className="contact-value">27/17 Elgin Road, Civil Lines, Prayagraj</div>
                  </div>
                </div>
                <div className="contact-card">
                  <span className="contact-icon">✉️</span>
                  <div className="contact-text">
                    <div className="contact-label">Email</div>
                    <div className="contact-value">moodfresher.24@gmail.com</div>
                  </div>
                </div>
              </div>
              <h4>Opening Hours</h4>
              <table className="opening-table">
                <tbody>
                  <tr>
                    <td>
                      {(() => {
                        const days = CONFIG.operatingHours.days
                        if (days.length === 7) return 'All 7 days'
                        const short = days.map(d => d.slice(0, 3))
                        if (short.length <= 3) return short.join(', ')
                        return `${short[0]}–${short[short.length-1]}`
                      })()}
                    </td>
                    <td>{formatTime(CONFIG.operatingHours.openTime)} — {formatTime(CONFIG.operatingHours.closeTime)}</td>
                  </tr>
                  {(() => {
                    const closedDays = ALL_DAYS.filter(d => !CONFIG.operatingHours.days.includes(d))
                    if (closedDays.length > 0) {
                      return closedDays.map(d => (
                        <tr key={d} style={{ opacity: 0.6 }}>
                          <td>{d}</td>
                          <td>Closed</td>
                        </tr>
                      ))
                    }
                    return null
                  })()}
                </tbody>
              </table>
              <div>
                <h4>Bulk & Catering</h4>
                <p>We accept orders for parties & marriages. Bulk orders starting from 50+ plates — message us for a quote.</p>
              </div>
            </section>
            <aside className="order-panel">
              <h4>Quick Contact</h4>
              <p style={{color:'var(--text-secondary)',marginTop:6,fontSize:14}}>Send a WhatsApp message with your query</p>
              <button className="place-btn enabled" onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello, I would like to enquire about...')}`, '_blank')}>Message on WhatsApp</button>
              <button className="primary" style={{marginTop:12}} onClick={() => navigate('menu')}>Explore our menu</button>
            </aside>
          </main>
        ) : (
          <main className="content contact-page">
            <section style={{padding:20}}>
              <h3>About MoodFresher</h3>
              <p>Delicious food delivered fresh. Made with love.</p>
              <div style={{marginTop:24}}>
                <button className="primary" onClick={() => navigate('menu')}>Explore our menu</button>
              </div>
            </section>
          </main>
        )}

        {view === 'menu' && cartCount > 0 && (
          <div className="bottom-bar">
            <div className="left">
              {cartCount} items • ₹{total}
              {discountAmount > 0 && <span className="bottom-discount"> (-₹{discountAmount})</span>}
            </div>
            <button className="place" onClick={canPlace ? placeOrder : scrollToOrderPanel} disabled={false}>
              {!meetsMinOrder ? `Min ₹${MIN_ORDER_AMOUNT}` : canPlace ? 'Place order' : 'Enter details'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App