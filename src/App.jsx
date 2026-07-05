import { useState, useMemo, useEffect, useRef } from 'react'
import './App.css'

import brandLogo from './resources/Logo.jpeg'
import soyaChaapBiryani from './resources/SoyaChaap biryani.jpeg'
import premiumThali from './resources/Premium Thali.jpeg'
import mlaaiChaap from './resources/Mlaai Chaap.jpeg'
import menu3 from './resources/menu3.jpeg'
import menu2 from './resources/menu2.jpeg'
import menu1 from './resources/menu1.jpeg'
import manchurianNoodles from './resources/Manchurian Noodles.jpeg'
import manchurianFriedRice from './resources/Manchurian Fried Rice.jpeg'
import deluxThali from './resources/Delux Thaali.jpeg'
import chilliPaneerNoodle from './resources/Chilli Paneer Noodle.jpeg'
import chilliPaneerFriedRice from './resources/CHilli Paneer Fried Rice.jpeg'
import chaapButterMasalaRumali from './resources/Chaap Butter Msala RUmali Roti.jpeg'
import bahubaliThali from './resources/Bahubali Thali.jpeg'
import afgaaniChaap from './resources/Afgaani chaap.jpeg'
import achaariChaap from './resources/Achaari Chaap.jpeg'
import itemsData from './data/items.json'

const WHATSAPP_NUMBER = '918736066574'

// Map photo names to imported images
const photoMap = {
  'SoyaChaap biryani.jpeg': soyaChaapBiryani,
  'menu1.jpeg': menu1,
  'Manchurian Noodles.jpeg': manchurianNoodles,
  'Manchurian Fried Rice.jpeg': manchurianFriedRice,
  'Chilli Paneer Noodle.jpeg': chilliPaneerNoodle,
  'CHilli Paneer Fried Rice.jpeg': chilliPaneerFriedRice,
  'Achaari Chaap.jpeg': achaariChaap,
  'Afgaani chaap.jpeg': afgaaniChaap,
  'Chaap Butter Msala RUmali Roti.jpeg': chaapButterMasalaRumali,
  'Bahubali Thali.jpeg': bahubaliThali,
  'Delux Thaali.jpeg': deluxThali,
  'Premium Thali.jpeg': premiumThali,
  'Mlaai Chaap.jpeg': mlaaiChaap,
}

// Build MENU from items.json with images
const MENU = itemsData.items.map(item => ({
  id: item.id,
  name: item.itemName,
  price: item.price,
  desc: item.description,
  img: photoMap[item.photoName],
  category: item.category,
}))

const CONFIG = itemsData
const SHOP_OPEN = CONFIG.shopOpen
const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Helper function to check if shop is open based on operating hours
const isShopOperating = () => {
  if (!SHOP_OPEN) return false

  const config = CONFIG.operatingHours
  if (!config.enabled) return true

  const now = new Date()
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')

  const isOperatingDay = config.days.includes(dayName)
  const isOperatingTime = currentTime >= config.openTime && currentTime < config.closeTime

  return isOperatingDay && isOperatingTime
}

// Format time from 24h to 12h format
const formatTime = (time24) => {
  const [h, m] = time24.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${m} ${ampm}`
}

// Get list of closed days dynamically
const getClosedDaysList = (openDays) => {
  const closedDays = ALL_DAYS.filter(d => !openDays.includes(d))
  const dayLabels = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun'
  }
  return closedDays.map(d => dayLabels[d] || d)
}

// Get closure reason message — fully dynamic
const getClosureMessage = (shopOpen, config) => {
  const openTimeFormatted = formatTime(config.openTime)
  const closeTimeFormatted = formatTime(config.closeTime)

  // If manually closed via shopOpen flag
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

const CATEGORIES = ['All', 'Chinese', 'Chaap Specials', 'Thali', 'Indian Gravy', 'Combos', 'Momos']

function App() {
  const [quantities, setQuantities] = useState(() => MENU.reduce((acc, it) => ({ ...acc, [it.id]: 0 }), {}))
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [mobile, setMobile] = useState('')
  const [instructions, setInstructions] = useState('')
  const [activeCat, setActiveCat] = useState('All')
  const [navOpen, setNavOpen] = useState(false)
  const [view, setView] = useState('menu')
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)
  const [isOpen, setIsOpen] = useState(isShopOperating())
  const orderPanelRef = useRef(null)

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

  const inc = (id) => setQuantities(q => ({ ...q, [id]: (q[id] || 0) + 1 }))
  const dec = (id) => setQuantities(q => ({ ...q, [id]: Math.max(0, (q[id] || 0) - 1) }))
  const setQty = (id, val) => setQuantities(q => ({ ...q, [id]: Math.max(0, Number(val) || 0) }))

  const visibleMenu = useMemo(() => MENU.filter(m => activeCat === 'All' || m.category === activeCat), [activeCat])

  const orderLines = MENU.map(item => {
    const qty = quantities[item.id] || 0
    return { ...item, qty, lineTotal: qty * item.price }
  }).filter(x => x.qty > 0)

  const subtotal = orderLines.reduce((s, it) => s + it.lineTotal, 0)
  const delivery = subtotal > 0 ? 20 : 0
  const total = subtotal + delivery

  const canPlace = name.trim() !== '' && address.trim() !== '' && mobile.trim() !== '' && subtotal > 0 && WHATSAPP_NUMBER

  const scrollToOrderPanel = () => {
    if (orderPanelRef.current) {
      orderPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const placeOrder = () => {
    if (!canPlace) {
      alert('Please enter name, address and select at least one item before placing the order.')
      return
    }

    let msg = `Mood Fresher - New order from website\nName: ${name}\nMobile: ${mobile}\nAddress: ${address}\n\nItems:\n`
    orderLines.forEach(it => { msg += `${it.name} x ${it.qty} = ₹${it.lineTotal}\n` })
    msg += `\nSubtotal: ₹${subtotal}\nDelivery: ₹${delivery}\nTotal: ₹${total}`
    if (instructions && instructions.trim()) {
      msg += `\n\nInstructions: ${instructions.trim()}`
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

  useEffect(() => {
    document.title = 'MoodFresher — Cafe & Restaurant'
  }, [])

  useEffect(() => {
    setIsOpen(isShopOperating())
    const timer = setInterval(() => {
      setIsOpen(isShopOperating())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIdx(prev => (prev + 1) % 3)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  // Dynamic closure info
  const closureInfo = !isOpen ? getClosureMessage(SHOP_OPEN, CONFIG.operatingHours) : null

  return (
    <div className="app-root">
      <header className="topbar">
        <button className="hamburger" aria-label="Open menu" onClick={() => setNavOpen(true)}>☰</button>
        <div className="brand">
          <img className="brand-logo" src={brandLogo} alt="MoodFresher" />
          <div className="brand-text">
            <div className="logo">MoodFresher</div>
            <div className="tag">Cafe & Restaurant</div>
          </div>
        </div>
        <div className="top-actions">
          <button className="wa-btn" onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}`, '_blank')}>ORDER ON WHATSAPP</button>
          <div className="cart" title="Cart">🛒<span className="cart-count">{cartCount}</span></div>
        </div>
      </header>

      {/* Navigation drawer */}
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

      <section className="hero-banner">
        <h2>Delicious Food, Delivered Fresh!</h2>
        <p>Order Direct & Save More</p>
        <div className="hero-actions">
          <button className="primary" onClick={() => { const el = document.querySelector('.menu-section'); if (el) el.scrollIntoView({ behavior: 'smooth' }) }}>Explore our menu</button>
          <button className="secondary" onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}`, '_blank')}>Call / WhatsApp</button>
        </div>
      </section>

      <section className="info-section">
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

      {/* Overlay when shop is closed — blurs all content beneath */}
      {!isOpen && (
        <div className="shop-closed-overlay">
          <div className="shop-closed-card">
            <span className="closed-icon">{closureInfo?.icon || '🔒'}</span>
            <h2>{closureInfo?.title || 'Currently Unavailable'}</h2>
            <p>{closureInfo?.detail || ''}</p>
            <div className="closed-actions">
              <button className="wa-btn" onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}`, '_blank')}>
                Message on WhatsApp
              </button>
              <button className="secondary" onClick={() => { navigate('contact'); }}>
                Contact Us
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`content-wrapper ${!isOpen ? 'blurred' : ''}`}>
        {view === 'menu' && (
          <div className="category-row">
            {isOpen && CATEGORIES.map(cat => (
              <button key={cat} className={cat === activeCat ? 'cat active' : 'cat'} onClick={() => setActiveCat(cat)}>{cat}</button>
            ))}
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
                      <div className="menu-footer">
                        <div className="price">₹{item.price}</div>
                        <div className="qty-controls">
                          <button className="small" disabled={!isOpen} onClick={() => dec(item.id)}>-</button>
                          <input value={quantities[item.id] || 0} onChange={e => setQty(item.id, e.target.value)} disabled={!isOpen} />
                          <button className="small" disabled={!isOpen} onClick={() => inc(item.id)}>+</button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="order-panel" ref={orderPanelRef}>
              <h4>Order summary</h4>
              {orderLines.length === 0 ? <div className="empty">No items selected</div> : (
                <div>
                  <ul className="order-lines">
                    {orderLines.map(it => (
                      <li key={it.id}><span>{it.name} x {it.qty}</span><strong>₹{it.lineTotal}</strong></li>
                    ))}
                  </ul>
                  <div className="summary-row"><span>Subtotal</span><span>₹{subtotal}</span></div>
                  <div className="summary-row"><span>Delivery</span><span>₹{delivery}</span></div>
                  <div className="summary-row total"><span>Total</span><span>₹{total}</span></div>
                </div>
              )}

              <div className="cust-inputs">
                <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} disabled={!isOpen} />
                <input placeholder="Mobile number" value={mobile} onChange={e => setMobile(e.target.value)} style={{marginTop:8}} disabled={!isOpen} />
                <textarea placeholder="Delivery address" value={address} onChange={e => setAddress(e.target.value)} rows={3} disabled={!isOpen} />
                <textarea placeholder="Delivery instructions (optional)" value={instructions} onChange={e => setInstructions(e.target.value)} rows={2} disabled={!isOpen} />
              </div>

              <button className={`place-btn ${canPlace && isOpen ? 'enabled' : 'disabled'}`} onClick={placeOrder} disabled={!canPlace || !isOpen}>Place order via WhatsApp</button>
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
                    <a className="contact-value" href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer">+91 {WHATSAPP_NUMBER.slice(2)}</a>
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
                    <div className="contact-value">moodfresher@example.com</div>
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
            </aside>
          </main>
        ) : (
          <main className="content contact-page"><div style={{padding:20}}>About MoodFresher — Delicious food delivered fresh. <br/>Made with love.</div></main>
        )}

        {view === 'menu' && cartCount > 0 && (
          <div className="bottom-bar">
            <div className="left">{cartCount} items • ₹{total}</div>
            <button className="place" onClick={canPlace ? placeOrder : scrollToOrderPanel} disabled={false}>{canPlace ? 'Place order on WhatsApp' : 'Enter details to order'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App